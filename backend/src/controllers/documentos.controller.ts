import { Response } from "express";
import fs from 'fs/promises';
import path from 'path';
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import { ESTATUS_DOCUMENTO } from "../constants/statusDocumento";

/**
 * Helper recursivo con tipado estricto para convertir cualquier BigInt a String
 * en objetos devueltos por Prisma antes de enviarlos por res.json().
 */
const serializeBigInt = <T>(obj: T): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map((item) => serializeBigInt(item));
  if (typeof obj === "object") {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj as Record<string, any>)) {
      res[key] = serializeBigInt((obj as Record<string, any>)[key]);
    }
    return res;
  }
  return obj;
};

const esSinRecaudosAdjuntos = (nombre: string) =>
  nombre.trim().toLowerCase() === "sin recaudos adjuntos";

/** Resuelve ids de recaudos y si el documento realmente tiene anexos (no solo "Sin Recaudos Adjuntos"). */
const resolverRecaudosSeleccionados = async (
  recaudo_ids: unknown,
  recaudos: unknown
): Promise<{ ids: number[]; tieneRecaudos: boolean }> => {
  let ids: number[] = [];

  if (recaudo_ids !== undefined && recaudo_ids !== null && recaudo_ids !== "") {
    const parsed = typeof recaudo_ids === "string" ? JSON.parse(String(recaudo_ids)) : recaudo_ids;
    if (Array.isArray(parsed)) {
      ids = parsed.map((n) => Number(n)).filter((n) => !Number.isNaN(n));
    }
  } else if (recaudos !== undefined && recaudos !== null && recaudos !== "") {
    const parsed = typeof recaudos === "string" ? JSON.parse(String(recaudos)) : recaudos;
    if (Array.isArray(parsed)) {
      const valores = parsed.map((n) => String(n).trim()).filter(Boolean);
      const numericos = valores.filter((v) => /^\d+$/.test(v)).map(Number);
      const nombres = valores.filter((v) => !/^\d+$/.test(v));

      const orFilters: Prisma.RecaudosWhereInput[] = [];
      if (numericos.length > 0) orFilters.push({ id: { in: numericos } });
      if (nombres.length > 0) {
        orFilters.push({ nombre: { in: nombres, mode: "insensitive" } });
      }

      if (orFilters.length > 0) {
        const encontrados = await prisma.recaudos.findMany({
          where: { OR: orFilters },
        });
        ids = encontrados.map((r) => r.id);
      }
    }
  }

  const unicos = Array.from(new Set(ids));
  if (unicos.length === 0) {
    return { ids: [], tieneRecaudos: false };
  }

  const filas = await prisma.recaudos.findMany({
    where: { id: { in: unicos } },
    select: { id: true, nombre: true },
  });

  return {
    ids: unicos,
    tieneRecaudos: filas.some((r) => !esSinRecaudosAdjuntos(r.nombre)),
  };
};

/** Busca si ya existe un documento con el mismo oficio_serial (sin distinguir mayúsculas). */
const buscarDocumentoPorSerial = async (
  oficio_serial: string,
  excludeId?: bigint
) => {
  const serial = oficio_serial.trim();
  if (!serial) return null;

  return prisma.documentos.findFirst({
    where: {
      oficio_serial: { equals: serial, mode: "insensitive" },
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, oficio_serial: true },
  });
};

