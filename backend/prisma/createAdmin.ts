import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  // 1. Obtener el ID del departamento inicial ("Recursos Humanos")
  const departamento = await prisma.departamentos.findFirst({
    where: { nombre: "Recursos Humanos" },
  });

  if (!departamento) {
    console.error("❌ No se encontró el departamento de Recursos Humanos. Ejecuta primero 'npx prisma db seed'.");
    return;
  }

  // 2. Encriptar contraseña
  const passwordHash = await bcrypt.hash("admin123", 10);

  // 3. Crear el usuario en la base de datos
  const usuario = await prisma.usuarios.create({
    data: {
      nombre: "Antony",
      apellido: "Hernandez",
      cedula: "V30172049",
      password: passwordHash,
      rol_usuario: "admin",
      departamento_id: departamento.id,
    },
  });

  console.log("✅ Usuario Administrador creado con éxito:");
  console.log(` Cédula: ${usuario.cedula}`);
  console.log(` Contraseña: admin123`);
}

main()
  .catch((e) => {
    console.error("Error al crear usuario:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });