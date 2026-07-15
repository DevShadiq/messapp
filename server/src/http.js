import jwt from 'jsonwebtoken';
import { pool } from './db.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new HttpError(401, 'Please sign in to continue'));
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired'));
  }
}

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(new HttpError(400, result.error.issues[0].message));
    req.validated = result.data;
    next();
  };
}

export async function membershipForMess(userId, messId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT mm.id, mm.mess_id AS messId, mm.user_id AS userId, mm.role, mm.status
     FROM mess_members mm WHERE mm.user_id=? AND mm.mess_id=? AND mm.status='active' LIMIT 1`,
    [userId, messId]
  );
  return rows[0];
}

export async function membershipForCycle(userId, cycleId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT mm.id, mm.mess_id AS messId, mm.user_id AS userId, mm.role, mm.status
     FROM mess_members mm JOIN mess_cycles mc ON mc.mess_id=mm.mess_id
     WHERE mm.user_id=? AND mc.id=? AND mm.status='active' LIMIT 1`,
    [userId, cycleId]
  );
  return rows[0];
}

export const requireMessRole = (role) => asyncRoute(async (req, res, next) => {
  const membership = await membershipForMess(req.user.id, Number(req.params.id));
  if (!membership || (role && membership.role !== role)) throw new HttpError(403, 'You do not have permission for this mess');
  req.membership = membership; next();
});

export const requireCycleRole = (role) => asyncRoute(async (req, res, next) => {
  const membership = await membershipForCycle(req.user.id, Number(req.params.id));
  if (!membership || (role && membership.role !== role)) throw new HttpError(403, 'You do not have permission for this cycle');
  req.membership = membership; next();
});

export const requireSuperAdmin = asyncRoute(async (req, res, next) => {
  const [[user]] = await pool.execute('SELECT system_role AS systemRole FROM users WHERE id=? AND is_active=1', [req.user.id]);
  if (!user || user.systemRole !== 'super_admin') throw new HttpError(403, 'Only a super admin can perform this action');
  req.user.systemRole = user.systemRole;
  next();
});