// GET /api/documentos/verificar-serial?oficio_serial=...&exclude_id=...
export const verificarSerialDocumento = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const oficio_serial = String(req.query.oficio_serial ?? "").trim();
    const excludeRaw = req.query.exclude_id;

    if (!oficio_serial) {
      res.status(400).json({ error: "Debe indicar el oficio_serial a verificar" });
      return;
    }

    let excludeId: bigint | undefined;
    if (excludeRaw != null && String(excludeRaw).trim() !== "") {
      try {
        excludeId = BigInt(String(excludeRaw));
      } catch {
        res.status(400).json({ error: "exclude_id inválido" });
        return;
      }
    }

    const existente = await buscarDocumentoPorSerial(oficio_serial, excludeId);

    res.json({
      existe: Boolean(existente),
      oficio_serial,
      ...(existente
        ? { documento_id: serializeBigInt(existente.id), serial_registrado: existente.oficio_serial }
        : {}),
    });
  } catch (error) {
    console.error("Error verificando serial:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/documentos
export const crearDocumento = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  let filePathCreated: string | null = null;

  try {
    const file = req.file;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "Debe adjuntar un archivo PDF" });
      return;
    }

    const {
      fecha,
      fecha_emision,
      oficio_tipo,
      oficio_serial,
      descripcion,
      origen_id,
      destino_id,
      departamento_actual_id,
      requiere_respuesta,
      requires_response,
      tiene_recaudos,
      prioridad,
      estatus,
      documento_padre_id,
      recaudo_ids,
      recaudos,
      observacion,
    } = req.body;

    let origenIdFinal = origen_id ? Number(origen_id) : null;
    let destinoIdFinal = destino_id ? Number(destino_id) : null;
    let departamentoActualFinal = departamento_actual_id ? Number(departamento_actual_id) : null;
    let tipoFinal = oficio_tipo;
    let prioridadFinal = prioridad === "true" || prioridad === true;

    if (documento_padre_id) {
      let documentoPadreIdVal: bigint;
      try {
        documentoPadreIdVal = BigInt(documento_padre_id);
      } catch {
        res.status(400).json({ error: "ID de documento padre inválido" });
        return;
      }

      const documentoPadre = await prisma.documentos.findFirst({
        where: { id: documentoPadreIdVal, eliminado_at: null },
      });

      if (!documentoPadre) {
        res.status(404).json({ error: "El documento origen de la respuesta no existe o fue eliminado" });
        return;
      }

      if (!destinoIdFinal) {
        res.status(400).json({ error: "Debe seleccionar el destino específico de la respuesta" });
        return;
      }

      tipoFinal = documentoPadre.oficio_tipo;
      departamentoActualFinal = documentoPadre.departamento_actual_id;
      origenIdFinal = origenIdFinal || documentoPadre.destino_id || documentoPadre.origen_id;
      prioridadFinal = documentoPadre.prioridad;
    }

    if (!tipoFinal || !oficio_serial || !descripcion || !origenIdFinal) {
      res.status(400).json({
        error: "Faltan campos requeridos: oficio_tipo, oficio_serial, descripcion, origen_id",
      });
      return;
    }

    const serialDuplicado = await buscarDocumentoPorSerial(String(oficio_serial));
    if (serialDuplicado) {
      res.status(409).json({
        error: "Ya existe un documento registrado con el mismo OFICIO SERIAL. No se puede guardar.",
      });
      return;
    }

    // --- CAMBIO: Guardar el archivo localmente en disco ---
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    const uploadDir = path.join(process.cwd(), 'uploads');

    
    // Asegurar que la carpeta uploads exista
    await fs.mkdir(uploadDir, { recursive: true });
    
    const absolutePath = path.join(uploadDir, fileName);
    filePathCreated = absolutePath;

    // Escribir el buffer del archivo en la ruta local
    await fs.writeFile(absolutePath, file.buffer);

    // URL o ruta relativa que guardaremos en la base de datos para que el frontend la consulte
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const localUrl = `${backendUrl}/uploads/${fileName}`;
    // -----------------------------------------------------

    const { ids: arrayRecaudos, tieneRecaudos } = await resolverRecaudosSeleccionados(
      recaudo_ids,
      recaudos
    );
    const requiereRespuestaValor =
      requires_response !== undefined ? requires_response : requiere_respuesta;

    const fechaStr = fecha_emision || fecha;

    let fechaBase = new Date();

    if (fechaStr) {
      // Si viene del input tipo fecha ("YYYY-MM-DD"), lo separamos para evitar el desfase UTC
      const partes = fechaStr.toString().split('T')[0].split('-');
      if (partes.length === 3) {
        fechaBase = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
      } else {
        fechaBase = new Date(fechaStr);
      }
    }

      const ahora = new Date();

      const fechaFinal = new Date(
        fechaBase.getFullYear(),
        fechaBase.getMonth(),
        fechaBase.getDate(),
        ahora.getHours(),
        ahora.getMinutes(),
        ahora.getSeconds()
      );

    const estatusInicial = documento_padre_id
      ? "POR_AVALAR"
      : estatus || "RECIBIDO";

    const nuevoDocumento = await prisma.$transaction(async (tx) => {
      const doc = await tx.documentos.create({
        data: {
          fecha: fechaFinal,
          oficio_tipo: tipoFinal,
          oficio_serial,
          descripcion,
          origen_id: Number(origenIdFinal),
          destino_id: destinoIdFinal,
          ...(departamentoActualFinal && { departamento_actual_id: departamentoActualFinal }),
          requiere_respuesta: documento_padre_id
            ? false
            : requiereRespuestaValor === "true" || requiereRespuestaValor === true,
          tiene_recaudos: documento_padre_id ? false : tieneRecaudos,
          prioridad: prioridadFinal,
          estatus: estatusInicial,
          pdf_url: localUrl, // Guardamos la ruta local
          pdf_nombre_original: file.originalname,
          pdf_peso_kb: Math.round(file.size / 1024),
          registrado_idusuario: Number(usuarioId),
          documento_padre_id: documento_padre_id ? BigInt(documento_padre_id) : null,
          recaudos: arrayRecaudos.length > 0 ? {
            create: arrayRecaudos.map((recaudo_id) => ({
              recaudo_id: Number(recaudo_id),
            })),
          } : undefined,
          observacion: observacion ? observacion : null
        },
        include: {
          origen: true,
          destino: true,
          departamento_actual: true,
          usuario_registra: {
            select: { id: true, nombre: true, apellido: true, cedula: true },
          },
          recaudos: { include: { recaudo: true } },
        },
      });

      await tx.historialEstatus.create({
        data: {
          documento_id: doc.id,
          estatus_previo: null,
          estatus_nuevo: estatusInicial,
          usuario_id: Number(usuarioId),
        },
      });

      return doc;
    });

    res.status(201).json({
      message: "Documento registrado con éxito",
      documento: serializeBigInt(nuevoDocumento),
    });
  } catch (error) {
    // Si falla algo en la transacción, borramos el archivo físico guardado para no dejar basura
    if (filePathCreated) {
      try {
        await fs.unlink(filePathCreated);
      } catch (unlinkError) {
        console.error("No se pudo borrar el archivo local tras el fallo:", unlinkError);
      }
    }
    console.error("Error creando documento:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /api/documentos
export const listarDocumentos = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      page = "1",
      limit = "10",
      estatus,
      origen_id,
      destino_id,
      departamento_actual_id,
      oficio_serial,
      search,
      fecha_desde,
      fecha_hasta,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    // Permite lotes grandes para bandejas que filtran/paginan en cliente (máx. 5000)
    const limitNum = Math.max(1, parseInt(limit as string, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const usuario = req.user as any;
    const rolId = Number(usuario?.rol_id);
    const rolNombre = (usuario?.rol || "").toString().toLowerCase().trim();

    // Administrador (ID 1), Recepcionista (ID 2) o Secretaria de Despacho (ID 3)
    const esGlobal =
      rolId === 1 ||
      rolId === 2 ||
      rolId === 3 ||
      rolId === 4 ||
      rolId === 5 ||
      rolNombre === "administrador" ||
      rolNombre === "recepcionista" ||
      rolNombre === "secretaria_despacho" ||
      rolNombre === "jefe_departamento" ||
      rolNombre === "jefe_recepcion"
      ;

    const whereClause: Prisma.DocumentosWhereInput = {
      eliminado_at: null,
    };

    // CONTROL DE ACCESO SEGÚN ROL
    if (esGlobal) {
      // Roles globales: ven todo, salvo que especifiquen un departamento_actual_id en los query params
      if (departamento_actual_id && !isNaN(Number(departamento_actual_id))) {
        whereClause.departamento_actual_id = Number(departamento_actual_id);
      }
    } else {
      // Roles de unidad: ven lo de su departamento y las respuestas cuyo original sigue en esa unidad
      if (usuario?.departamento_id) {
        const deptoId = Number(usuario.departamento_id);
        whereClause.AND = [
          {
            OR: [
              { departamento_actual_id: deptoId },
              { documento_padre: { departamento_actual_id: deptoId } },
            ],
          },
        ];
      }
    }

    if (estatus && estatus !== "undefined" && estatus !== "null") {
      whereClause.estatus = String(estatus).trim();
    }

    if (origen_id && !isNaN(Number(origen_id))) {
      whereClause.origen_id = Number(origen_id);
    }

    if (destino_id && !isNaN(Number(destino_id))) {
      whereClause.destino_id = Number(destino_id);
    }

    if (oficio_serial) {
      whereClause.oficio_serial = {
        contains: (oficio_serial as string).trim(),
        mode: "insensitive",
      };
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        { oficio_serial: { contains: searchTerm, mode: "insensitive" } },
        { descripcion: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    if (fecha_desde || fecha_hasta) {
      const fechaFilter: Prisma.DateTimeFilter = {};

      if (fecha_desde) {
        fechaFilter.gte = new Date(fecha_desde as string);
      }

      if (fecha_hasta) {
        const hasta = new Date(fecha_hasta as string);
        hasta.setHours(23, 59, 59, 999);
        fechaFilter.lte = hasta;
      }

      whereClause.fecha = fechaFilter;
    }

    const [total, documentos] = await prisma.$transaction([
      prisma.documentos.count({ where: whereClause }),
      prisma.documentos.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        include: {
          origen: true,
          destino: true,
          departamento_actual: true,
          usuario_registra: {
            select: { id: true, nombre: true, apellido: true, cedula: true },
          },
          recaudos: { include: { recaudo: true } },
          documento_padre: {
            select: {
              id: true,
              oficio_serial: true,
              oficio_tipo: true,
              descripcion: true,
              estatus: true,
              departamento_actual_id: true,
              departamento_actual: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: { fecha: "desc" },
      }),
    ]);

    const documentosOrdernados = [...documentos].sort((a, b) => {
      const esArchivadoA = a.estatus?.toUpperCase() === "ARCHIVADO";
      const esArchivadoB = b.estatus?.toUpperCase() === "ARCHIVADO";

      if (esArchivadoA && !esArchivadoB) return 1;  // A va después que B
      if (!esArchivadoA && esArchivadoB) return -1; // A va antes que B
      return 0; // Si ambos son archivados o ninguno lo es, mantiene el orden original por fecha
    });


    res.json({
      meta: {
        total_registros: total,
        pagina_actual: pageNum,
        limite_por_pagina: limitNum,
        total_paginas: Math.ceil(total / limitNum),
      },
      data: serializeBigInt(documentosOrdernados),
    });
  } catch (error) {
    console.error("Error listando documentos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const listarDocumentosAnulados = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const usuario = req.user as any;
    const rolNombre = (usuario?.rol || "").toString().toLowerCase().trim();

    // Solo el administrador puede listar documentos anulados
    if (rolNombre !== "administrador") {
      res.status(403).json({
        error: "Acceso denegado. Solo el Administrador puede listar documentos anulados.",
      });
      return;
    }

    const { page = "1", limit = "10" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Condición única: traer solo los anulados
    const whereClause = {
      estatus: ESTATUS_DOCUMENTO.ANULADO,
    };

    const [total, documentos] = await prisma.$transaction([
      prisma.documentos.count({ where: whereClause }),
      prisma.documentos.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        include: {
          origen: true,
          destino: true,
          departamento_actual: true,
          usuario_elimina: {
            select: { id: true, nombre: true, apellido: true, cedula: true },
          },
          usuario_registra: {
            select: { id: true, nombre: true, apellido: true, cedula: true },
          },
          recaudos: { include: { recaudo: true } },
        },
        orderBy: { fecha: "desc" },
      }),
    ]);


    res.json({
      meta: {
        total_registros: total,
        pagina_actual: pageNum,
        limite_por_pagina: limitNum,
        total_paginas: Math.ceil(total / limitNum),
      },
      data: serializeBigInt(documentos),
    });
  } catch (error) {
    console.error("Error listando documentos anulados:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
// PATCH /api/documentos/:id/estatus
export const cambiarEstatusDocumento = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { estatus, departamento_id } = req.body; 
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!estatus) {
      res.status(400).json({ error: "El campo estatus es requerido" });
      return;
    }

    let documentoId: bigint;
    try {
      documentoId = BigInt(id as string);
    } catch {
      res.status(400).json({ error: "ID de documento inválido" });
      return;
    }

    const documentoExistente = await prisma.documentos.findFirst({
      where: { id: documentoId, eliminado_at: null },
    });

    if (!documentoExistente) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }

    const updateData: Prisma.DocumentosUpdateInput = { estatus };
    if (departamento_id !== undefined) {
      updateData.departamento_actual = {
        connect: { id: Number(departamento_id) }
      };
    }

    const [documentoActualizado, nuevoHistorial] = await prisma.$transaction([
      prisma.documentos.update({
        where: { id: documentoId },
        data: updateData,
      }),
      prisma.historialEstatus.create({
        data: {
          documento_id: documentoId,
          estatus_previo: documentoExistente.estatus,
          estatus_nuevo: estatus,
          usuario_id: Number(usuarioId),
        },
      }),
    ]);

    res.json({
      message: "Estatus actualizado correctamente",
      documento: serializeBigInt(documentoActualizado),
      historial: serializeBigInt(nuevoHistorial),
    });
  } catch (error) {
    console.error("Error cambiando estatus:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/documentos/despacho-masivo
export const enviarDocumentosADespacho = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { ids, departamento_despacho_id = 2 } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Debe proporcionar una lista de IDs de documentos" });
      return;
    }

    const documentoIds = ids.map((id: string | number) => BigInt(id));

    const documentosExistentes = await prisma.documentos.findMany({
      where: {
        id: { in: documentoIds },
        eliminado_at: null,
      },
      select: { id: true, estatus: true },
    });

    if (documentosExistentes.length === 0) {
      res.status(404).json({ error: "No se encontraron documentos válidos" });
      return;
    }

    const estatusNuevo = "EN_DESPACHO";

    await prisma.$transaction([
      prisma.documentos.updateMany({
        where: { id: { in: documentoIds } },
        data: {
          estatus: estatusNuevo,
          departamento_actual_id: Number(departamento_despacho_id),
        },
      }),
      prisma.historialEstatus.createMany({
        data: documentosExistentes.map((doc) => ({
          documento_id: doc.id,
          estatus_previo: doc.estatus,
          estatus_nuevo: estatusNuevo,
          usuario_id: Number(usuarioId),
        })),
      }),
    ]);

    res.json({
      message: `Se enviaron ${documentosExistentes.length} documentos a Despacho correctamente`,
    });
  } catch (error) {
    console.error("Error en despacho masivo:", error);
    res.status(500).json({ error: "Error interno del servidor al procesar el despacho masivo" });
  }
};

const DEPARTAMENTO_DESPACHO_ID = 2;
const ESTATUS_POR_AVALAR = "POR_AVALAR";
const ESTATUS_ENVIADO_AVAL = "ENVIADO_AVAL";
const ESTATUS_PROCESO_DE_AVAL = "PROCESO_DE_AVAL";
const ESTATUS_AVALADO = "AVALADO";
const ESTATUS_DEVUELTO_UNIDAD = "DEVUELTO_UNIDAD";
const ESTATUS_TRAMITADO = "TRAMITADO";
const ESTATUS_ARCHIVADO = "ARCHIVADO";

// POST /api/documentos/enviar-respuestas-aval
export const enviarRespuestasPorAval = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { ids } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Debe proporcionar una lista de IDs de respuestas" });
      return;
    }

    const documentoIds = ids.map((id: string | number) => BigInt(id));

    const documentosExistentes = await prisma.documentos.findMany({
      where: {
        id: { in: documentoIds },
        eliminado_at: null,
      },
      select: { id: true, estatus: true, documento_padre_id: true },
    });

    if (documentosExistentes.length === 0) {
      res.status(404).json({ error: "No se encontraron respuestas válidas" });
      return;
    }

    const noSonRespuestas = documentosExistentes.filter((doc) => !doc.documento_padre_id);
    if (noSonRespuestas.length > 0) {
      res.status(400).json({ error: "Solo se pueden enviar documentos que sean respuestas." });
      return;
    }

    const noListos = documentosExistentes.filter((doc) => doc.estatus !== ESTATUS_POR_AVALAR);
    if (noListos.length > 0) {
      res.status(400).json({
        error: "Solo se pueden enviar a Despacho las respuestas con estatus POR AVALAR.",
      });
      return;
    }

    await prisma.$transaction([
      prisma.documentos.updateMany({
        where: { id: { in: documentoIds } },
        data: { estatus: ESTATUS_ENVIADO_AVAL },
      }),
      prisma.historialEstatus.createMany({
        data: documentosExistentes.map((doc) => ({
          documento_id: doc.id,
          estatus_previo: doc.estatus,
          estatus_nuevo: ESTATUS_ENVIADO_AVAL,
          usuario_id: Number(usuarioId),
        })),
      }),
    ]);

    res.json({
      message: `Se enviaron ${documentosExistentes.length} respuestas a Despacho por aval`,
    });
  } catch (error) {
    console.error("Error enviando respuestas por aval:", error);
    res.status(500).json({ error: "Error interno del servidor al enviar respuestas por aval" });
  }
};

// POST /api/documentos/avalar-respuestas
export const avalarRespuestas = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { ids } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Debe proporcionar una lista de IDs de respuestas" });
      return;
    }

    const documentoIds = ids.map((id: string | number) => BigInt(id));

    const documentosExistentes = await prisma.documentos.findMany({
      where: {
        id: { in: documentoIds },
        eliminado_at: null,
      },
      select: {
        id: true,
        estatus: true,
        documento_padre_id: true,
        oficio_serial: true,
      },
    });

    if (documentosExistentes.length === 0) {
      res.status(404).json({ error: "No se encontraron respuestas válidas" });
      return;
    }

    if (documentosExistentes.length !== documentoIds.length) {
      res.status(400).json({ error: "Uno o más documentos no existen o fueron eliminados" });
      return;
    }

    const invalidos = documentosExistentes.filter(
      (doc) => !doc.documento_padre_id || doc.estatus !== ESTATUS_PROCESO_DE_AVAL
    );
    if (invalidos.length > 0) {
      res.status(400).json({
        error: `Solo se pueden avalar respuestas en PROCESO DE AVAL. Revisar: ${invalidos
          .map((d) => d.oficio_serial)
          .join(", ")}`,
      });
      return;
    }

    await prisma.$transaction([
      prisma.documentos.updateMany({
        where: { id: { in: documentoIds } },
        data: { estatus: ESTATUS_AVALADO },
      }),
      prisma.historialEstatus.createMany({
        data: documentosExistentes.map((doc) => ({
          documento_id: doc.id,
          estatus_previo: doc.estatus,
          estatus_nuevo: ESTATUS_AVALADO,
          usuario_id: Number(usuarioId),
        })),
      }),
    ]);

    res.json({
      message:
        documentosExistentes.length === 1
          ? "Respuesta marcada como AVALADO"
          : `Se marcaron ${documentosExistentes.length} respuestas como AVALADO`,
    });
  } catch (error) {
    console.error("Error al avalar respuestas:", error);
    res.status(500).json({ error: "Error interno del servidor al avalar respuestas" });
  }
};

