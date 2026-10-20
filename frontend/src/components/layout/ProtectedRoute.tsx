import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const context = useOutletContext();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  // 1. Si no hay token o usuario, redirige al Login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const rolUsuario = (user.rol || '').toLowerCase().trim();

  // 2. Si la ruta requiere roles específicos y el usuario no los cumple
  if (allowedRoles && allowedRoles.length > 0) {
    const tienePermiso = allowedRoles.some(
      (rol) => rol.toLowerCase().trim() === rolUsuario
    );

    if (!tienePermiso) {
      // Redirección forzada según su rol actual para bloquear el acceso ilegal
      if (rolUsuario === 'recepcionista' || rolUsuario === "jefe_recepcion") {
        return <Navigate to="/recepcion/bandeja" replace />;
      }
      if (rolUsuario === 'secretaria_despacho' || rolUsuario === 'administrador') {
        return <Navigate to="/despacho/bandeja" replace />;
      }
      if (rolUsuario === 'jefe_departamento') {
        return <Navigate to="/departamento/bandeja" replace />;
      }
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet context={context} />;
};