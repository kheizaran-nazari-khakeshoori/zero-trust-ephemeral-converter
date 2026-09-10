import jwt from 'jsonwebtoken';
import { UserDB } from './userDb.js';
import { JWT_SECRET } from './config.js';

export async function requireAuth(req, res, next) {
  const authorization = req.get('Authorization');
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.jti || !payload.userId) {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }
    const session = await UserDB.findSession(payload.jti, token);

    if (!session || session.userId !== payload.userId) {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }

    req.user = { id: session.userId, sessionId: payload.jti };
    return next();
  } catch {
    return res.status(401).json({ error: 'Session is invalid or expired.' });
  }
}

// This middleware function checks for a valid JWT in the Authorization header and verifies the session against the database. If valid, it attaches the user information to the request object; otherwise, it responds with a 401 Unauthorized error.