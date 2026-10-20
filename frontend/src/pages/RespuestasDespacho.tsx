import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
  ExternalLink,
  User,
  Clock,
  CheckSquare,
  ShieldAlertIcon,
  Paperclip,
  MessageSquarePlus,
  Stamp,
  RotateCcw,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import {
  obtenerTodosDocumentos,
  confirmarRecepcionDepartamento,
  avalarRespuestas,
  devolverRespuestasAvaladas,
  getDocumentoDetalle,
} from '../api/documentos.api';
import { Paginacion } from '../components/ui/Paginacion';
import { ITEMS_POR_PAGINA, paginarLista } from '../utils/paginacion';

interface OrigenDestino {
  id: number;
  nombre: string;
}

interface DocumentoPadre {
  id: string;
  oficio_serial: string;
  oficio_tipo: string;
  descripcion: string;
  estatus?: string;
  departamento_actual_id?: number | null;
  departamento_actual?: OrigenDestino | null;
}

interface Documento {
  id: string;
  oficio_serial: string;
  oficio_tipo: string;
  descripcion: string;
  estatus: string;
  fecha: string;
  prioridad: boolean;
  pdf_url?: string;
  origen: OrigenDestino;
  destino?: OrigenDestino | null;
  departamento_actual_id?: number | null;
  departamento_actual?: OrigenDestino | null;
  documento_padre_id?: string | number | null;
  documento_padre?: DocumentoPadre | null;
  usuario_registra?: {
    nombre: string;
    apellido: string;
  };
  recaudos?: Array<{ id: string; recaudo: { nombre: string } }>;
  observacion: string;
}

