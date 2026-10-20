import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '../pages/Login';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';

// Páginas / Vistas
import { BandejaRecepcion } from '../pages/BandejaRecepcion';
import { BandejaDespacho } from '../pages/BandejaDespacho';
import { BandejaDepartamento } from '../pages/BandejaDepartamento';
import { NuevoDocumento } from '../pages/NuevoDocumento';
import { PerfilUsuario } from '../pages/PerfilUsuario';
import { MiUnidad } from '../pages/MiUnidad';
import { Anulados } from '../pages/Anulados';
import { BusquedaCorrespondencia } from '../pages/BusquedaCorrespondencia';
import { RespuestasDespacho } from '../pages/RespuestasDespacho';

export const AppRouter = () => {
  return (
    <Routes>
      {/* Ruta Pública */}
      <Route path="/login" element={<Login />} />

      {/* Rutas Protegidas Generales */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          
          {/* Rutas de Creación y Edición (Compartidas por Recepción y Despacho) */}
          <Route element={<ProtectedRoute allowedRoles={['administrador', 'recepcionista', 'jefe_recepcion', 'secretaria_despacho']} />}>
            <Route path="/documentos/crear" element={<NuevoDocumento />} />
            <Route path="/documentos/editar/:id" element={<NuevoDocumento />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['administrador', 'recepcionista', 'jefe_recepcion', 'secretaria_despacho', 'jefe_departamento']} />}>
            <Route path="/documentos/responder" element={<NuevoDocumento />} />
          </Route>

          {/* Rutas exclusivas de Recepción */}
          <Route element={<ProtectedRoute allowedRoles={['administrador', 'recepcionista', 'jefe_recepcion']} />}>
            <Route path="/recepcion/bandeja" element={<BandejaRecepcion />} />
          </Route>

          {/* Rutas exclusivas de Despacho */}
          <Route element={<ProtectedRoute allowedRoles={['administrador', 'secretaria_despacho']} />}>
            <Route path="/despacho/bandeja" element={<BandejaDespacho />} />
            <Route path="/despacho/respuestas" element={<RespuestasDespacho />} />
          </Route>

          {/* Ruta Mi Unidad */}
          <Route element={<ProtectedRoute allowedRoles={['secretaria_despacho', 'jefe_recepcion']} />}>
            <Route path="/unidad" element={<MiUnidad />} />
          </Route>

          {/* Rutas para Jefes de Departamento / Administrador */}
          <Route element={<ProtectedRoute allowedRoles={['administrador', 'jefe_departamento']} />}>
            <Route path="/departamento/bandeja" element={<BandejaDepartamento />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['administrador']} />}>
            <Route path="/anulados" element={<Anulados />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['administrador', 'jefe_recepcion']} />}>
            <Route path="/documentos/buscar" element={<BusquedaCorrespondencia />} />
          </Route>

          {/* Ruta de Perfil */}
          <Route path="/perfil" element={<PerfilUsuario />} />

        </Route>
      </Route>

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};