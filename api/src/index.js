import './env.js'
import { authenticator } from '@otplib/preset-default'
import { fastify } from 'fastify'
import fastifyStatic from 'fastify-static'
import fastifyCookie from 'fastify-cookie'
import fastifyCors from 'fastify-cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDb } from './db.js'
import { registerUser } from './accounts/register.js'
import { authorizeUser } from './accounts/authorize.js'
import { logUserIn } from './accounts/logUserIn.js'
import { logUserOut } from './accounts/logUserOut.js'
import { getUserFromCookies, changePassword, register2FA } from './accounts/user.js'
import { sendEmail, mailInit } from './mail/index.js'
import { createVerifyEmailLink, validateVerifyEmail } from './accounts/verify.js'
import { createResetLink, validateResetEmail } from './accounts/reset.js'

// ESM specific features
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = fastify()

async function startApp() {
    try {
        await mailInit()

        app.register(fastifyCors, {
            origin: [
                /\.nodeauth.dev/,
                'https://nodeauth.dev'
            ],
            credentials: true
        })
        app.register(fastifyCookie, {
            secret: process.env.COOKIE_SIGNATURE
        })
        app.register(fastifyStatic, {
            root: path.join(__dirname, "public")
        })
        app.get('/api/user', {}, async (request, reply) => {
            const user = await getUserFromCookies(request, reply)
            if (user) return reply.send({ data: { user } })
            reply.send({})
        })
        app.post('/api/2fa-register', {}, async (request, reply) => {
            try {
                const user = await getUserFromCookies(request, reply)
                const { token, secret } = request.body
                const isValid = authenticator.verify({ token, secret })
                if (user._id && isValid) {
                    await register2FA(user._id, secret)
                    reply.send()
                }
                reply.code(401).send()
            } catch (e) {
                console.error(e)
                reply.send({
                    data: {
                        status: 'FAILED'
                    }
                })
            }
        })
        app.post('/api/verify-2fa', {}, async (request, reply) => {
            try {
                const { token, email, password } = request.body
                const { isAuthorized, userId, authenticatorSecret } = await authorizeUser(email, password)
                const isValid = authenticator.verify({ token, secret: authenticatorSecret })
                if (userId && isValid && isAuthorized) {
                    await logUserIn(userId, request, reply)
                    return reply.send('yayyyy!')
                }
                reply.code(401).send()
            } catch (e) {
                console.error(e)
                reply.send({
                    data: {
                        status: 'FAILED'
                    }
                })
            }
        })
        app.post('/api/register', {}, async (request, reply) => {
            try {
                const userId = await registerUser(request.body.email, request.body.password)
                if (userId) {
                    const emailLink = await createVerifyEmailLink(request.body.email)
                    await sendEmail({
                        to: request.body.email,
                        subject: 'Verify your email',
                        html: `<a href="${emailLink}">verify</a>`
                    })

                    await logUserIn(userId, request, reply)
                    reply.send({
                        data: {
                            status: 'SUCCESS',
                            userId
                        }
                    })
                }
            } catch (e) {
                console.error(e)
                reply.send({
                    data: {
                        status: 'FAILED'
                    }
                })
            }
        })
        app.post('/api/authorize', {}, async (request, reply) => {
            try {
                const { isAuthorized, userId, authenticatorSecret } = await authorizeUser(request.body.email, request.body.password)
                if (isAuthorized && !authenticatorSecret) {
                    await logUserIn(userId, request, reply)
                    reply.send({
                        data: {
                            status: 'SUCCESS',
                            userId
                        }
                    })
                } else if (isAuthorized && authenticatorSecret) {
                    reply.send({
                        data: {
                            status: '2FA'
                        }
                    })
                }
                reply.code(401).send({
                    data: {
                        status: 'FAILED'
                    }
                })
            } catch (e) {
                console.error(e)
                reply.send({
                    data: {
                        status: 'FAILED'
                    }
                })
            }
        })
        app.post('/api/logout', {}, async (request, reply) => {
            try {
                await logUserOut(request, reply)
                reply.send({
                    data: {
                        status: 'SUCCESS'
                    }
                })
            } catch (e) {
                console.error(e)
                reply.send({
                    data: {
                        status: 'FAILED'
                    }
                })
            }
        })
        app.post('/api/change-password', {}, async (request, reply) => {
            try {
                const { oldPassword, newPassword } = request.body
                // verify user login
                const user = await getUserFromCookies(request, reply)
                if (user?.email?.address) {
                    const { isAuthorized, userId } = await authorizeUser(user.email.address, oldPassword)
                    if (isAuthorized) {
                        await changePassword(userId, newPassword)
                        return reply.code(200).send('all good')
                    }
                }
                return reply.code(401).send()
            } catch (e) {
                console.error(e)
                return reply.code(401).send()
            }
        })
        app.post('/api/forgot-password', {}, async (request, reply) => {
            try {
                const { email } = request.body
                const link = await createResetLink(email)
                if (link) {
                    await sendEmail({
                        to: email,
                        subject: 'Reset your password',
                        html: `<a href="${link}">Reset</a>`
                    })
                }
                return reply.code(200).send()
            } catch (e) {
                console.error(e)
                return reply.code(401).send()
            }
        })
        app.post('/api/reset', {}, async (request, reply) => {
            try {
                const { email, password, token, time } = request.body
                const isValid = await validateResetEmail(token, email, time)
                if (isValid) {
                    // find user
                    const { user } = await import('./user/user.js')
                    const foundUser = await user.findOne({
                        'email.address': email
                    })
                    // change password
                    if (foundUser._id) {
                        await changePassword(foundUser._id, password)
                        return reply.code(200).send('Password updated')
                    }
                }
                return reply.code(401).send('Reset failed')
            } catch (e) {
                console.error(e)
                return reply.code(401).send()
            }
        })
        app.post('/api/verify', {}, async (request, reply) => {
            try {
                const { email, token } = request.body
                const isValid = await validateVerifyEmail(token, email)
                if (isValid) {
                    return reply.code(200).send()
                } else {
                    return reply.code(401).send()
                }
            } catch (e) {
                console.error(e)
                return reply.code(401).send()
            }
        })
        app.get('/test', {}, async (request, reply) => {
            try {
                // verify user login
                const user = await getUserFromCookies(request, reply)
                // return user email, if it exists, otherwise return unauthenticated
                if (user?._id) {
                    reply.send({
                        user
                    })
                } else {
                    reply.send({
                        data: 'user lookup failed'
                    })
                }
            } catch (e) {
                throw new Error(e)
            }
        })
        await app.listen(3000)
        console.log("server listening at port 3000")
    } catch (e) {
        console.error(e)
    }
}

connectDb().then(() => {
    startApp()
})