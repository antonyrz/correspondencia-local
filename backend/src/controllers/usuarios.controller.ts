import { Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// GET /api/usuarios - Listar todos los usuarios
export const listarUsuarios = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const usuarios = await prisma.usuarios.findMany({
      select: {
        id: true,
        nombre: true,
        apellido: true,
        cedula: true,
        rol_usuario: true,
        activo: true,
        fecha_registro: true,
        creado_por: true,
        roles: {
          select: {
            id: true,
            nombre: true,
          },
        },
        departamento: {
          select: {
            id: true,
            nombre: true,
          },
        },
        creador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    res.json({ usuarios });
  } catch (error) {
    console.error("Error al listar usuarios:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /api/usuarios - Crear nuevo usuario (Solo Admin)
export const crearUsuario = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { nombre, apellido, cedula, password, rol_usuario, departamento_id } =
      req.body;

    if (
      !nombre ||
      !apellido ||
      !cedula ||
      !password ||
      !rol_usuario ||
      !departamento_id
    ) {
      res.status(400).json({ error: "Todos los campos son obligatorios" });
      return;
    }

    // Verificar si la cédula ya está registrada
    const usuarioExistente = await prisma.usuarios.findFirst({
      where: { cedula },
    });

    if (usuarioExistente) {
      res.status(400).json({ error: "La cédula ya se encuentra registrada" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Obtener ID del admin creador desde la request autenticada
    const creadorId = req.user?.id;

    const nuevoUsuario = await prisma.usuarios.create({
      data: {
        nombre,
        apellido,
        cedula,
        password: hashedPassword,
        rol_usuario: Number(rol_usuario),
        departamento_id: Number(departamento_id),
        creado_por: creadorId ? Number(creadorId) : null, // Guarda quién lo creó
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        cedula: true,
        rol_usuario: true,
        departamento_id: true,
        roles: {
          select: {
            id: true,
            nombre: true,
          },
        },
        departamento: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Usuario creado exitosamente",
      usuario: nuevoUsuario,
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /api/usuarios/:id/estado - Activar/Desactivar Usuario (Solo Admin)
export const cambiarEstadoUsuario = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== "boolean") {
      res.status(400).json({ error: "El campo 'activo' debe ser un booleano (true/false)" });
      return;
    }

    const usuarioId = Number(id);

    // Evitar que el admin se desactive a sí mismo
    if (usuarioId === req.user?.id) {
      res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });
      return;
    }

    const usuario = await prisma.usuarios.update({
      where: { id: usuarioId },
      data: { activo },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        cedula: true,
        activo: true,
      },
    });

    res.json({
      message: `Usuario ${activo ? "activado" : "desactivado"} correctamente`,
      usuario,
    });
  } catch (error) {
    console.error("Error al cambiar estado del usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /api/usuarios/:id/reset-password - Restablecer Clave (Solo Admin)
export const resetearPasswordUsuario = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { nueva_password } = req.body;

    if (!nueva_password || nueva_password.length < 6) {
      res.status(400).json({
        error: "La nueva contraseña debe contener al menos 6 caracteres",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(nueva_password, 10);

    await prisma.usuarios.update({
      where: { id: Number(id) },
      data: { password: hashedPassword },
    });

    res.json({ message: "Contraseña del usuario restablecida con éxito" });
  } catch (error) {
    console.error("Error al restablecer contraseña del usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};