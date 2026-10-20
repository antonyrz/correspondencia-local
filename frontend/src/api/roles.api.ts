import { api } from './axios';

export interface Rol {
  id: number;
  nombre: string;
}

export const getRolesApi = async (): Promise<Rol[]> => {
  const { data } = await api.get('/roles');
  return Array.isArray(data) ? data : data.roles || [];
};