import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    departamento_id: number;
    rol: string; // Guardaremos el nombre del rol (ej: "Administrador")
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Token de acceso no proporcionado" });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET || "secret", (err, user) => {
    if (err) {
      res.status(403).json({ error: "Token inválido o expirado" });
      return;
    }
    req.user = user as AuthenticatedRequest["user"];
    next();
  });
};