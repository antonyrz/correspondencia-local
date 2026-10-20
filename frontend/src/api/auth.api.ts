import { api } from './axios';

export interface LoginPayload {
  cedula: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  usuario: {
    id: number;
    cedula: string;
    nombre: string;
    apellido: string;
    departamento: string
    rol: string;
  };
}

export const loginRequest = async (credentials: LoginPayload): Promise<LoginResponse> => {
  const { data } = await api.post<LoginResponse>('/auth/login', credentials);
  return data;
};