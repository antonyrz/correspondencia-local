import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// GET /api/roles
export const obtenerRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const roles = await prisma.roles.findMany({
      select: {
        id: true,
        nombre: true,
      },
      orderBy: { id: "asc" },
    });

    res.json({ roles });
  } catch (error) {
    console.error("Error al obtener los roles:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};