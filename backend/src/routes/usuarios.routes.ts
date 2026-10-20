import { Router } from "express";
import {
  listarUsuarios,
  crearUsuario,
  cambiarEstadoUsuario,
  resetearPasswordUsuario,
} from "../controllers/usuarios.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { esAdmin } from "../middlewares/rol.middleware";

const router = Router();

// Todas las rutas de gestión de usuarios requieren estar autenticado y ser Admin
router.use(authenticateToken, esAdmin);

router.get("/", listarUsuarios);
router.post("/", crearUsuario);
router.patch("/:id/estado", cambiarEstadoUsuario);
router.patch("/:id/reset-password", resetearPasswordUsuario);

export default router;