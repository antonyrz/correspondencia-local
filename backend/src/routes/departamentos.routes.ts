import { Router } from "express";
import { listarDepartamentos } from "../controllers/departamentos.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

// Cualquier usuario autenticado puede ver la lista de departamentos
router.get("/", authenticateToken, listarDepartamentos);

export default router;