// POST /api/documentos/devolver-respuestas-avaladas
export const devolverRespuestasAvaladas = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { ids } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Debe proporcionar una lista de IDs de respuestas" });
      return;
    }

    const documentoIds = ids.map((id: string | number) => BigInt(id));

    const documentosExistentes = await prisma.documentos.findMany({
      where: {
        id: { in: documentoIds },
        eliminado_at: null,
      },
      select: {
        id: true,
        estatus: true,
        documento_padre_id: true,
        departamento_actual_id: true,
        oficio_serial: true,
      },
    });

    if (documentosExistentes.length === 0) {
      res.status(404).json({ error: "No se encontraron respuestas válidas" });
      return;
    }

    if (documentosExistentes.length !== documentoIds.length) {
      res.status(400).json({ error: "Uno o más documentos no existen o fueron eliminados" });
      return;
    }

    const invalidos = documentosExistentes.filter(
      (doc) =>
        !doc.documento_padre_id ||
        doc.estatus !== ESTATUS_AVALADO ||
        Number(doc.departamento_actual_id) !== DEPARTAMENTO_DESPACHO_ID
    );
    if (invalidos.length > 0) {
      res.status(400).json({
        error: `Solo se pueden devolver respuestas AVALADAS que estén en Despacho. Revisar: ${invalidos
          .map((d) => d.oficio_serial)
          .join(", ")}`,
      });
      return;
    }

    // No cambia departamento_actual_id: permanece en Despacho hasta que la unidad confirme.
    await prisma.$transaction([
      prisma.documentos.updateMany({
        where: { id: { in: documentoIds } },
        data: { estatus: ESTATUS_DEVUELTO_UNIDAD },
      }),
      prisma.historialEstatus.createMany({
        data: documentosExistentes.map((doc) => ({
          documento_id: doc.id,
          estatus_previo: doc.estatus,
          estatus_nuevo: ESTATUS_DEVUELTO_UNIDAD,
          usuario_id: Number(usuarioId),
        })),
      }),
    ]);

    res.json({
      message:
        documentosExistentes.length === 1
          ? "Respuesta enviada a la unidad. Pendiente de confirmación de recepción."
          : `Se enviaron ${documentosExistentes.length} respuestas a la unidad. Pendiente de confirmación.`,
    });
  } catch (error) {
    console.error("Error al devolver respuestas avaladas:", error);
    res.status(500).json({ error: "Error interno del servidor al devolver respuestas" });
  }
};

