import { api } from './axios';

export interface CatalogItem {
  id: number;
  nombre: string;
}

export interface CategoriaCatalog {
  id: number;
  nombre: string;
  origenDestinos: CatalogItem[];
}

export interface CatalogsResponse {
  catalogos: CategoriaCatalog[];
}

export const getCatalogs = async (): Promise<CatalogsResponse> => {
  const { data } = await api.get<CatalogsResponse>('/catalogos/origenes-destinos');
  return data;
};

export interface RecaudoCatalog {
  id: number;
  nombre: string;
}

export const getRecaudos = async (): Promise<RecaudoCatalog[]> => {
  const { data } = await api.get<{ recaudos: RecaudoCatalog[] }>('/catalogos/recaudos');
  return Array.isArray(data) ? data : data.recaudos || [];
};

export const createDocumento = async (formData: FormData) => {
  const { data } = await api.post('/documentos', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

/** Verifica si el oficio_serial ya está registrado. En edición, pasar excludeId del documento actual. */
export const verificarSerialDocumento = async (
  oficio_serial: string,
  excludeId?: string | number
): Promise<{ existe: boolean; oficio_serial: string }> => {
  const { data } = await api.get('/documentos/verificar-serial', {
    params: {
      oficio_serial: oficio_serial.trim(),
      ...(excludeId != null && String(excludeId) !== ''
        ? { exclude_id: excludeId }
        : {}),
    },
  });
  return data;
};

export const actualizarDocumento = async (id: string, formData: FormData) => {
  const { data } = await api.put(`/documentos/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};


export const eliminarDocumento = async (id: string, razon_eliminacion: string) => {
  const { data } = await api.delete(`/documentos/${id}`, {
    data: { razon_eliminacion },
  });
  return data;
};

export type GetDocumentosParams = {
  page?: number;
  limit?: number;
  departamento_actual_id?: number;
  estatus?: string;
};

/** Tamaño de cada petición al recorrer todas las páginas (evita timeouts) */
const LOTE_CARGA_API = 500;

const extraerListaDocumentos = (res: unknown): any[] => {
  if (Array.isArray(res)) return res;
  const r = res as { data?: unknown };
  if (Array.isArray(r?.data)) return r.data;
  const nested = r?.data as { data?: unknown } | undefined;
  if (Array.isArray(nested?.data)) return nested.data;
  return [];
};

/** Lista una página de documentos. */
export const getDocumentos = async (params?: GetDocumentosParams) => {
  const response = await api.get('/documentos', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? LOTE_CARGA_API,
      ...(params?.departamento_actual_id != null && {
        departamento_actual_id: params.departamento_actual_id,
      }),
      ...(params?.estatus ? { estatus: params.estatus } : {}),
    },
  });
  return response.data;
};

/**
 * Trae TODOS los documentos sin tope artificial, en lotes de 500.
 * Úsalo en bandejas que filtran/buscan/paginan en el cliente.
 */
export const obtenerTodosDocumentos = async (
  params?: Omit<GetDocumentosParams, 'page' | 'limit'>
): Promise<any[]> => {
  let pagina = 1;
  let acumulados: any[] = [];
  let total = Number.POSITIVE_INFINITY;

  while (acumulados.length < total) {
    const res = await getDocumentos({ ...params, page: pagina, limit: LOTE_CARGA_API });
    const lista = extraerListaDocumentos(res);
    const metaTotal = (res as { meta?: { total_registros?: number } })?.meta?.total_registros;

    if (typeof metaTotal === 'number') {
      total = metaTotal;
    } else if (lista.length < LOTE_CARGA_API) {
      total = acumulados.length + lista.length;
    }

    acumulados = acumulados.concat(lista);
    if (lista.length === 0) break;
    pagina += 1;
  }

  return acumulados;
};

export const listarDocumentosAnulados = async (params?: { page?: number; limit?: number }) => {
  const response = await api.get('/documentos/anulados', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? LOTE_CARGA_API,
    },
  });
  return response.data;
};

/** Trae TODOS los anulados sin tope, en lotes de 500. */
export const obtenerTodosDocumentosAnulados = async (): Promise<any[]> => {
  let pagina = 1;
  let acumulados: any[] = [];
  let total = Number.POSITIVE_INFINITY;

  while (acumulados.length < total) {
    const res = await listarDocumentosAnulados({ page: pagina, limit: LOTE_CARGA_API });
    const lista = extraerListaDocumentos(res);
    const metaTotal = (res as { meta?: { total_registros?: number } })?.meta?.total_registros;

    if (typeof metaTotal === 'number') {
      total = metaTotal;
    } else if (lista.length < LOTE_CARGA_API) {
      total = acumulados.length + lista.length;
    }

    acumulados = acumulados.concat(lista);
    if (lista.length === 0) break;
    pagina += 1;
  }

  return acumulados;
};
  
export const enviarDocumentosADespacho = async (ids: string[]) => {
  const response = await api.post('/documentos/enviar-documentos-despacho', { ids });
  return response.data;
};

export const enviarRespuestasPorAval = async (ids: string[]) => {
  const response = await api.post('/documentos/enviar-respuestas-aval', {
    ids,
    departamento_despacho_id: 2,
  });
  return response.data;
};

export const avalarRespuestas = async (ids: Array<string | number>) => {
  const { data } = await api.post('/documentos/avalar-respuestas', { ids });
  return data;
};

export const devolverRespuestasAvaladas = async (ids: Array<string | number>) => {
  const { data } = await api.post('/documentos/devolver-respuestas-avaladas', { ids });
  return data;
};

export const tramitarDocumentos = async (ids: Array<string | number>) => {
  const { data } = await api.patch('/documentos/tramitar', { ids });
  return data;
};

export const enviarDocumentosADestino = async (idDocumentos: string[], idDestino: number) => {
  const response = await api.post('/documentos/enviar-documentos-destino', { idDocumentos, idDestino });
  return response.data;
};

// Obtener un solo documento completo para el Modal de Detalles
export const getDocumentoDetalle = async (id: string) => {
  const response = await api.get(`/documentos/${id}`);
  return response.data;
};

export const cambiarEstatusDocumento = async (
  id: number | string, 
  estatus: string, 
  departamento_id?: number
) => {
  const { data } = await api.patch(`/documentos/${id}/estatus`, {
    estatus,
    ...(departamento_id && { departamento_id })
  });
  
  return data;
};

export const confirmarRecepcionDepartamento = async (id: string | number) => {
  const { data } = await api.patch(`/documentos/${id}/confirmar-recepcion`);
  return data;
};

export const devolverADespacho = async (id: string | number, motivo: string) => {
  const { data } = await api.patch(`/documentos/${id}/devolver-despacho`, { motivo });
  return data;
};

export const confirmarDevolucionDespacho = async (id: string | number) => {
  const { data } = await api.patch(`/documentos/${id}/confirmar-devolucion`);
  return data;
};

export const archivarDocumentos = async (ids: Array<string | number>) => {
  const { data } = await api.patch('/documentos/archivar', { ids });
  return data;
};