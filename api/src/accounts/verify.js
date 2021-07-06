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

export async function validateVerifyEmail(token, email) {
    try {
        // create a hash aka token
        const emailToken = await createVerifyEmailToken(email)

        // compare hash with token
        const isValid = emailToken === token

        // if successful
        if (isValid) {
            // update user, to make them verified
            const { user } = await import('../user/user.js')
            await user.updateOne(
                {
                    'email.address': email,
                },
                {
                    $set: { 'email.verified': true }
                }
            )
            // return success
            return true
        }
        return false
    } catch (e) {
       console.log(e) 
       return false
    }
}