// PATCH /api/documentos/tramitar
export const tramitarDocumentos = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { ids } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Debe proporcionar una lista de IDs de documentos" });
      return;
    }

    const documentoIds = ids.map((id: string | number) => BigInt(id));

    const documentosExistentes = await prisma.documentos.findMany({
      where: {
        id: { in: documentoIds },
        eliminado_at: null,
      },
      select: {
        id: true,
        estatus: true,
        documento_padre_id: true,
        oficio_serial: true,
      },
    });

    if (documentosExistentes.length === 0) {
      res.status(404).json({ error: "No se encontraron documentos válidos" });
      return;
    }

    if (documentosExistentes.length !== documentoIds.length) {
      res.status(400).json({ error: "Uno o más documentos no existen o fueron eliminados" });
      return;
    }

    const invalidos = documentosExistentes.filter(
      (doc) => !doc.documento_padre_id || doc.estatus !== ESTATUS_AVALADO
    );
    if (invalidos.length > 0) {
      res.status(400).json({
        error: `Solo se pueden tramitar respuestas en estatus AVALADO. Revisar: ${invalidos
          .map((d) => d.oficio_serial)
          .join(", ")}`,
      });
      return;
    }

    await prisma.$transaction([
      prisma.documentos.updateMany({
        where: { id: { in: documentoIds } },
        data: { estatus: ESTATUS_TRAMITADO },
      }),
      prisma.historialEstatus.createMany({
        data: documentosExistentes.map((doc) => ({
          documento_id: doc.id,
          estatus_previo: doc.estatus,
          estatus_nuevo: ESTATUS_TRAMITADO,
          usuario_id: Number(usuarioId),
        })),
      }),
    ]);

    res.json({
      message:
        documentosExistentes.length === 1
          ? "Documento marcado como TRAMITADO"
          : `Se marcaron ${documentosExistentes.length} documentos como TRAMITADO`,
    });
  } catch (error) {
    console.error("Error al tramitar documentos:", error);
    res.status(500).json({ error: "Error interno del servidor al tramitar documentos" });
  }
};

