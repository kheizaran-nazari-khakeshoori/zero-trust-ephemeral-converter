import jwt from 'jsonwebtoken';
import { UserDB } from './userDb.js';

const jwtSecret = process.env.JWT_SECRET || 'development-only-change-this-secret';

export async function requireAuth(req, res, next) {
  const authorization = req.get('Authorization');
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const session = await UserDB.findSession(payload.jti, token);

    if (!session || session.userId !== payload.userId) {
      return res.status(401).json({ error: 'Session is invalid or expired.' });
    }

    req.user = { id: session.userId };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Session is invalid or expired.' });
  }
}