import jwt from 'jsonwebtoken'

const { ROOT_DOMAIN, JWT_SIGNATURE } = process.env

export async function logUserOut(request, reply) {
    try {
        const { session } = await import('../session/session.js')
        if (request?.cookies?.refreshToken) {
            const { refreshToken } = request.cookies
            // decode refresh token
            const { sessionToken } = jwt.verify(refreshToken, JWT_SIGNATURE)
            // delete db record for session
            await session.deleteOne({
                sessionToken: sessionToken
            })
        }
        const cookieOptions = {
            path: '/',
            domain: ROOT_DOMAIN,
            httpOnly: true,
            secure: true
        }
        // remove cookies
        reply
            .clearCookie('refreshToken', cookieOptions)
            .clearCookie('accessToken', cookieOptions)
    } catch (e) {
        console.error(e)
    }
}