export const enviarDocumentosADestino = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {

    const { idDocumentos } = req.body;
    const { idDestino } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }
    
    if (!Array.isArray(idDocumentos) || idDocumentos.length === 0) {
      res.status(400).json({ error: "Debe proporcionar una lista de IDs de documentos" });
      return;
    }
    
    const documentoIds = idDocumentos.map((id: string | number) => BigInt(id));

    
    const documentosExistentes = await prisma.documentos.findMany({
      where: {
        id: { in: documentoIds },
        eliminado_at: null,
      },
      select: { id: true, estatus: true },
    });
    
    if (documentosExistentes.length === 0) {
      res.status(404).json({ error: "No se encontraron documentos válidos" });
      return;
    }
    
    await prisma.$transaction([
      prisma.documentos.updateMany({
        where: { id: { in: documentoIds } },
        data: {
          departamento_actual_id: Number(idDestino),
          destino_id: Number(idDestino)
        },
      }),
      prisma.historialEstatus.createMany({
        data: documentosExistentes.map((doc) => ({
          documento_id: doc.id,
          estatus_previo: doc.estatus,
          estatus_nuevo: "ASIGNADO",
          usuario_id: Number(usuarioId),
        })),
      }),
    ]);

    res.json({
      message: `Se enviaron ${documentosExistentes.length} documentos a Despacho correctamente`,
    });
  } catch (error) {
    console.error("Error en despacho masivo:", error);
    res.status(500).json({ error: "Error interno del servidor al procesar el despacho masivo" });
  }
};

