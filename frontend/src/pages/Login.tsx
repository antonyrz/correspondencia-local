import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { loginRequest } from '../api/auth.api';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn } from 'lucide-react';

const loginSchema = z.object({
  tipoCedula: z.enum(['V', 'E']),
  numeroCedula: z.string().min(6, { message: 'La cédula debe tener al menos 6 dígitos' }),
  password: z.string().min(1, { message: 'La contraseña es requerida' }),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Login = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tipoCedula: 'V',
    },
  });

  const onSubmit = async (values: LoginForm) => {
    try {
      setLoading(true);
      setErrorApi(null);
      
      const cedulaCompleta = `${values.tipoCedula}${values.numeroCedula}`;
      const res = await loginRequest({
        cedula: cedulaCompleta,
        password: values.password,
      });

      // Guarda usuario y token en el store de Zustand
      setAuth(res.usuario, res.token);
      // Normalizar el nombre del rol recibido desde el backend
      const rol = (res.usuario.rol || '').toLowerCase().trim();

      // Redirección dinámica según el rol exacto
      if (rol === 'recepcionista' || rol === 'jefe_recepcion') {
        navigate('/recepcion/bandeja');
      } else if (rol === 'secretaria_despacho' || rol === 'administrador') {
        navigate('/despacho/bandeja');
      } else if (rol === 'jefe_departamento') {
        navigate('/departamento/bandeja');
      } else {
        // Fallback en caso de que sea otro rol
        navigate('/despacho/bandeja');
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al iniciar sesión');
      } else {
        setErrorApi('Error inesperado del servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-2">
            <LogIn size={28} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Sistema de Correspondencia</h2>
          <p className="text-slate-500 text-sm">Ingresa tus credenciales para acceder</p>
        </div>

        {errorApi && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">
            {errorApi}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cédula de Identidad</label>
            <div className="flex gap-2">
              <select
                {...register('tipoCedula')}
                className="w-20 px-3 py-2 border rounded-lg border-slate-300 bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="V">V-</option>
                <option value="E">E-</option>
              </select>

              <div className="w-full">
                <input
                  type="number"
                  {...register('numeroCedula')}
                  className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="12345678"
                />
              </div>
            </div>
            {errors.numeroCedula && (
              <p className="text-red-500 text-xs mt-1">{errors.numeroCedula.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input
              type="password"
              {...register('password')}
              className="w-full px-3 py-2 border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};