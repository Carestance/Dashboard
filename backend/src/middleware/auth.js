import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication is required.' });
  try {
    req.auth = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Your session is invalid or has expired.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.auth.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission to access this resource.' });
}
