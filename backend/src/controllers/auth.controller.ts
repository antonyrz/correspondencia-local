import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cedula, password } = req.body;

    if (!cedula || !password) {
      res.status(400).json({ error: "Cédula y contraseña son requeridas" });
      return;
    }

    const usuario = await prisma.usuarios.findFirst({
      where: { cedula },
      include: {
        departamento: true,
        roles: true,
      },
    });

    if (!usuario) {
      res.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    // Verificar la contraseña encriptada
    const match = await bcrypt.compare(password, usuario.password);
    if (!match) {
      res.status(401).json({ error: "Credenciales inválidas" });
      return;
    }

    // Generar Token JWT con rol como String
    const token = jwt.sign(
      {
        id: usuario.id,
        rol: usuario.roles?.nombre || "usuario", // Nombre del rol para el middleware y controladores
        rol_id: usuario.rol_usuario, // Mantener el ID del rol por conveniencia si se requiere
        departamento_id: usuario.departamento_id,
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "8h" }
    );

    res.json({
      message: "Inicio de sesión exitoso",
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        cedula: usuario.cedula,
        rol: usuario.roles?.nombre || "Sin rol",
        departamento_id: usuario.departamento_id,
        departamento: usuario.departamento?.nombre || "Sin departamento",
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /api/auth/me
export const obtenerPerfil = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
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

    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json({
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        cedula: usuario.cedula,
        rol: usuario.roles?.nombre || "Sin rol",
        departamento_id: usuario.departamento_id,
        departamento: usuario.departamento?.nombre || "Sin departamento",
      },
    });
  } catch (error) {
    console.error("Error obteniendo perfil del usuario:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /api/auth/cambiar-password
export const cambiarPassword = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    const { password_actual, nueva_password } = req.body;

    if (!usuarioId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    if (!password_actual || !nueva_password) {
      res.status(400).json({
        error: "Se requiere la contraseña actual y la nueva contraseña",
      });
      return;
    }

    if (nueva_password.length < 6) {
      res.status(400).json({
        error: "La nueva contraseña debe tener al menos 6 caracteres",
      });
      return;
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const match = await bcrypt.compare(password_actual, usuario.password);
    if (!match) {
      res.status(400).json({ error: "La contraseña actual es incorrecta" });
      return;
    }

    const hashedNewPassword = await bcrypt.hash(nueva_password, 10);

    await prisma.usuarios.update({
      where: { id: usuarioId },
      data: {
        password: hashedNewPassword,
      },
    });

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};