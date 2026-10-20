import { Router } from "express";
import { obtenerRoles } from "../controllers/roles.controller";

const router = Router();

router.get("/", obtenerRoles);

export default router;