const ESTATUS_CONFIG: Record<string, { label: string; color: string }> = {
  POR_AVALAR: { label: 'POR AVALAR', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  ENVIADO_AVAL: { label: 'POR RECEPCIONAR', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  RECIBIDO_AVAL: { label: 'RECIBIDO EN DESPACHO', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  PROCESO_DE_AVAL: { label: 'EN PROCESO DE AVAL', color: 'bg-violet-100 text-violet-800 border-violet-300' },
  AVALADO: { label: 'AVALADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  DEVUELTO_UNIDAD: {
    label: 'DEVUELTO A UNIDAD (PENDIENTE)',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
};

const ESTATUS_EN_DESPACHO = ['ENVIADO_AVAL', 'PROCESO_DE_AVAL', 'AVALADO', 'DEVUELTO_UNIDAD'] as const;
const DEPARTAMENTO_DESPACHO_ID = 2;
type EstatusEnDespacho = (typeof ESTATUS_EN_DESPACHO)[number];
type EstatusSeleccionable = 'ENVIADO_AVAL' | 'PROCESO_DE_AVAL' | 'AVALADO';

export const RespuestasDespacho = () => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [filtroEstatus, setFiltroEstatus] = useState<'TODOS' | EstatusSeleccionable>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [loadingRecepcion, setLoadingRecepcion] = useState(false);
  const [loadingAvalar, setLoadingAvalar] = useState(false);
  const [loadingDevolver, setLoadingDevolver] = useState(false);

  const scrollSuperiorRef = useRef<HTMLDivElement>(null);
  const scrollTablaRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLTableElement>(null);
  const [anchoTabla, setAnchoTabla] = useState(0);

  const cargarDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      setErrorApi(null);
      const lista = await obtenerTodosDocumentos();
      setDocumentos(lista);
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al obtener respuestas');
      } else {
        setErrorApi('Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  useEffect(() => {
    setSeleccionados([]);
    setPaginaActual(1);
  }, [filtroEstatus, busqueda]);

  const respuestasDespacho = documentos.filter((doc) => {
    if (!doc.documento_padre_id || !ESTATUS_EN_DESPACHO.includes(doc.estatus as EstatusEnDespacho)) {
      return false;
    }
    if (doc.estatus === 'ENVIADO_AVAL') return true;
    const deptoActual = Number(doc.departamento_actual_id ?? doc.departamento_actual?.id);
    return deptoActual === DEPARTAMENTO_DESPACHO_ID;
  });

  const documentosFiltrados = respuestasDespacho.filter((doc) => {
    const coincideEstatus = filtroEstatus === 'TODOS' ? true : doc.estatus === filtroEstatus;
    const termino = busqueda.toLowerCase();
    const coincideBusqueda =
      (doc.oficio_serial?.toLowerCase() || '').includes(termino) ||
      (doc.origen?.nombre?.toLowerCase() || '').includes(termino) ||
      (doc.descripcion?.toLowerCase() || '').includes(termino) ||
      (doc.documento_padre?.oficio_serial?.toLowerCase() || '').includes(termino) ||
      (doc.documento_padre?.departamento_actual?.nombre?.toLowerCase() || '').includes(termino);

    return coincideEstatus && coincideBusqueda;
  });

  const {
    items: documentosPaginados,
    totalPaginas,
    paginaActual: paginaSegura,
    totalItems,
  } = paginarLista(documentosFiltrados, paginaActual, ITEMS_POR_PAGINA);

  useEffect(() => {
    const medir = () => {
      setAnchoTabla(tablaRef.current?.scrollWidth || 0);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [documentosPaginados, loading]);

  const sincronizarDesdeArriba = () => {
    if (scrollTablaRef.current && scrollSuperiorRef.current) {
      scrollTablaRef.current.scrollLeft = scrollSuperiorRef.current.scrollLeft;
    }
  };

  const sincronizarDesdeTabla = () => {
    if (scrollTablaRef.current && scrollSuperiorRef.current) {
      scrollSuperiorRef.current.scrollLeft = scrollTablaRef.current.scrollLeft;
    }
  };

  const documentosPorRecepcionarSeleccionados = documentos.filter(
    (doc) => seleccionados.includes(doc.id) && doc.estatus === 'ENVIADO_AVAL'
  );
  const documentosPorAvalarSeleccionados = documentos.filter(
    (doc) => seleccionados.includes(doc.id) && doc.estatus === 'PROCESO_DE_AVAL'
  );
  const documentosAvaladosSeleccionados = documentos.filter(
    (doc) => seleccionados.includes(doc.id) && doc.estatus === 'AVALADO'
  );
  const tipoSeleccionActivo: EstatusSeleccionable | null =
    documentosPorRecepcionarSeleccionados.length > 0
      ? 'ENVIADO_AVAL'
      : documentosPorAvalarSeleccionados.length > 0
      ? 'PROCESO_DE_AVAL'
      : documentosAvaladosSeleccionados.length > 0
      ? 'AVALADO'
      : null;
  const documentosSeleccionables = documentosPaginados.filter((doc) => {
    if (!ESTATUS_EN_DESPACHO.includes(doc.estatus as EstatusSeleccionable)) return false;
    if (tipoSeleccionActivo) return doc.estatus === tipoSeleccionActivo;
    return true;
  });
  const tiposEnPagina = new Set(
    documentosPaginados
      .filter((doc) => ESTATUS_EN_DESPACHO.includes(doc.estatus as EstatusSeleccionable))
      .map((doc) => doc.estatus)
  );
  const selectAllDeshabilitado =
    documentosSeleccionables.length === 0 || (!tipoSeleccionActivo && tiposEnPagina.size > 1);
  const todosSeleccionadosEnPagina =
    documentosSeleccionables.length > 0 &&
    documentosSeleccionables.every((doc) => seleccionados.includes(doc.id));

  const handleSelectAll = () => {
    if (selectAllDeshabilitado) return;
    const idsPagina = documentosSeleccionables.map((d) => d.id);
    if (todosSeleccionadosEnPagina) {
      setSeleccionados((prev) => prev.filter((id) => !idsPagina.includes(id)));
    } else {
      setSeleccionados((prev) => [...new Set([...prev, ...idsPagina])]);
    }
  };

  const handleSelectOne = (id: string) => {
    const docAAlternar = documentos.find((d) => d.id === id);
    if (!docAAlternar) return;
    if (!ESTATUS_EN_DESPACHO.includes(docAAlternar.estatus as EstatusSeleccionable)) return;
    if (tipoSeleccionActivo && docAAlternar.estatus !== tipoSeleccionActivo) return;

    if (seleccionados.includes(id)) {
      setSeleccionados(seleccionados.filter((item) => item !== id));
    } else {
      setSeleccionados([...seleccionados, id]);
    }
  };

  const handleConfirmarRecepcion = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      setLoadingRecepcion(true);
      setErrorApi(null);
      await Promise.all(ids.map((id) => confirmarRecepcionDepartamento(id)));
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => !ids.includes(id)));
      if (documentoSeleccionado && ids.includes(documentoSeleccionado.id)) {
        setDocumentoSeleccionado(null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al confirmar recepción');
      } else {
        setErrorApi('Error de conexión al confirmar recepción');
      }
    } finally {
      setLoadingRecepcion(false);
    }
  };

  const handleAvalar = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      setLoadingAvalar(true);
      setErrorApi(null);
      await avalarRespuestas(ids);
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => !ids.includes(id)));
      if (documentoSeleccionado && ids.includes(documentoSeleccionado.id)) {
        setDocumentoSeleccionado(null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al marcar como AVALADO');
      } else {
        setErrorApi('Error de conexión al marcar como AVALADO');
      }
    } finally {
      setLoadingAvalar(false);
    }
  };

  const handleDevolverAUnidad = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      setLoadingDevolver(true);
      setErrorApi(null);
      await devolverRespuestasAvaladas(ids);
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => !ids.includes(id)));
      if (documentoSeleccionado && ids.includes(documentoSeleccionado.id)) {
        setDocumentoSeleccionado(null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al devolver la respuesta a la unidad');
      } else {
        setErrorApi('Error de conexión al devolver la respuesta a la unidad');
      }
    } finally {
      setLoadingDevolver(false);
    }
  };

  const abrirDetalle = async (doc: Documento) => {
    setDocumentoSeleccionado(doc);
    try {
      const detalle = await getDocumentoDetalle(doc.id);
      setDocumentoSeleccionado(detalle);
    } catch {
      // Se muestra el documento de la lista si el detalle no carga
    }
  };

  const cantPorRecep = respuestasDespacho.filter((d) => d.estatus === 'ENVIADO_AVAL').length;
  const cantRecibidas = respuestasDespacho.filter((d) => d.estatus === 'PROCESO_DE_AVAL').length;
  const cantAvaladas = respuestasDespacho.filter((d) => d.estatus === 'AVALADO').length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Respuestas</h1>
            <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-700 font-semibold text-xs rounded-full">
              {respuestasDespacho.length} enviadas a Despacho
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Respuestas enviadas por las unidades para aval de Despacho.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por oficio, original, unidad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
          />
        </div>
      </div>

      {errorApi && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {errorApi}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFiltroEstatus('TODOS')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              filtroEstatus === 'TODOS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Todas ({respuestasDespacho.length})
          </button>
          <button
            onClick={() => setFiltroEstatus('ENVIADO_AVAL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              filtroEstatus === 'ENVIADO_AVAL'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-300"></span>
            Por Recepcionar ({cantPorRecep})
          </button>
          <button
            onClick={() => setFiltroEstatus('PROCESO_DE_AVAL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              filtroEstatus === 'PROCESO_DE_AVAL'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-violet-300"></span>
            En proceso de aval ({cantRecibidas})
          </button>
          <button
            onClick={() => setFiltroEstatus('AVALADO')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              filtroEstatus === 'AVALADO'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
            Avaladas ({cantAvaladas})
          </button>
        </div>

        {documentosPorRecepcionarSeleccionados.length > 0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckSquare size={16} /> {documentosPorRecepcionarSeleccionados.length} por recepcionar
            </span>
            <button
              onClick={() => handleConfirmarRecepcion(documentosPorRecepcionarSeleccionados.map((d) => d.id))}
              disabled={loadingRecepcion}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
            >
              <CheckCircle2 size={14} /> {loadingRecepcion ? 'Confirmando...' : 'Confirmar Recepción'}
            </button>
          </div>
        )}
        {documentosPorAvalarSeleccionados.length > 0 && (
          <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 px-4 py-2 rounded-xl">
            <span className="text-xs font-bold text-violet-800 flex items-center gap-1.5">
              <CheckSquare size={16} /> {documentosPorAvalarSeleccionados.length} en proceso de aval
            </span>
            <button
              onClick={() => handleAvalar(documentosPorAvalarSeleccionados.map((d) => d.id))}
              disabled={loadingAvalar}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
            >
              <Stamp size={14} /> {loadingAvalar ? 'Procesando...' : 'AVALAR'}
            </button>
          </div>
        )}
        {documentosAvaladosSeleccionados.length > 0 && (
          <div className="flex items-center gap-3 bg-cyan-50 border border-cyan-200 px-4 py-2 rounded-xl">
            <span className="text-xs font-bold text-cyan-800 flex items-center gap-1.5">
              <CheckSquare size={16} /> {documentosAvaladosSeleccionados.length} avaladas
            </span>
            <button
              onClick={() => handleDevolverAUnidad(documentosAvaladosSeleccionados.map((d) => d.id))}
              disabled={loadingDevolver}
              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
            >
              <RotateCcw size={14} /> {loadingDevolver ? 'Enviando...' : 'DEVOLVER'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div
          ref={scrollSuperiorRef}
          onScroll={sincronizarDesdeArriba}
          className="overflow-x-auto overflow-y-hidden border-b border-slate-200"
        >
          <div style={{ width: anchoTabla || 1180, height: 1 }} />
        </div>
        <div ref={scrollTablaRef} onScroll={sincronizarDesdeTabla} className="overflow-x-auto">
          <table ref={tablaRef} className="w-full min-w-[1180px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={todosSeleccionadosEnPagina}
                    disabled={selectAllDeshabilitado}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer"
                  />
                </th>
                <th className="p-4">Estatus</th>
                <th className="p-4">Info</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">N° Oficio</th>
                <th className="p-4">Asunto</th>
                <th className="p-4">Original</th>
                <th className="p-4">Unidad de origen</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    Cargando respuestas enviadas a Despacho...
                  </td>
                </tr>
              ) : documentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    No hay respuestas enviadas a Despacho en esta categoría.
                  </td>
                </tr>
              ) : (
                documentosPaginados.map((doc) => {
                  const estatusConf = ESTATUS_CONFIG[doc.estatus] || {
                    label: doc.estatus,
                    color: 'bg-slate-100 text-slate-700',
                  };
                  const porConfirmar = doc.estatus === 'ENVIADO_AVAL';
                  const enProcesoAval = doc.estatus === 'PROCESO_DE_AVAL';
                  const estaAvalado = doc.estatus === 'AVALADO';
                  const puedeSeleccionar =
                    (porConfirmar || enProcesoAval || estaAvalado) &&
                    (!tipoSeleccionActivo || doc.estatus === tipoSeleccionActivo);
                  const isChecked = seleccionados.includes(doc.id);
                  const unidadOrigen =
                    doc.documento_padre?.departamento_actual?.nombre ||
                    documentos.find((d) => String(d.id) === String(doc.documento_padre_id))
                      ?.departamento_actual?.nombre ||
                    'N/A';

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          disabled={!puedeSeleccionar}
                          checked={isChecked}
                          onChange={() => handleSelectOne(doc.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        />
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${estatusConf.color}`}
                        >
                          {porConfirmar ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                          {estatusConf.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => abrirDetalle(doc)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          Ver Detalle
                        </button>
                      </td>
                      <td className="p-4 text-slate-500 whitespace-nowrap text-xs">
                        {new Date(doc.fecha).toLocaleDateString()}
                      </td>
                      <td
                        className={
                          doc.prioridad
                            ? 'p-4 font-semibold text-red-600 whitespace-nowrap flex items-baseline gap-1'
                            : 'p-4 font-semibold text-indigo-600 whitespace-nowrap'
                        }
                      >
                        {doc.prioridad && <ShieldAlertIcon size={14} />}
                        {doc.oficio_serial}
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate" title={doc.descripcion}>
                        {doc.descripcion}
                      </td>
                      <td className="p-4 font-semibold text-slate-700 whitespace-nowrap">
                        {doc.documento_padre?.oficio_serial || 'N/A'}
                      </td>
                      <td className="p-4 text-slate-600 whitespace-nowrap text-xs">{unidadOrigen}</td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {porConfirmar && (
                          <button
                            onClick={() => handleConfirmarRecepcion([doc.id])}
                            disabled={loadingRecepcion}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                          >
                            <CheckCircle2 size={14} /> Confirmar Entrada
                          </button>
                        )}
                        {enProcesoAval && (
                          <button
                            onClick={() => handleAvalar([doc.id])}
                            disabled={loadingAvalar}
                            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                          >
                            <Stamp size={14} /> AVALAR
                          </button>
                        )}
                        {estaAvalado && (
                          <button
                            onClick={() => handleDevolverAUnidad([doc.id])}
                            disabled={loadingDevolver}
                            className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                          >
                            <RotateCcw size={14} /> DEVOLVER
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Paginacion
          paginaActual={paginaSegura}
          totalPaginas={totalPaginas}
          totalItems={totalItems}
          itemsPorPagina={ITEMS_POR_PAGINA}
          onCambiarPagina={setPaginaActual}
        />
      </div>

      {documentoSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {documentoSeleccionado.oficio_tipo}
                </span>
                <h2 className="text-xl font-bold text-slate-800">{documentoSeleccionado.oficio_serial}</h2>
              </div>
              <button
                onClick={() => setDocumentoSeleccionado(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  ESTATUS_CONFIG[documentoSeleccionado.estatus]?.color || 'bg-slate-100'
                }`}
              >
                {ESTATUS_CONFIG[documentoSeleccionado.estatus]?.label || documentoSeleccionado.estatus}
              </span>

              {documentoSeleccionado.documento_padre && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquarePlus size={14} /> Documento original
                  </h3>
                  <p className="text-sm font-semibold text-slate-800">
                    {documentoSeleccionado.documento_padre.oficio_serial}
                  </p>
                  <p className="text-sm text-slate-700">{documentoSeleccionado.documento_padre.descripcion}</p>
                  <p className="text-xs text-slate-600">
                    Unidad de origen:{' '}
                    <span className="font-semibold text-slate-800">
                      {documentoSeleccionado.documento_padre.departamento_actual?.nombre || 'N/A'}
                    </span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                    <Building2 size={14} /> Origen / Emisor
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {documentoSeleccionado.origen?.nombre || 'N/A'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                    <User size={14} /> Registrado Por
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {documentoSeleccionado.usuario_registra
                      ? `${documentoSeleccionado.usuario_registra.nombre} ${documentoSeleccionado.usuario_registra.apellido}`
                      : 'Sistema / N/A'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                    <Clock size={14} /> Fecha de Creación
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {new Date(documentoSeleccionado.fecha).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Descripción / Asunto
                </h3>
                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
                  {documentoSeleccionado.descripcion}
                </p>
              </div>

              {documentoSeleccionado.observacion && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Observacion</h3>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
                    {documentoSeleccionado.observacion}
                  </p>
                </div>
              )}

              {documentoSeleccionado.recaudos && documentoSeleccionado.recaudos.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Paperclip size={14} /> Recaudos Adjuntos
                  </h3>
                  <ul className="space-y-1.5">
                    {documentoSeleccionado.recaudos.map((r) => (
                      <li key={r.id} className="text-xs font-medium text-slate-700 bg-slate-100 px-3 py-2 rounded-lg">
                        • {r.recaudo?.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {documentoSeleccionado.pdf_url && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Documento Adjunto (PDF)
                    </h3>
                    <a
                      href={documentoSeleccionado.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Abrir pestaña <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 shadow-inner">
                    <iframe
                      src={documentoSeleccionado.pdf_url}
                      title={`PDF ${documentoSeleccionado.oficio_serial}`}
                      className="w-full h-112.5"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              {documentoSeleccionado.estatus === 'ENVIADO_AVAL' ? (
                <button
                  onClick={() => handleConfirmarRecepcion([documentoSeleccionado.id])}
                  disabled={loadingRecepcion}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <CheckCircle2 size={16} /> {loadingRecepcion ? 'Confirmando...' : 'Confirmar Recepción'}
                </button>
              ) : documentoSeleccionado.estatus === 'PROCESO_DE_AVAL' ? (
                <button
                  onClick={() => handleAvalar([documentoSeleccionado.id])}
                  disabled={loadingAvalar}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <Stamp size={16} /> {loadingAvalar ? 'Procesando...' : 'AVALAR'}
                </button>
              ) : documentoSeleccionado.estatus === 'AVALADO' ? (
                <button
                  onClick={() => handleDevolverAUnidad([documentoSeleccionado.id])}
                  disabled={loadingDevolver}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <RotateCcw size={16} /> {loadingDevolver ? 'Enviando...' : 'DEVOLVER'}
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setDocumentoSeleccionado(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
