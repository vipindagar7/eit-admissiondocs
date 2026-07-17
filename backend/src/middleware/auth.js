import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function requireStudentAuth(req, res, next) {
  const token = req.cookies?.student_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, env.jwt.studentSecret);
    req.student = { id: payload.sub, admissionNo: payload.admissionNo, sessionId: payload.sessionId };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireStaffAuth(req, res, next) {
  const token = req.cookies?.staff_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, env.jwt.staffSecret);
    req.staff = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireStaffRole(...roles) {
  return (req, res, next) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
