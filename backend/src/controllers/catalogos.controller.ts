import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// GET /api/catalogos/origenes-destinos
export const obtenerOrigenesDestinos = async (_req: Request, res: Response): Promise<void> => {
  try {
    const catalogos = await prisma.categorias.findMany({
      include: {
        origenDestinos: {
          select: {
            id: true,
            nombre: true,
          },
          orderBy: { nombre: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    });

    res.json({ catalogos });
  } catch (error) {
    console.error("Error al obtener categorías y orígenes/destinos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /api/catalogos/recaudos
export const obtenerRecaudos = async (_req: Request, res: Response): Promise<void> => {
  try {
    const recaudos = await prisma.recaudos.findMany({
      orderBy: { id: "asc" },
      select: { id: true, nombre: true },
    });
    res.json({ recaudos });
  } catch (error) {
    console.error("Error al obtener recaudos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const normalizarNombre = (nombre: string) => nombre.trim().replace(/\s+/g, " ");

const existeDuplicado = async (nombre: string, categoriaId: number, excludeId?: number) => {
  return prisma.origenDestino.findFirst({
    where: {
      categoria_id: categoriaId,
      nombre: { equals: nombre, mode: "insensitive" },
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
  });
};

// POST /api/catalogos/origenes-destinos
export const crearOrigenDestino = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const nombre = normalizarNombre(String(req.body.nombre ?? ""));
    const categoriaId = Number(req.body.categoria_id);

    if (!nombre) {
      res.status(400).json({ error: "El nombre del origen/destino es obligatorio" });
      return;
    }
    if (!categoriaId || Number.isNaN(categoriaId)) {
      res.status(400).json({ error: "Debe seleccionar la categoría" });
      return;
    }

    const categoria = await prisma.categorias.findUnique({ where: { id: categoriaId } });
    if (!categoria) {
      res.status(404).json({ error: "La categoría seleccionada no existe" });
      return;
    }

    const duplicado = await existeDuplicado(nombre, categoriaId);
    if (duplicado) {
      res.status(409).json({
        error: "Ya existe un origen/destino con ese nombre en la categoría seleccionada",
      });
      return;
    }

    const creado = await prisma.origenDestino.create({
      data: { nombre, categoria_id: categoriaId },
      include: { categoria: { select: { id: true, nombre: true } } },
    });

    res.status(201).json({
      message: "Origen/destino registrado correctamente",
      origenDestino: creado,
    });
  } catch (error) {
    console.error("Error creando origen/destino:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /api/catalogos/origenes-destinos/:id
export const actualizarOrigenDestino = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const nombre = normalizarNombre(String(req.body.nombre ?? ""));
    const categoriaId = Number(req.body.categoria_id);

    if (!id || Number.isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    if (!nombre) {
      res.status(400).json({ error: "El nombre del origen/destino es obligatorio" });
      return;
    }
    if (!categoriaId || Number.isNaN(categoriaId)) {
      res.status(400).json({ error: "Debe seleccionar la categoría" });
      return;
    }

    const existente = await prisma.origenDestino.findUnique({ where: { id } });
    if (!existente) {
      res.status(404).json({ error: "Origen/destino no encontrado" });
      return;
    }

    const categoria = await prisma.categorias.findUnique({ where: { id: categoriaId } });
    if (!categoria) {
      res.status(404).json({ error: "La categoría seleccionada no existe" });
      return;
    }

    const usados = await prisma.documentos.count({
      where: {
        OR: [{ origen_id: id }, { destino_id: id }],
      },
    });

    // Si ya hay documentos vinculados, se crea un registro nuevo y se deja el original intacto
    if (usados > 0) {
      const duplicado = await existeDuplicado(nombre, categoriaId);
      if (duplicado) {
        res.status(409).json({
          error: "Ya existe un origen/destino con ese nombre en la categoría seleccionada",
        });
        return;
      }

      const creado = await prisma.origenDestino.create({
        data: { nombre, categoria_id: categoriaId },
        include: { categoria: { select: { id: true, nombre: true } } },
      });

      res.json({
        message:
          "Este origen/destino ya está en correspondencias. Se creó uno nuevo para no alterar documentos existentes.",
        modo: "nuevo_por_uso",
        origenDestino: creado,
      });
      return;
    }

    const duplicado = await existeDuplicado(nombre, categoriaId, id);
    if (duplicado) {
      res.status(409).json({
        error: "Ya existe un origen/destino con ese nombre en la categoría seleccionada",
      });
      return;
    }

    const actualizado = await prisma.origenDestino.update({
      where: { id },
      data: { nombre, categoria_id: categoriaId },
      include: { categoria: { select: { id: true, nombre: true } } },
    });

    res.json({
      message: "Origen/destino actualizado correctamente",
      modo: "actualizado",
      origenDestino: actualizado,
    });
  } catch (error) {
    console.error("Error actualizando origen/destino:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};