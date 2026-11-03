import { api } from './axios';

export interface CrearUsuarioPayload {
  nombre: string;
  apellido: string;
  cedula: string;
  password: string;
  rol_usuario: number;
  departamento_id: number;
}

export interface ResetearPasswordPayload {
  id: number;
  nueva_password: string;
}

export const crearUsuarioApi = async (payload: CrearUsuarioPayload) => {
  const { data } = await api.post('/usuarios', payload);
  return data;
};

export const resetearPasswordUsuario = async (payload: ResetearPasswordPayload) => {
  const { data } = await api.patch(`/usuarios/${payload.id}/reset-password`, payload);
  return data;
};