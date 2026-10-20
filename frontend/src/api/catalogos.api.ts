import { api } from './axios';
import type { CatalogsResponse } from './documentos.api';

export const getCatalogosOrigenDestino = async (): Promise<CatalogsResponse> => {
  const { data } = await api.get<CatalogsResponse>('/catalogos/origenes-destinos');
  return data;
};

export const crearOrigenDestinoApi = async (payload: {
  nombre: string;
  categoria_id: number;
}) => {
  const { data } = await api.post('/catalogos/origenes-destinos', payload);
  return data;
};

export const actualizarOrigenDestinoApi = async (
  id: number,
  payload: { nombre: string; categoria_id: number }
) => {
  const { data } = await api.put(`/catalogos/origenes-destinos/${id}`, payload);
  return data;
};
