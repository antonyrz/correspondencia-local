import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// GET /api/departamentos
export const listarDepartamentos = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const departamentos = await prisma.departamentos.findMany({
      orderBy: { nombre: "asc" },
    });

    res.json({ departamentos });
  } catch (error) {
    console.error("Error al listar departamentos:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};