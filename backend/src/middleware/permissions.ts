import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

type Role = 'FARM_ADMIN' | 'MANAGER' | 'VIEWER';

const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 1,
  MANAGER: 2,
  FARM_ADMIN: 3,
};

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const userRole = req.user.role as Role;
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `This action requires one of: ${allowedRoles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

export function requireMinRole(minRole: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const userRole = req.user.role as Role;
    if ((ROLE_HIERARCHY[userRole] || 0) < ROLE_HIERARCHY[minRole]) {
      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This action requires at least ${minRole} role`,
        },
      });
      return;
    }

    next();
  };
}