// GET /api/documentos/:id
export const obtenerDocumentoPorId = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    let documentoId: bigint;
    try {
      documentoId = BigInt(id as string);
    } catch {
      res.status(400).json({ error: "ID de documento inválido" });
      return;
    }

    const documento = await prisma.documentos.findFirst({
      where: { id: documentoId, eliminado_at: null },
      include: {
        origen: true,
        destino: true,
        departamento_actual: true,
        usuario_registra: {
          select: { id: true, nombre: true, apellido: true, cedula: true },
        },
        recaudos: { include: { recaudo: true } },
        historial_estatus: {
          include: {
            usuario: { select: { id: true, nombre: true, apellido: true } },
          },
          orderBy: { fecha_change: "desc" },
        },
        documento_padre: {
          select: {
            id: true,
            oficio_serial: true,
            oficio_tipo: true,
            descripcion: true,
            estatus: true,
            departamento_actual_id: true,
            departamento_actual: { select: { id: true, nombre: true } },
          },
        },
        documentos_hijos: {
          where: { eliminado_at: null },
          select: {
            id: true,
            oficio_serial: true,
            oficio_tipo: true,
            descripcion: true,
            fecha: true,
            estatus: true,
            pdf_url: true,
            observacion: true,
            destino: { select: { id: true, nombre: true } },
          },
          orderBy: { fecha: "desc" },
        },
      },
    });

    if (!documento) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }

    res.json(serializeBigInt(documento));
  } catch (error) {
    console.error("Error obteniendo detalle de documento:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /api/documentos/:id
export const actualizarDocumento = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  let filePathCreated: string | null = null;

  try {
    const { id } = req.params;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    let documentoId: bigint;
    try {
      documentoId = BigInt(id as string);
    } catch {
      res.status(400).json({ error: "ID de documento inválido" });
      return;
    }

    const documentoExistente = await prisma.documentos.findFirst({
      where: { id: documentoId, eliminado_at: null },
    });

    if (!documentoExistente) {
      res.status(404).json({ error: "Documento no encontrado o fue eliminado" });
      return;
    }

    const {
      fecha,
      fecha_emision,
      oficio_tipo,
      oficio_serial,
      descripcion,
      origen_id,
      requiere_respuesta,
      requires_response,
      tiene_recaudos,
      prioridad,
      documento_padre_id,
      recaudo_ids,
      recaudos,
      observacion
    } = req.body;

    const fechaValor = fecha_emision || fecha;
    const requiereRespuestaValor =
      requires_response !== undefined ? requires_response : requiere_respuesta;

    if (oficio_serial != null && String(oficio_serial).trim() !== "") {
      const serialDuplicado = await buscarDocumentoPorSerial(
        String(oficio_serial),
        documentoId
      );
      if (serialDuplicado) {
        res.status(409).json({
          error: "Ya existe un documento registrado con ese serial. No se puede guardar.",
        });
        return;
      }
    }

    const hayRecaudosEnBody = recaudo_ids !== undefined || recaudos !== undefined;
    let arrayRecaudos: number[] | null = null;
    let tieneRecaudosCalculado: boolean | null = null;
    if (hayRecaudosEnBody) {
      const resueltos = await resolverRecaudosSeleccionados(recaudo_ids, recaudos);
      arrayRecaudos = resueltos.ids;
      tieneRecaudosCalculado = resueltos.tieneRecaudos;
    }

    const file = req.file;
    let nuevaPdfUrl: string | undefined;
    let nuevoPdfNombre: string | undefined;
    let nuevoPdfPeso: number | undefined;

    // --- CAMBIO: Guardar el nuevo archivo localmente en disco si se adjunta uno nuevo ---
    if (file) {
      const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      // Asegurar que la carpeta uploads exista
      await fs.mkdir(uploadDir, { recursive: true });
      
      const absolutePath = path.join(uploadDir, fileName);
      filePathCreated = absolutePath;

      // Escribir el buffer del archivo en la ruta local
      await fs.writeFile(absolutePath, file.buffer);

      // Usar la URL absoluta del backend para evitar problemas con el frontend
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      nuevaPdfUrl = `${backendUrl}/uploads/${fileName}`;
      nuevoPdfNombre = file.originalname;
      nuevoPdfPeso = Math.round(file.size / 1024);
    }
    // ---------------------------------------------------------------------------------

    const documentoActualizado = await prisma.$transaction(async (tx) => {
      if (arrayRecaudos !== null) {
        await tx.documentosRecaudos.deleteMany({
          where: { documento_id: documentoId },
        });

        if (arrayRecaudos.length > 0) {
          await tx.documentosRecaudos.createMany({
            data: arrayRecaudos.map((recaudo_id) => ({
              documento_id: documentoId,
              recaudo_id: Number(recaudo_id),
            })),
          });
        }
      }

      return await tx.documentos.update({
        where: { id: documentoId },
        data: {
          observacion: observacion ?? undefined,
          fecha: fechaValor ? new Date(fechaValor) : undefined,
          oficio_tipo: oficio_tipo ?? undefined,
          oficio_serial: oficio_serial ?? undefined,
          descripcion: descripcion ?? undefined,
          origen_id: origen_id !== undefined ? Number(origen_id) : undefined,
          requiere_respuesta:
            requiereRespuestaValor !== undefined
              ? requiereRespuestaValor === "true" || requiereRespuestaValor === true
              : undefined,
          tiene_recaudos:
            tieneRecaudosCalculado !== null
              ? tieneRecaudosCalculado
              : tiene_recaudos !== undefined
              ? tiene_recaudos === "true" || tiene_recaudos === true
              : undefined,
          prioridad:
            prioridad !== undefined
              ? prioridad === "true" || prioridad === true
              : undefined,
          documento_padre_id:
            documento_padre_id !== undefined
              ? documento_padre_id
                ? BigInt(documento_padre_id)
                : null
              : undefined,
          ...(nuevaPdfUrl
            ? {
                pdf_url: nuevaPdfUrl,
                pdf_nombre_original: nuevoPdfNombre,
                pdf_peso_kb: nuevoPdfPeso,
              }
            : {}),
        },
        include: {
          origen: true,
          destino: true,
          usuario_registra: {
            select: { id: true, nombre: true, apellido: true, cedula: true },
          },
          recaudos: { include: { recaudo: true } },
        },
      });
    });

    res.json({
      message: "Documento actualizado correctamente",
      documento: serializeBigInt(documentoActualizado),
    });
  } catch (error) {
    // Si falla la transacción y se había creado un archivo nuevo, lo eliminamos
    if (filePathCreated) {
      try {
        await fs.unlink(filePathCreated);
      } catch (unlinkError) {
        console.error("No se pudo borrar el archivo local tras el fallo:", unlinkError);
      }
    }
    console.error("Error actualizando documento:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// DELETE /api/documentos/:id
export const eliminarDocumento = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { razon_eliminacion } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!razon_eliminacion || typeof razon_eliminacion !== "string" || !razon_eliminacion.trim()) {
      res.status(400).json({ error: "La razón de eliminación es requerida" });
      return;
    }

    let documentoId: bigint;
    try {
      documentoId = BigInt(id as string);
    } catch {
      res.status(400).json({ error: "ID de documento inválido" });
      return;
    }

    const documentoExistente = await prisma.documentos.findFirst({
      where: { id: documentoId, eliminado_at: null },
    });

    if (!documentoExistente) {
      res.status(404).json({ error: "Documento no encontrado o ya fue eliminado" });
      return;
    }

    const oficio_serial = documentoExistente.oficio_serial;
    const oficio_serial_anulado = `${oficio_serial}-ANULADO`;

    const documentoEliminado = await prisma.documentos.update({
      where: { id: documentoId },
      data: {
        oficio_serial: oficio_serial_anulado,
        estatus: "ANULADO",
        eliminado_at: new Date(),
        eliminado_por_usuario_id: Number(usuarioId),
        razon_eliminacion: razon_eliminacion.trim(),
      },
    });

    res.json({
      message: "Documento eliminado correctamente",
      documento: serializeBigInt(documentoEliminado),
    });
  } catch (error) {
    console.error("Error eliminando documento:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/documentos/:id/responder
export const responderDocumento = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  let fileNameCreated: string | null = null;

  try {
    const { id: documentoPadreIdStr } = req.params;
    const usuarioId = req.user?.id;
    const file = req.file;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "El archivo PDF es obligatorio" });
      return;
    }

    let documentoPadreId: bigint;
    try {
      documentoPadreId = BigInt(documentoPadreIdStr as string);
    } catch {
      res.status(400).json({ error: "ID de documento padre inválido" });
      return;
    }

    const documentoPadre = await prisma.documentos.findFirst({
      where: { id: documentoPadreId, eliminado_at: null },
    });

    if (!documentoPadre) {
      res.status(404).json({
        error: "El documento al que intenta responder no existe o fue eliminado",
      });
      return;
    }

    const {
      fecha,
      oficio_tipo = "RESPUESTA",
      oficio_serial,
      descripcion,
      origen_id,
      destino_id,
      requiere_respuesta = "false",
      tiene_recaudos = "false",
      prioridad = "false",
      recaudo_ids,
    } = req.body;

    if (!oficio_serial || !descripcion || !origen_id) {
      res.status(400).json({
        error: "Faltan campos obligatorios (oficio_serial, descripcion, origen_id)",
      });
      return;
    }

    const timestamp = Date.now();
    const nombreLimpio = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${timestamp}_RESPUESTA_${nombreLimpio}`;
    fileNameCreated = filePath;

    const { error: uploadError } = await supabase.storage
      .from("documentos-pdf")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error subiendo PDF a Supabase:", uploadError);
      res.status(500).json({ error: "Error subiendo el archivo PDF" });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("documentos-pdf")
      .getPublicUrl(filePath);

    let arrayRecaudos: number[] = [];
    if (recaudo_ids) {
      try {
        arrayRecaudos = typeof recaudo_ids === "string" ? JSON.parse(recaudo_ids) : recaudo_ids;
      } catch {
        arrayRecaudos = [];
      }
    }

    const documentoRespuesta = await prisma.$transaction(async (tx) => {
      const nuevoDoc = await tx.documentos.create({
        data: {
          fecha: fecha ? new Date(fecha) : new Date(),
          oficio_tipo,
          oficio_serial,
          descripcion,
          origen_id: Number(origen_id),
          destino_id: destino_id ? Number(destino_id) : null,
          requiere_respuesta: requiere_respuesta === "true" || requiere_respuesta === true,
          tiene_recaudos: tiene_recaudos === "true" || tiene_recaudos === true,
          prioridad: prioridad === "true" || prioridad === true,
          documento_padre_id: documentoPadreId,
          estatus: "RECIBIDO",
          pdf_url: publicUrlData.publicUrl,
          pdf_nombre_original: file.originalname,
          pdf_peso_kb: Math.round(file.size / 1024),
          registrado_idusuario: Number(usuarioId),
          recaudos: arrayRecaudos.length > 0 ? {
            create: arrayRecaudos.map((recaudo_id) => ({
              recaudo_id: Number(recaudo_id),
            })),
          } : undefined,
        },
      });

      await tx.historialEstatus.create({
        data: {
          documento_id: nuevoDoc.id,
          estatus_previo: null,
          estatus_nuevo: "RECIBIDO",
          usuario_id: Number(usuarioId),
        },
      });

      return nuevoDoc;
    });

    res.status(201).json({
      message: "Respuesta a documento registrada correctamente",
      documento_respuesta: serializeBigInt(documentoRespuesta),
    });
  } catch (error) {
    if (fileNameCreated) {
      await supabase.storage.from("documentos-pdf").remove([fileNameCreated]);
    }
    console.error("Error al registrar respuesta a documento:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /api/documentos/:id/confirmar-recepcion
export const confirmarRecepcionDepartamento = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const documentoId = BigInt(id as string);

    const documentoActual = await prisma.documentos.findUnique({
      where: { id: documentoId },
    });

    if (!documentoActual) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }

    const esRespuestaPorAval =
      Boolean(documentoActual.documento_padre_id) &&
      documentoActual.estatus === ESTATUS_ENVIADO_AVAL;

    const esRespuestaDevueltaAUnidad =
      Boolean(documentoActual.documento_padre_id) &&
      documentoActual.estatus === ESTATUS_DEVUELTO_UNIDAD;

    if (
      documentoActual.estatus !== "ASIGNADO" &&
      !esRespuestaPorAval &&
      !esRespuestaDevueltaAUnidad
    ) {
      res.status(400).json({
        error: "El documento no se encuentra en un estatus válido para confirmar recepción.",
      });
      return;
    }

    let departamentoOrigenRespuesta: number | null = null;
    if (esRespuestaDevueltaAUnidad) {
      const padre = await prisma.documentos.findUnique({
        where: { id: documentoActual.documento_padre_id! },
        select: { departamento_actual_id: true },
      });
      if (!padre?.departamento_actual_id) {
        res.status(400).json({
          error: "No se pudo determinar el departamento del documento original.",
        });
        return;
      }
      departamentoOrigenRespuesta = padre.departamento_actual_id;
    }

    const documentoActualizado = await prisma.$transaction(async (tx) => {
      if (esRespuestaPorAval) {
        const doc = await tx.documentos.update({
          where: { id: documentoId },
          data: {
            estatus: ESTATUS_PROCESO_DE_AVAL,
            departamento_actual_id: DEPARTAMENTO_DESPACHO_ID,
          },
          include: {
            origen: true,
            destino: true,
            departamento_actual: true,
            documento_padre: true,
            usuario_registra: { select: { id: true, nombre: true, apellido: true, cedula: true } },
          },
        });

        await tx.historialEstatus.create({
          data: {
            documento_id: documentoId,
            estatus_previo: documentoActual.estatus,
            estatus_nuevo: ESTATUS_PROCESO_DE_AVAL,
            usuario_id: Number(usuarioId),
          },
        });

        return doc;
      }

      if (esRespuestaDevueltaAUnidad && departamentoOrigenRespuesta != null) {
        const doc = await tx.documentos.update({
          where: { id: documentoId },
          data: {
            estatus: ESTATUS_AVALADO,
            departamento_actual_id: departamentoOrigenRespuesta,
          },
          include: {
            origen: true,
            destino: true,
            departamento_actual: true,
            documento_padre: true,
            usuario_registra: { select: { id: true, nombre: true, apellido: true, cedula: true } },
          },
        });

        await tx.historialEstatus.create({
          data: {
            documento_id: documentoId,
            estatus_previo: documentoActual.estatus,
            estatus_nuevo: ESTATUS_AVALADO,
            usuario_id: Number(usuarioId),
          },
        });

        return doc;
      }

      const doc = await tx.documentos.update({
        where: { id: documentoId },
        data: {
          estatus: "RECIBIDO_UNIDAD",
        },
        include: {
          origen: true,
          destino: true,
          departamento_actual: true,
          usuario_registra: { select: { id: true, nombre: true, apellido: true, cedula: true } },
        },
      });

      await tx.historialEstatus.create({
        data: {
          documento_id: documentoId,
          estatus_previo: documentoActual.estatus,
          estatus_nuevo: "RECIBIDO_UNIDAD",
          usuario_id: Number(usuarioId),
        },
      });

      return doc;
    });

    res.json({
      message: "Recepción confirmada con éxito",
      documento: serializeBigInt(documentoActualizado),
    });
  } catch (error) {
    console.error("Error al confirmar recepción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /api/documentos/:id/devolver-despacho
// PATCH /api/documentos/:id/devolver-despacho
export const devolverADespacho = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { confirmacion } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!confirmacion) {
      res.status(400).json({ error: "Debe confirmar la devolución" });
      return;
    }

    let documentoId: bigint;
    try {
      documentoId = BigInt(id as string);
    } catch {
      res.status(400).json({ error: "ID de documento inválido" });
      return;
    }

    const documentoActual = await prisma.documentos.findUnique({
      where: { id: documentoId },
    });

    if (!documentoActual) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }

    const documentoActualizado = await prisma.$transaction(async (tx) => {
      const doc = await tx.documentos.update({
        where: { id: documentoId },
        data: {
          estatus: "DEVUELTO_DESPACHO",
          // NOTA: No modificamos departamento_actual_id para que siga perteneciendo 
          // al departamento que hace la devolución hasta que Despacho lo confirme.
        },
        include: {
          origen: true,
          destino: true,
          departamento_actual: true,
          usuario_registra: { select: { id: true, nombre: true, apellido: true, cedula: true } },
        },
      });

      await tx.historialEstatus.create({
        data: {
          documento_id: documentoId,
          estatus_previo: documentoActual.estatus,
          estatus_nuevo: "DEVUELTO_DESPACHO",
          usuario_id: Number(usuarioId),
        },
      });

      return doc;
    });

    res.json({
      message: "Documento marcado como devuelto a despacho. Pendiente de confirmación.",
      documento: serializeBigInt(documentoActualizado),
    });
  } catch (error) {
    console.error("Error al devolver documento a despacho:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /api/documentos/:id/confirmar-devolucion
export const confirmarDevolucionDespacho = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    let documentoId: bigint;
    try {
      documentoId = BigInt(id as string);
    } catch {
      res.status(400).json({ error: "ID de documento inválido" });
      return;
    }
    
    const documentoActual = await prisma.documentos.findUnique({
      where: { id: documentoId }
    });

    if (!documentoActual) {
      res.status(404).json({ error: "El documento no existe." });
      return;
    }

    if (documentoActual.estatus !== "DEVUELTO_DESPACHO") {
      res.status(400).json({ error: "El documento no está marcado como devuelto a despacho." });
      return;
    }

    const documentoConfirmado = await prisma.$transaction(async (tx) => {
      const doc = await tx.documentos.update({
        where: { id: documentoId },
        data: {
          departamento_actual_id: 2,   
          estatus:"VISADO"
        },
        include: {
          origen: true,
          destino: true,
          departamento_actual: true,
          usuario_registra: { select: { id: true, nombre: true, apellido: true, cedula: true } },
        },
      });

      await tx.historialEstatus.create({
        data: {
          documento_id: documentoId,
          estatus_previo: documentoActual.estatus,
          estatus_nuevo: "VISADO",        
          usuario_id: Number(usuarioId),
        },
      });

      return doc;
    });

    res.json({
      message: "Devolución confirmada por despacho exitosamente.",
      documento: serializeBigInt(documentoConfirmado)
    });
  } catch (error) {
    console.error("Error al confirmar devolución:", error);
    res.status(500).json({ error: "Error interno al confirmar la devolución." });
  }
};

// PATCH /api/documentos/archivar
export const archivarDocumentos = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { ids } = req.body;
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "Debe proporcionar una lista de IDs de documentos" });
      return;
    }

    const documentoIds = ids.map((id: string | number) => BigInt(id));

    const documentosExistentes = await prisma.documentos.findMany({
      where: {
        id: { in: documentoIds },
        eliminado_at: null,
      },
      select: { id: true, estatus: true, oficio_serial: true },
    });

    if (documentosExistentes.length === 0) {
      res.status(404).json({ error: "No se encontraron documentos válidos" });
      return;
    }

    if (documentosExistentes.length !== documentoIds.length) {
      res.status(400).json({ error: "Uno o más documentos no existen o fueron eliminados" });
      return;
    }

    const noArchivables = documentosExistentes.filter(
      (doc) => doc.estatus !== "RECIBIDO_UNIDAD" && doc.estatus !== ESTATUS_TRAMITADO
    );
    if (noArchivables.length > 0) {
      res.status(400).json({
        error: `Solo se pueden archivar documentos en estatus RECIBIDO_UNIDAD o TRAMITADO. Revisar: ${noArchivables
          .map((d) => d.oficio_serial)
          .join(", ")}`,
      });
      return;
    }

    await prisma.$transaction([
      prisma.documentos.updateMany({
        where: { id: { in: documentoIds } },
        data: { estatus: ESTATUS_ARCHIVADO },
      }),
      prisma.historialEstatus.createMany({
        data: documentosExistentes.map((doc) => ({
          documento_id: doc.id,
          estatus_previo: doc.estatus,
          estatus_nuevo: ESTATUS_ARCHIVADO,
          usuario_id: Number(usuarioId),
        })),
      }),
    ]);

    res.json({
      message:
        documentosExistentes.length === 1
          ? "Documento archivado correctamente"
          : `Se archivaron ${documentosExistentes.length} documentos correctamente`,
    });
  } catch (error) {
    console.error("Error al archivar documentos:", error);
    res.status(500).json({ error: "Error interno del servidor al archivar documentos" });
  }
};