// src/api/departamentos.api.ts
import { api } from './axios';

export interface Departamento {
  id: number;
  nombre: string;
  descripcion?: string;
}

export const getDepartamentosApi = async (): Promise<Departamento[]> => {
  const { data } = await api.get<{departamentos: Departamento[]}>('/departamentos');
  return data.departamentos;
};