import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware";

export const esAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.rol?.toString().toLowerCase() !== "administrador") {
    res.status(403).json({
      error: "Acceso denegado: Se requieren permisos de administrador",
    });
    return;
  }
  next();
};

export const esRecepcionistaOAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const rol = req.user?.rol?.toString().toLowerCase() || "";
  if (!rol.includes("recep") && rol !== "administrador") {
    res.status(403).json({
      error: "Acceso denegado: Se requieren permisos de recepción o administrador",
    });
    return;
  }
  next();
};

export const esRecepcionistaODespachoOAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const rol = req.user?.rol?.toString().toLowerCase() || "";
  if (!rol.includes("recep") && rol !== "administrador" && rol !== "secretaria_despacho") {
    res.status(403).json({
      error: "Acceso denegado: Se requieren permisos de recepción, despacho o administrador",
    });
    return;
  }
  next();
};

export const esDespachoOAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const rol = req.user?.rol?.toString().toLowerCase() || "";
  if (rol !== "secreataria_despacho" &&  rol !== "administrador") {
    res.status(403).json({
      error: "Acceso denegado: Se requieren permisos de despacho o administrador",
    });
    return;
  }
  next();
};

export const esJefeRecepcionOAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const rol = req.user?.rol?.toString().toLowerCase() || "";
  if  (rol !== "jefe_recepcion" &&  rol !== "administrador"){
    res.status(403).json({
      error: "Acceso denegado: Se requieren permisos de recepción o administrador",
    });
    return;
  }
  next();
};

