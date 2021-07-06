import { createSession } from './session.js'
import { refreshTokens } from './user.js'

export async function logUserIn(userId, request, reply) {
    const connectionInformation = {
        ip: request.ip,
        userAgent: request.headers['user-agent']
    }
    // create session
    const sessionToken = await createSession(userId, connectionInformation)
    
    await refreshTokens(sessionToken, userId, reply)
}