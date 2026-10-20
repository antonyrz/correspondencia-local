import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import authRoutes from "./routes/auth.routes";
import documentosRoutes from "./routes/documentos.routes";
import usuariosRoutes from "./routes/usuarios.routes";
import departamentosRoutes from "./routes/departamentos.routes";
import catalogosRoutes from "./routes/catalogos.routes";
import rolesRoutes from "./routes/roles.routes"; 
const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/documentos", documentosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/departamentos", departamentosRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/roles", rolesRoutes); 

app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", message: "Servidor corriendo correctamente" });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});