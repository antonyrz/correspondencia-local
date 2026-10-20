import { api } from './axios';

export interface CrearUsuarioPayload {
  nombre: string;
  apellido: string;
  cedula: string;
  password: string;
  rol_usuario: number;
  departamento_id: number;
}

export const crearUsuarioApi = async (payload: CrearUsuarioPayload) => {
  const { data } = await api.post('/usuarios', payload);
  return data;
};