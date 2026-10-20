import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { User, ShieldCheck, Building2, Key, CheckCircle2, AlertCircle, X, Lock } from 'lucide-react';

export const PerfilUsuario = () => {
  // 1. Obtenemos el usuario autenticado desde el store de Zustand
  const usuario = useAuthStore((state) => state.user);

  // Estados para el Modal de actualización de contraseña
  const [modalAbierto, setModalAbierto] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  // Estados para el manejo de respuesta de la API
  const [cargando, setCargando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [mensajeError, setMensajeError] = useState('');

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError('');
    setMensajeExito('');

    if (nuevaPassword.length < 6) {
      setMensajeError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setMensajeError('Las nuevas contraseñas no coinciden.');
      return;
    }

    setCargando(true);

    try {
      // Aquí realizarás la petición a tu backend cuando conectes el endpoint de cambio de clave
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setMensajeExito('Contraseña actualizada con éxito.');
      setPasswordActual('');
      setNuevaPassword('');
      setConfirmarPassword('');

      setTimeout(() => {
        setModalAbierto(false);
        setMensajeExito('');
      }, 1500);
    } catch (error) {
      setMensajeError('Error al cambiar la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  // Si no hay usuario cargado en el store, muestra un mensaje breve
  if (!usuario) {
    return (
      <div className="p-6 text-slate-500 font-medium">
        No se encontró información del usuario activo.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mi Perfil</h1>
        <p className="text-sm text-slate-500">Información personal de tu cuenta de usuario.</p>
      </div>

      {/* Tarjeta de Datos del Usuario */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Banner Superior */}
        <div className="h-28 bg-linear-to-r from-blue-700 to-indigo-800 p-6 flex items-end"></div>

        <div className="px-6 pb-6 relative">
          {/* Avatar y Botón de Contraseña */}
          <div className="-mt-12 mb-4 flex justify-between items-end">
            <div className="w-24 h-24 rounded-2xl bg-white p-1.5 shadow-md">
              <div className="w-full h-full rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-3xl">
                {usuario.nombre ? usuario.nombre[0].toUpperCase() : 'U'}
              </div>
            </div>

            <button
              onClick={() => setModalAbierto(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <Key size={16} /> Actualizar Contraseña
            </button>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {usuario.nombre} {usuario.apellido}
            </h2>
            <p className="text-sm text-slate-500 font-semibold uppercase">
              {usuario.rol}
            </p>
          </div>

          <hr className="my-6 border-slate-100" />

          {/* Tarjetas de Información del Usuario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre Completo */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                <User size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Nombre Completo
                </p>
                <p className="text-base font-semibold text-slate-800 mt-0.5">
                  {usuario.nombre} {usuario.apellido}
                </p>
              </div>
            </div>

            {/* Cédula de Identidad */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Cédula de Identidad
                </p>
                <p className="text-base font-semibold text-slate-800 mt-0.5">
                  {usuario.cedula}
                </p>
              </div>
            </div>

            {/* Rol */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Rol Asignado
                </p>
                <p className="text-base font-semibold text-slate-800 mt-0.5 uppercase">
                  {usuario.rol || 'No asignado'}
                </p>
              </div>
            </div>

            {/* Departamento */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Departamento
                </p>
                <p className="text-base font-semibold text-slate-800 mt-0.5">
                  {usuario.departamento}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Actualizar Contraseña */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-800 text-lg">Actualizar Contraseña</h3>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCambiarPassword} className="p-6 space-y-4">
              {mensajeError && (
                <div className="p-3.5 rounded-xl bg-red-50 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{mensajeError}</span>
                </div>
              )}

              {mensajeExito && (
                <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm flex items-start gap-2">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <span>{mensajeExito}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  required
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {cargando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};