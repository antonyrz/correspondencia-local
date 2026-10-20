import { Router } from "express";
import {
  login,
  obtenerPerfil,
  cambiarPassword,
} from "../controllers/auth.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

// Ruta pública
router.post("/login", login);

// Rutas protegidas por JWT
router.get("/me", authenticateToken, obtenerPerfil);
router.patch("/cambiar-password", authenticateToken, cambiarPassword);

export default router;