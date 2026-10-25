import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import {
  Search,
  Send,
  Eye,
  Pencil,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Paperclip,
  User,
  Building2,
  ExternalLink,
  MapPin,
  Trash2,
  Ban,
  ShieldAlertIcon
} from 'lucide-react';
import { obtenerTodosDocumentos, enviarDocumentosADespacho, eliminarDocumento } from '../api/documentos.api';
import { isAxiosError } from 'axios';
import { ConfirmModalEliminar } from '../components/layout/ConfirmModalEliminar';
import { Paginacion } from '../components/ui/Paginacion';
import { ITEMS_POR_PAGINA, paginarLista } from '../utils/paginacion';

interface OrigenDestino {
  id: number;
  nombre: string;
  categoria_id?: number;
}

interface UsuarioRegistra {
  id: number;
  nombre: string;
  apellido: string;
  cedula: string;
}

interface RecaudoDetalle {
  id: string;
  documento_id: string;
  recaudo_id: number;
  recaudo: {
    id: number;
    nombre: string;
  };
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
  tiene_recaudos: boolean;
  pdf_url?: string;
  pdf_nombre_original?: string;
  pdf_peso_kb?: number;
  origen: OrigenDestino;
  destino?: OrigenDestino | null;
  departamento_actual_id?: number | null;
  departamentos?: OrigenDestino[];
  departamento_actual?: OrigenDestino | null;
  usuario_registra?: UsuarioRegistra;
  recaudos?: RecaudoDetalle[];
  observacion: string;

}

const ESTATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RECIBIDO: { label: 'RECIBIDO', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  EN_DESPACHO: { label: 'EN DESPACHO', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  VISADO: { label: 'VISADO POR DIRECCIÓN', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ASIGNADO: { label: 'ASIGNADO', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  RECIBIDO_UNIDAD: { label: 'RECIBIDO EN UNIDAD', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  DEVUELTO_DESPACHO: { label: 'DEVUELTO A DESPACHO', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  PROCESO_RESPUESTA: { label: 'PROCESO DE RESPUESTA', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  TRAMITADO: { label: 'TRAMITADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  ARCHIVADO: { label: 'ARCHIVADO', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  ANULADO: { label: 'ANULADO', color: 'bg-red-100 text-red-800 border-red-300' },
};

export const BandejaRecepcion = () => {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.user);
  const rol = (usuario?.rol || '').toLowerCase().trim();
  const puedeEditar = rol === 'administrador' || rol.includes('recepcion');
  const esAdmin = rol === 'administrador';
  const esJefeRecepcion = rol === 'jefe_recepcion';

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const scrollSuperiorRef = useRef<HTMLDivElement>(null);
  const scrollTablaRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLTableElement>(null);
  const [anchoTabla, setAnchoTabla] = useState(0);

  const [filtroEstatus, setFiltroEstatus] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);

  // Estados para la modal reutilizable de eliminación
  const [documentoAEliminar, setDocumentoAEliminar] = useState<{ id: string; oficio_serial: string } | null>(null);
  const [loadingEliminar, setLoadingEliminar] = useState<boolean>(false);

  const cargarDocumentos = useCallback(async (mostrarLoading = false) => {

    try {
      if (mostrarLoading) {
        setLoading(true);
      }
      setErrorApi(null);
      const lista = await obtenerTodosDocumentos();
      setDocumentos(lista);
    } catch (err) {
      console.error('Error al cargar documentos:', err);
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al obtener la lista de documentos');
      } else {
        setErrorApi('Error al conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  }, []);

   useEffect(() => {
    let isMounted = true;
  
    const ejecutarCarga = async () => {
      await cargarDocumentos(false);
    };
  
    ejecutarCarga();
  
    return () => {
      isMounted = false;
    };
  }, []);

  const obtenerNombreUbicacion = (doc: Documento): { nombre: string; esRecepcion: boolean; esDespacho: boolean } | null => {
    const deptoId = doc.departamento_actual_id ?? doc.departamento_actual?.id;
    if (!deptoId) return null;

    if (+deptoId === 12) {
      return { nombre: 'EN RECEPCIÓN', esRecepcion: true, esDespacho: false };
    }

    if (+deptoId === 2) {
      return { nombre: 'SECRETARÍA DE DESPACHO', esRecepcion: false, esDespacho: true };
    }

    const deptoEncontrado = doc.departamentos?.find((d) => d.id === deptoId);
    const nombre = deptoEncontrado?.nombre || doc.departamento_actual?.nombre || `Depto. #${deptoId}`;

    return { nombre, esRecepcion: false, esDespacho: false };
  };

  const documentosFiltrados = Array.isArray(documentos)
    ? documentos.filter((doc) => {
        const coincideEstatus =
          filtroEstatus === 'TODOS'
            ? ['RECIBIDO', 'EN_DESPACHO', 'VISADO'].includes(doc.estatus)
            : filtroEstatus === 'RECIBIDO'
            ? doc.estatus === 'RECIBIDO'
            : filtroEstatus === 'EN_DESPACHO'
            ? (doc.departamento_actual_id ?? doc.departamento_actual?.id) === 2 && (doc.estatus === 'VISADO' || doc.estatus === 'EN_DESPACHO')
            : doc.estatus === filtroEstatus;

        const termino = busqueda.toLowerCase();
        const coincideBusqueda =
          (doc.oficio_serial?.toLowerCase() || '').includes(termino) ||
          (doc.origen?.nombre?.toLowerCase() || '').includes(termino) ||
          (doc.descripcion?.toLowerCase() || '').includes(termino);

        return coincideEstatus && coincideBusqueda;
      })
    : [];

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

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroEstatus, busqueda]);

  const toggleSeleccion = (id: string) => {
    const stringId = String(id);
    if (seleccionados.includes(stringId)) {
      setSeleccionados(seleccionados.filter((item) => item !== stringId));
    } else {
      setSeleccionados([...seleccionados, stringId]);
    }
  };

  const recibidosVisibles = documentosPaginados.filter((d) => d.estatus === 'RECIBIDO');

  const todosSeleccionados =
    recibidosVisibles.length > 0 &&
    recibidosVisibles.every((d) => seleccionados.includes(String(d.id)));

  const toggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      const idsVisibles = recibidosVisibles.map((d) => String(d.id));
      setSeleccionados(seleccionados.filter((id) => !idsVisibles.includes(id)));
    } else {
      const idsVisibles = recibidosVisibles.map((d) => String(d.id));
      const nuevaSeleccion = Array.from(new Set([...seleccionados, ...idsVisibles]));
      setSeleccionados(nuevaSeleccion);
    }
  };

  const handleEnviarDocumentosADespacho = async () => {
    if (seleccionados.length === 0) return;

    if (!confirm(`¿Estás seguro de enviar ${seleccionados.length} documentos a Despacho?`)) {
      return;
    }

    try {
      setErrorApi(null);
      await enviarDocumentosADespacho(seleccionados);
      setSeleccionados([]);
      await cargarDocumentos();
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al enviar a despacho');
      } else {
        setErrorApi('Error inesperado al procesar la solicitud');
      }
    }
  };

  // Función ejecutada por el modal al hacer submit
  const handleConfirmarEliminacion = async (motivo: string) => {
    if (!documentoAEliminar) return;

    try {
      setLoadingEliminar(true);
      setErrorApi(null);

      // Enviamos ambos parámetros: id y motivo
      await eliminarDocumento(documentoAEliminar.id, motivo);

      setSeleccionados((prev) => prev.filter((item) => item !== String(documentoAEliminar.id)));
      setDocumentoAEliminar(null);
      await cargarDocumentos();
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al eliminar el documento');
      } else {
        setErrorApi('Error de conexión al intentar eliminar el documento');
      }
    } finally {
      setLoadingEliminar(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Bandeja de Recepción</h1>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 font-semibold text-xs rounded-full">
              {documentosFiltrados.length} Registros
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Recepción inicial e incorporación de correspondencias a Despacho.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por oficio, origen, asunto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>

          {seleccionados.length > 0 && (
            <button
              onClick={handleEnviarDocumentosADespacho}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-sm animate-pulse"
            >
              <Send size={16} />
              Enviar a Despacho ({seleccionados.length})
            </button>
          )}
        </div>
      </div>

      {errorApi && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center justify-between">
          <span>{errorApi}</span>
          <button onClick={() => setErrorApi(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setFiltroEstatus('TODOS')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            filtroEstatus === 'TODOS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Todos ({documentosFiltrados.length})
        </button>
        <button
          onClick={() => setFiltroEstatus('RECIBIDO')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            filtroEstatus === 'RECIBIDO'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-300"></span>
          Recibidos en Recepción ({documentos.filter((d) => d.estatus === 'RECIBIDO').length})
        </button>
        <button
          onClick={() => setFiltroEstatus('EN_DESPACHO')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            filtroEstatus === 'EN_DESPACHO'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
          En Despacho ({documentos.filter((d) => 
            (d.departamento_actual_id ?? d.departamento_actual?.id) === 2 && 
            (d.estatus === 'VISADO' || d.estatus === 'EN_DESPACHO')
          ).length})
        </button>

      </div>
          <Paginacion
          paginaActual={paginaSegura}
          totalPaginas={totalPaginas}
          totalItems={totalItems}
          itemsPorPagina={ITEMS_POR_PAGINA}
          onCambiarPagina={setPaginaActual}
        />

      {/* Tabla */}
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
          <table ref={tablaRef} className="w-full min-w-[1180px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    onChange={toggleSeleccionarTodos}
                    checked={todosSeleccionados}
                    disabled={recibidosVisibles.length === 0}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                  />
                </th>
                <th className="p-4">Estatus</th>
                <th className="p-4">Info</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">N° Oficio</th>
                <th className="p-4">Asunto / Descripción</th>
                <th className="p-4">Origen / Emisor</th>
                <th className="p-4">Ubicación Actual</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Cargando correspondencias...
                  </td>
                </tr>
              ) : documentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <FileText className="mx-auto mb-2 text-slate-300" size={32} />
                    No se encontraron correspondencias registradas.
                  </td>
                </tr>
              ) : (
                documentosPaginados.map((doc) => {
                  const stringId = String(doc.id);
                  const esRecibido = doc.estatus === 'RECIBIDO';
                  const esAnulado = doc.estatus === 'ANULADO';
                  const estaSeleccionado = seleccionados.includes(stringId);
                  const configEstatus = ESTATUS_CONFIG[doc.estatus] || {
                    label: doc.estatus,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  const ubicacion = obtenerNombreUbicacion(doc);

                  return (
                    <tr
                      key={stringId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        estaSeleccionado ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="p-4 text-center">
                        {esRecibido && (
                          <input
                            type="checkbox"
                            checked={estaSeleccionado}
                            onChange={() => toggleSeleccion(stringId)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${configEstatus.color}`}
                        >
                          {esAnulado ? (
                            <Ban size={12} />
                          ) : esRecibido ? (
                            <AlertCircle size={12} />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          {configEstatus.label}
                        </span>
                      </td>
                      <td>
                        <button
                              onClick={() => setDocumentoSeleccionado(doc)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                            <Eye size={14} /> Ver Detalles
                        </button>
                      </td>
                      <td className="p-4 text-slate-500 whitespace-nowrap text-xs">
                        {new Date(doc.fecha).toLocaleDateString()}
                      </td>
                      <td className={doc.prioridad ?'p-4 font-semibold text-red-600 whitespace-nowrap flex items-baseline gap-1' : 'p-4 font-semibold text-indigo-600 whitespace-nowrap'}>
                        {doc.prioridad && <ShieldAlertIcon size={14}/>}
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
                            className={`inline-flex items-center gap-1 font-semibold px-2.5 py-1 rounded-md max-w-[200px] ${
                              ubicacion.esRecepcion
                                ? 'text-amber-800 bg-amber-100 border border-amber-200'
                                : ubicacion.esDespacho
                                ? 'text-blue-800 bg-blue-100 border border-blue-200'
                                : 'text-slate-700 bg-slate-100 border border-slate-200'
                            }`}
                            title={ubicacion.nombre}
                          >
                            <MapPin
                              size={12}
                              className={`shrink-0 ${
                                ubicacion.esRecepcion
                                  ? 'text-amber-600'
                                  : ubicacion.esDespacho
                                  ? 'text-blue-600'
                                  : 'text-slate-500'
                              }`}
                            />
                            <span className="truncate">{ubicacion.nombre}</span>
                          </span>
                        )}
                      </td>
                      
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {puedeEditar && doc.estatus === 'RECIBIDO' && (
                            <button
                              onClick={() =>
                                navigate(`/documentos/editar/${doc.id}`, {
                                  state: { from: '/recepcion/bandeja' },
                                })
                              }
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Pencil size={14} /> Editar
                            </button>
                          )}

                          {esAdmin && doc.estatus !== 'RECIBIDO' &&(
                            <button
                              onClick={() =>
                                navigate(`/documentos/editar/${doc.id}`, {
                                  state: { from: '/recepcion/bandeja' },
                                })
                              }
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Pencil size={14} /> Editar
                            </button>
                          )}

                          {esAdmin &&(
                            <button
                              onClick={() => setDocumentoAEliminar({ id: stringId, oficio_serial: doc.oficio_serial })}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white border border-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            >
                              <Trash2 size={14} /> Anular
                            </button>
                          )}

                          {esJefeRecepcion && doc.estatus === "RECIBIDO" &&(
                            <button
                              onClick={() => setDocumentoAEliminar({ id: stringId, oficio_serial: doc.oficio_serial })}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white border border-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            >
                              <Trash2 size={14} /> Anular
                            </button>
                          )}

                          
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>


      </div>

      {/* Modal reutilizable de Confirmación de Eliminación */}
      <ConfirmModalEliminar
        isOpen={!!documentoAEliminar}
        onClose={() => setDocumentoAEliminar(null)}
        onConfirm={handleConfirmarEliminacion}
        identificadorDoc={documentoAEliminar?.oficio_serial}
        loading={loadingEliminar}
      />

      {/* Modal de Detalles con visor PDF */}
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
                  {ESTATUS_CONFIG[documentoSeleccionado.estatus]?.label || documentoSeleccionado.estatus}
                </span>
                {documentoSeleccionado.prioridad && (
                  <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                    Prioritario
                  </span>
                )}
                {documentoSeleccionado.requiere_respuesta && (
                  <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                    Requiere Respuesta
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                    <Building2 size={14} /> Origen / Emisor
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {documentoSeleccionado.origen?.nombre || 'N/A'}
                  </p>
                </div>
                {obtenerNombreUbicacion(documentoSeleccionado) && (
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                      <MapPin size={14} /> Ubicación Actual
                    </div>
                    <p className="text-sm font-semibold text-slate-800 wrap-break-word">
                      {obtenerNombreUbicacion(documentoSeleccionado)?.nombre}
                    </p>
                  </div>
                )}
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

              {/* Visor PDF Supabase Storage */}
              {documentoSeleccionado.pdf_url ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} /> Documento Adjunto (PDF)
                    </h3>
                    <a
                      href={documentoSeleccionado.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                    >
                      Abrir en pestaña <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 shadow-inner">
                    <iframe
                      src={documentoSeleccionado.pdf_url}
                      title={`PDF ${documentoSeleccionado.oficio_serial}`}
                      className="w-full h-125"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  Este registro no posee archivo PDF adjunto en Supabase Storage.
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center text-xs text-slate-500 border-t border-slate-200 pt-4">
                <span className="flex items-center gap-1">
                  <Clock size={14} /> Registrado: {new Date(documentoSeleccionado.fecha).toLocaleString()}
                </span>
                {documentoSeleccionado.usuario_registra && (
                  <span className="flex items-center gap-1">
                    <User size={14} /> Por: {documentoSeleccionado.usuario_registra.nombre}{' '}
                    {documentoSeleccionado.usuario_registra.apellido}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
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
