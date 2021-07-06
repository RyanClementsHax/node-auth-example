import crypto from 'crypto'
const { ROOT_DOMAIN, JWTSignature } = process.env

export async function createVerifyEmailToken(email) {
    try {
        const authString = `${JWTSignature}:${email}`
        return crypto.createHash('sha256').update(authString).digest('hex')
    } catch (e) {
        console.log(e)
    }
}

export async function createVerifyEmailLink(email) {
    try {
        const emailToken = await createVerifyEmailToken(email)
        const URIencodedEmail = encodeURIComponent(email)
        return `https://${ROOT_DOMAIN}/verify/${URIencodedEmail}/${emailToken}`
    } catch (e) {
        console.log(e)
    }
}