import { Router } from "express";
import {
  obtenerOrigenesDestinos,
  obtenerRecaudos,
  crearOrigenDestino,
  actualizarOrigenDestino,
} from "../controllers/catalogos.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { esJefeRecepcionOAdmin } from "../middlewares/rol.middleware";

const router = Router();

router.get("/origenes-destinos", authenticateToken, obtenerOrigenesDestinos);
router.get("/recaudos", authenticateToken, obtenerRecaudos);
router.post("/origenes-destinos", authenticateToken, esJefeRecepcionOAdmin, crearOrigenDestino);
router.put("/origenes-destinos/:id", authenticateToken, esJefeRecepcionOAdmin, actualizarOrigenDestino);

export default router;