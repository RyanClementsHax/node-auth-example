import crypto from 'crypto'
const { ROOT_DOMAIN, JWTSignature } = process.env

export function createResetToken(email, expTimestamp) {
    try {
        const authString = `${JWTSignature}:${email}:${expTimestamp}`
        return crypto.createHash('sha256').update(authString).digest('hex')
    } catch (e) {
        console.log(e)
    }
}

function validateExpTimestamp(expTimestamp) {
    // one day in milliseconds
    const expTime = 24 * 60 * 60 * 1000
    // difference between now and expired time
    const dateDiff = Number(expTimestamp) - Date.now()
    // we're expired if not in past or difference in time is less than allowed
    const isValid = dateDiff > 0 && dateDiff < expTime
    return isValid
}

export async function createResetEmailLink(email) {
    try {
        const URIencodedEmail = encodeURIComponent(email)
        const expTimestamp = Date.now() + 24 * 60 * 60 * 1000
        const token = createResetToken(email, expTimestamp)
        // link email contains user email, token, expiration date
        return `https://${ROOT_DOMAIN}/reset/${URIencodedEmail}/${expTimestamp}/${token}`
    } catch (e) {
        console.log(e)
    }
}

export async function createResetLink(email) {
    // send email with that link
    try {
        const { user } = await import('../user/user.js')
        // check to see if a user exists with that email
        const foundUser = await user.findOne({
            'email.address': email,
        })
        // if user exists
        if (foundUser) {
            // create email link
            const link = await createResetEmailLink(email)
            return link
        }
        return ''
    } catch (e) {
        console.log(e)
        return false
    }
}

export async function validateResetEmail(token, email, expTimestamp) {
    try {
        // create a hash aka token
        const resetToken = createResetToken(email, expTimestamp)

        // compare hash with token
        const isValid = resetToken === token

        // time is not expired
        const isTimestampValid = validateExpTimestamp(expTimestamp)
        return isValid && isTimestampValid
    } catch (e) {
        console.log(e)
        return false
    }
}