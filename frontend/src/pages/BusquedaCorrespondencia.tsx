import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
  ExternalLink,
  User,
  Clock,
  Pencil,
  Trash2,
  ShieldAlertIcon,
  FileSearch,
  Eye,
  MapPin,
  Paperclip,
  MessageSquarePlus,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
  obtenerTodosDocumentos,
  getDocumentoDetalle,
  eliminarDocumento,
  getCatalogs,
  type CategoriaCatalog,
} from '../api/documentos.api';
import { ConfirmModalEliminar } from '../components/layout/ConfirmModalEliminar';
import { Paginacion } from '../components/ui/Paginacion';
import { ITEMS_POR_PAGINA, paginarLista } from '../utils/paginacion';

interface OrigenDestino {
  id: number;
  nombre: string;
  categoria_id?: number;
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
  requiere_respuesta: boolean;
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
  recaudos?: Array<{ id: string; recaudo_id?: number; recaudo?: { nombre: string } }>;
  observacion: string;
  documentos_hijos?: Array<{
    id: string;
    oficio_serial: string;
    oficio_tipo: string;
    descripcion: string;
    fecha: string;
    estatus: string;
    pdf_url?: string;
    observacion?: string | null;
    destino?: { id: number; nombre: string } | null;
  }>;
}

const ESTATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RECIBIDO: { label: 'Recibido en Recepción', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  EN_DESPACHO: { label: 'POR VISAR', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  VISADO: { label: 'VISADO POR DIRECCIÓN', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ASIGNADO: { label: 'ASIGNADO', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  RECIBIDO_UNIDAD: { label: 'RECIBIDO EN UNIDAD', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  DEVUELTO_DESPACHO: { label: 'DEVUELTO A DESPACHO', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  PROCESO_RESPUESTA: { label: 'PROCESO DE RESPUESTA', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  TRAMITADO: { label: 'TRAMITADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  ARCHIVADO: { label: 'ARCHIVADO', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  ANULADO: { label: 'ANULADO', color: 'bg-red-100 text-red-800 border-red-300' },
};

export const BusquedaCorrespondencia = () => {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.user);
  const rol = (usuario?.rol || '').toLowerCase().trim();
  const esAdmin = rol === 'administrador';
  const esJefeRecepcion = rol === 'jefe_recepcion';

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [categorias, setCategorias] = useState<CategoriaCatalog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const [filtroSerial, setFiltroSerial] = useState('');
  const [filtroTitulo, setFiltroTitulo] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState('');
  const [filtroObservacion, setFiltroObservacion] = useState('');

  const [paginaActual, setPaginaActual] = useState(1);
  const scrollSuperiorRef = useRef<HTMLDivElement>(null);
  const scrollTablaRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLTableElement>(null);
  const [anchoTabla, setAnchoTabla] = useState(0);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);
  const [documentoAEliminar, setDocumentoAEliminar] = useState<{ id: string; oficio_serial: string } | null>(null);
  const [loadingEliminar, setLoadingEliminar] = useState(false);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      setErrorApi(null);
      const [lista, catalogs] = await Promise.all([obtenerTodosDocumentos(), getCatalogs()]);
      setDocumentos(lista);
      setCategorias(catalogs.catalogos || []);
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al obtener correspondencias');
      } else {
        setErrorApi('Error de conexión');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroSerial, filtroTitulo, filtroFecha, filtroCategoria, filtroOrigen, filtroObservacion]);

  const origenesFiltrados = useMemo(() => {
    if (filtroCategoria) {
      return categorias.find((c) => String(c.id) === filtroCategoria)?.origenDestinos || [];
    }
    return categorias.flatMap((c) => c.origenDestinos);
  }, [categorias, filtroCategoria]);

  const obtenerCategoriaId = (doc: Documento): number | null => {
    if (doc.origen?.categoria_id) return Number(doc.origen.categoria_id);
    const cat = categorias.find((c) =>
      c.origenDestinos.some((o) => o.id === Number(doc.origen?.id))
    );
    return cat ? cat.id : null;
  };

  const documentosFiltrados = documentos.filter((doc) => {
    const serialOk =
      !filtroSerial.trim() ||
      (doc.oficio_serial?.toLowerCase() || '').includes(filtroSerial.toLowerCase().trim());

    const tituloOk =
      !filtroTitulo.trim() ||
      (doc.descripcion?.toLowerCase() || '').includes(filtroTitulo.toLowerCase().trim());

    const fechaOk =
      !filtroFecha ||
      (doc.fecha ? String(doc.fecha).slice(0, 10) : '') === filtroFecha;

    const categoriaOk =
      !filtroCategoria || Number(obtenerCategoriaId(doc)) === Number(filtroCategoria);

    const origenOk = !filtroOrigen || Number(doc.origen?.id) === Number(filtroOrigen);

    const observacionOk =
      !filtroObservacion.trim() ||
      (doc.observacion?.toLowerCase() || '').includes(filtroObservacion.toLowerCase().trim());

    return serialOk && tituloOk && fechaOk && categoriaOk && origenOk && observacionOk;
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
  }, [documentosPaginados, esAdmin, loading]);

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

  const hayFiltros =
    Boolean(filtroSerial.trim()) ||
    Boolean(filtroTitulo.trim()) ||
    Boolean(filtroFecha) ||
    Boolean(filtroCategoria) ||
    Boolean(filtroOrigen) ||
    Boolean(filtroObservacion.trim());

  const limpiarFiltros = () => {
    setFiltroSerial('');
    setFiltroTitulo('');
    setFiltroFecha('');
    setFiltroCategoria('');
    setFiltroOrigen('');
    setFiltroObservacion('');
  };

  const obtenerNombreUbicacion = (doc: Documento): { nombre: string; esDespacho: boolean } | null => {
    const deptoId = doc.departamento_actual_id ?? doc.departamento_actual?.id;
    if (!deptoId) return null;

    if (Number(deptoId) === 2) {
      return { nombre: 'SECRETARÍA DE DESPACHO', esDespacho: true };
    }

    const nombre = doc.departamento_actual?.nombre || `Depto. #${deptoId}`;
    return { nombre, esDespacho: false };
  };

  const handleConfirmarEliminacion = async (motivo: string) => {
    if (!documentoAEliminar) return;

    try {
      setLoadingEliminar(true);
      setErrorApi(null);
      await eliminarDocumento(documentoAEliminar.id, motivo);
      setDocumentoAEliminar(null);
      if (documentoSeleccionado?.id === documentoAEliminar.id) {
        setDocumentoSeleccionado(null);
      }
      await cargarDatos();
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al anular el documento');
      } else {
        setErrorApi('Error de conexión al intentar anular el documento');
      }
    } finally {
      setLoadingEliminar(false);
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
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <FileSearch size={22} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">Búsqueda de Correspondencia</h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 font-semibold text-xs rounded-full">
                {documentosFiltrados.length} Documentos
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Localiza correspondencias por serial, asunto, fecha, categoría, origen u observación.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
              N° Serial
            </label>
            <input
              type="text"
              value={filtroSerial}
              onChange={(e) => setFiltroSerial(e.target.value)}
              placeholder="Ej: FACE-1235"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
              Título / Asunto
            </label>
            <input
              type="text"
              value={filtroTitulo}
              onChange={(e) => setFiltroTitulo(e.target.value)}
              placeholder="Buscar por asunto..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
              Fecha
            </label>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
              Categoría
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => {
                setFiltroCategoria(e.target.value);
                setFiltroOrigen('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Todas</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
              Origen
            </label>
            <select
              value={filtroOrigen}
              onChange={(e) => setFiltroOrigen(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Todos</option>
              {origenesFiltrados.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
              Observación
            </label>
            <input
              type="text"
              value={filtroObservacion}
              onChange={(e) => setFiltroObservacion(e.target.value)}
              placeholder="Buscar en observaciones..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {hayFiltros && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={limpiarFiltros}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {errorApi && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {errorApi}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div
          ref={scrollSuperiorRef}
          onScroll={sincronizarDesdeArriba}
          className="overflow-x-auto overflow-y-hidden border-b border-slate-200"
        >
          <div style={{ width: anchoTabla || 1180, height: 1 }} />
        </div>
        <div
          ref={scrollTablaRef}
          onScroll={sincronizarDesdeTabla}
          className="overflow-x-auto"
        >
          <table ref={tablaRef} className="w-full min-w-295 text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Estatus</th>
                <th className="p-4">Info</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">N° Oficio</th>
                <th className="p-4">Asunto / Descripción</th>
                <th className="p-4">Origen</th>
                <th className="p-4">Ubicación Actual</th>
                <th className="p-4">Destino Asignado</th>
                {esAdmin && <th className="p-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={esAdmin ? 9 : 8} className="text-center py-12 text-slate-400">
                    Cargando correspondencias...
                  </td>
                </tr>
              ) : documentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={esAdmin ? 9 : 8} className="text-center py-12 text-slate-400">
                    <Search className="mx-auto mb-2 text-slate-300" size={32} />
                    No se encontraron correspondencias con esos criterios.
                  </td>
                </tr>
              ) : (
                documentosPaginados.map((doc) => {
                  const estatusConf = ESTATUS_CONFIG[doc.estatus] || {
                    label: doc.estatus,
                    color: 'bg-slate-100 text-slate-700',
                  };
                  const ubicacion = obtenerNombreUbicacion(doc);

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${estatusConf.color}`}
                        >
                          {doc.estatus === 'ANULADO' ? (
                            <AlertCircle size={12} />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          {estatusConf.label}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <button
                          onClick={() => abrirDetalle(doc)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye size={14} /> Ver Detalles
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
                      <td className="p-4 font-medium text-slate-700 whitespace-nowrap">
                        {doc.origen?.nombre || 'N/A'}
                      </td>
                      <td className="p-4 whitespace-nowrap text-xs">
                        {ubicacion && (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded-md max-w-45 ${
                              ubicacion.esDespacho
                                ? 'text-indigo-800 bg-indigo-100 border border-indigo-200'
                                : 'text-slate-700 bg-slate-100 border border-slate-200'
                            }`}
                            title={ubicacion.nombre}
                          >
                            <MapPin size={12} className="shrink-0 text-indigo-600" />
                            <span className="truncate">{ubicacion.nombre}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap text-xs font-medium text-slate-600">
                        {doc.destino?.nombre || 'Sin asignar'}
                      </td>
                      {esAdmin && (
                        <td className="p-4 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() =>
                              navigate(`/documentos/editar/${doc.id}`, {
                                state: { from: '/documentos/buscar' },
                              })
                            }
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Pencil size={14} /> Editar
                          </button>
                          {doc.estatus !== 'ANULADO' && (
                            <button
                              onClick={() =>
                                setDocumentoAEliminar({
                                  id: doc.id,
                                  oficio_serial: doc.oficio_serial,
                                })
                              }
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white border border-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            >
                              <Trash2 size={14} /> Anular
                            </button>
                          )}
                        </td>
                      )}
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

      {esAdmin && (
        <ConfirmModalEliminar
          isOpen={!!documentoAEliminar}
          onClose={() => setDocumentoAEliminar(null)}
          onConfirm={handleConfirmarEliminacion}
          identificadorDoc={documentoAEliminar?.oficio_serial}
          loading={loadingEliminar}
        />
      )}

      {documentoSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {documentoSeleccionado.oficio_tipo}
                </span>
                <h2 className="text-xl font-bold text-slate-800">
                  {documentoSeleccionado.oficio_serial}
                </h2>
              </div>
              <button
                onClick={() => setDocumentoSeleccionado(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    ESTATUS_CONFIG[documentoSeleccionado.estatus]?.color || 'bg-slate-100'
                  }`}
                >
                  {ESTATUS_CONFIG[documentoSeleccionado.estatus]?.label ||
                    documentoSeleccionado.estatus}
                </span>
              </div>

              {documentoSeleccionado.documento_padre && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold text-cyan-800 uppercase tracking-wider">
                    Respuesta al documento original
                  </h3>
                  <p className="text-sm font-semibold text-slate-800">
                    {documentoSeleccionado.documento_padre.oficio_serial}
                    {documentoSeleccionado.documento_padre.oficio_tipo
                      ? ` · ${documentoSeleccionado.documento_padre.oficio_tipo}`
                      : ''}
                  </p>
                  {documentoSeleccionado.documento_padre.descripcion && (
                    <p className="text-sm text-slate-700">
                      {documentoSeleccionado.documento_padre.descripcion}
                    </p>
                  )}
                  <p className="text-xs text-slate-600">
                    Ubicación actual del original:{' '}
                    <span className="font-semibold text-slate-800">
                      {documentoSeleccionado.documento_padre.departamento_actual?.nombre || departamentoNombre}
                    </span>
                  </p>
                  {documentoSeleccionado.destino?.nombre && (
                    <p className="text-xs text-slate-600">
                      Destino de esta respuesta:{' '}
                      <span className="font-semibold text-slate-800">
                        {documentoSeleccionado.destino.nombre}
                      </span>
                    </p>
                  )}
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
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Observacion
                  </h3>
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
                      <li
                        key={r.id}
                        className="text-xs font-medium text-slate-700 bg-slate-100 px-3 py-2 rounded-lg"
                      >
                        • {r.recaudo?.nombre || `Recaudo #${r.recaudo_id}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {documentoSeleccionado.documentos_hijos && documentoSeleccionado.documentos_hijos.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquarePlus size={14} /> Respuestas registradas
                  </h3>
                  <ul className="space-y-2">
                    {documentoSeleccionado.documentos_hijos.map((hijo) => (
                      <li
                        key={hijo.id}
                        className="text-sm bg-cyan-50 border border-cyan-200 rounded-xl p-3 space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-800">{hijo.oficio_serial}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              ESTATUS_CONFIG[hijo.estatus]?.color || 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {ESTATUS_CONFIG[hijo.estatus]?.label || hijo.estatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{hijo.oficio_tipo}</p>
                        <p className="text-slate-700">{hijo.descripcion}</p>
                        {hijo.destino?.nombre && (
                          <p className="text-xs text-slate-500">Destino: {hijo.destino.nombre}</p>
                        )}
                        <p className="text-xs text-slate-400">
                          {hijo.fecha ? new Date(hijo.fecha).toLocaleDateString() : ''}
                        </p>
                        {hijo.pdf_url && (
                          <a
                            href={hijo.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Ver PDF <ExternalLink size={12} />
                          </a>
                        )}
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              {esAdmin && (
                <>
                  <button
                    onClick={() =>
                      navigate(`/documentos/editar/${documentoSeleccionado.id}`, {
                        state: { from: '/documentos/buscar' },
                      })
                    }
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Pencil size={16} /> Editar
                  </button>
                  {documentoSeleccionado.estatus !== 'ANULADO' && (
                    <button
                      onClick={() =>
                        setDocumentoAEliminar({
                          id: documentoSeleccionado.id,
                          oficio_serial: documentoSeleccionado.oficio_serial,
                        })
                      }
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} /> Anular
                    </button>
                  )}
                </>
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
