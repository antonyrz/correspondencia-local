import { Router } from "express";
import { 
    crearDocumento, 
    listarDocumentos, 
    listarDocumentosAnulados,
    verificarSerialDocumento,
    obtenerDocumentoPorId, 
    cambiarEstatusDocumento,
    enviarDocumentosADespacho,
    enviarRespuestasPorAval,
    avalarRespuestas,
    devolverRespuestasAvaladas,
    tramitarDocumentos,
    enviarDocumentosADestino,
    eliminarDocumento,
    actualizarDocumento,
    responderDocumento,
    devolverADespacho,
    confirmarRecepcionDepartamento,
    confirmarDevolucionDespacho,
    archivarDocumentos
} from "../controllers/documentos.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { esAdmin, esRecepcionistaOAdmin, esJefeRecepcionOAdmin, esRecepcionistaODespachoOAdmin } from "../middlewares/rol.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// 1. Aplicar autenticación global a todas las rutas
router.use(authenticateToken);

// 2. Rutas Generales y Estáticas
router.get("/", listarDocumentos);
router.get("/anulados", esAdmin, listarDocumentosAnulados);
router.get("/verificar-serial", verificarSerialDocumento);
router.post("/", esRecepcionistaODespachoOAdmin, upload.single("archivo"), crearDocumento);
router.post("/enviar-documentos-despacho", enviarDocumentosADespacho);
router.post("/enviar-respuestas-aval", enviarRespuestasPorAval);
router.post("/avalar-respuestas", avalarRespuestas);
router.post("/devolver-respuestas-avaladas", devolverRespuestasAvaladas);
router.post("/enviar-documentos-destino", enviarDocumentosADestino);
router.patch("/tramitar", tramitarDocumentos);
router.patch("/archivar", archivarDocumentos);

// 3. RUTAS ESPECÍFICAS CON ACCIONES (Deben ir ANTES de router.get("/:id"))
router.patch('/:id/confirmar-recepcion', confirmarRecepcionDepartamento);
router.patch('/:id/confirmar-devolucion', confirmarDevolucionDespacho);
router.patch('/:id/devolver-despacho', devolverADespacho);
router.patch("/:id/estatus", cambiarEstatusDocumento);
router.post("/:id/responder", upload.single("file"), responderDocumento);

// 4. Rutas Dinámicas Genéricas por Parámetro /:id (Al final para que no intercepten a las demás)
router.get("/:id", obtenerDocumentoPorId);
router.put("/:id", esRecepcionistaODespachoOAdmin, upload.single("archivo"), actualizarDocumento);
router.delete("/:id", esJefeRecepcionOAdmin, eliminarDocumento);

export default router;