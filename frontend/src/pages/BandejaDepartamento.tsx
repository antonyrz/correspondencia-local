import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
  ExternalLink,
  RotateCcw,
  MessageSquarePlus,
  User,
  Clock,
  CheckSquare,
  Pencil,
  Trash2,
  ShieldAlertIcon,
  Paperclip,
  Archive,
  SendHorizontal,
  Stamp,
  FileCheck,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
  obtenerTodosDocumentos,
  eliminarDocumento,
  confirmarRecepcionDepartamento,
  devolverADespacho as apiDevolverADespacho,
  archivarDocumentos,
  tramitarDocumentos,
  getDocumentoDetalle,
  enviarRespuestasPorAval,
} from '../api/documentos.api';
import { ConfirmModal } from '../components/layout/ConfirmModal';
import { ConfirmModalEliminar } from '../components/layout/ConfirmModalEliminar';
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
  recaudos?: Array<{ id: string; recaudo: { nombre: string } }>;
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
  RECIBIDO: { label: 'RECIBIDO', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  EN_DESPACHO: { label: 'EN DESPACHO', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  VISADO: { label: 'VISADO POR DIRECCIÓN', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ASIGNADO: { label: 'ASIGNADO', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  RECIBIDO_UNIDAD: { label: 'RECIBIDO EN UNIDAD', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  DEVUELTO_DESPACHO: { label: 'DEVUELTO A DESPACHO', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  POR_AVALAR: { label: 'POR AVALAR', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  ENVIADO_AVAL: { label: 'ENVIADO A DESPACHO POR AVAL', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  RECIBIDO_AVAL: { label: 'RECIBIDO EN DESPACHO', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  PROCESO_DE_AVAL: { label: 'EN PROCESO DE AVAL', color: 'bg-violet-100 text-violet-800 border-violet-300' },
  AVALADO: { label: 'AVALADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  DEVUELTO_UNIDAD: {
    label: 'AVALADO DEVUELTO (POR RECEPCIONAR)',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
  PROCESO_RESPUESTA: { label: 'PROCESO DE RESPUESTA', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  TRAMITADO: { label: 'TRAMITADO', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  ARCHIVADO: { label: 'ARCHIVADO', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  ANULADO: { label: 'ANULADO', color: 'bg-red-100 text-red-800 border-red-300' },
};

interface ContextoOutlet {
  departamentoIdContext?: number;
  departamentoNombreContext?: string;
  usuarioActualContext?: any;
}

export const BandejaDepartamento = () => {
  const navigate = useNavigate();
  // 1. Obtenemos el usuario del store global como respaldo
  const usuarioStore = useAuthStore((state) => state.user);
  const rol = (usuarioStore?.rol || '').toLowerCase().trim();
  const puedeEditar = rol === 'administrador';
  const esAdmin = rol === 'administrador';

  
  // 2. Intentamos capturar el contexto del Outlet de manera segura
  const context = useOutletContext<ContextoOutlet | undefined>();

  // 3. Unificamos las fuentes: Priorizamos el contexto del Outlet, si no existe usamos el store
  const departamentoId = Number(
    context?.departamentoIdContext ?? usuarioStore?.departamento_id ?? 0
  );
  const departamentoNombre = 
    context?.departamentoNombreContext ?? usuarioStore?.departamento ?? 'Departamento';

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);

  const scrollSuperiorRef = useRef<HTMLDivElement>(null);
  const scrollTablaRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLTableElement>(null);
  const [anchoTabla, setAnchoTabla] = useState(0);

  const [filtroEstatus, setFiltroEstatus] = useState<'TODOS' | 'RECIBIDO_UNIDAD' | 'POR_RECEPCIONAR' | 'DEVUELTO_DESPACHO' | 'ARCHIVADO' | 'RESPUESTAS'>('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);

  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [loadingArchivar, setLoadingArchivar] = useState(false);
  const [idsPendientesArchivar, setIdsPendientesArchivar] = useState<string[] | null>(null);
  const [loadingEnviarAval, setLoadingEnviarAval] = useState(false);
  const [loadingTramitar, setLoadingTramitar] = useState(false);
  const [loadingRecepcion, setLoadingRecepcion] = useState(false);

    const [documentoAEliminar, setDocumentoAEliminar] = useState<{ id: string; oficio_serial: string } | null>(null);
    const [loadingEliminar, setLoadingEliminar] = useState<boolean>(false);

  const cargarDocumentos = useCallback(async () => {
    setLoading(true);

    try {
      setErrorApi(null);
      const lista = await obtenerTodosDocumentos();
      setDocumentos(lista);

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
    // Guardia: Si el ID todavía es 0 (cargando inicial del MainLayout), no disparamos la petición
    if (!departamentoId || departamentoId === 0) return;
    
    cargarDocumentos();
  }, [departamentoId, cargarDocumentos]);

  useEffect(() => {
    setSeleccionados([]);
    setPaginaActual(1);
  }, [filtroEstatus, busqueda]);


  const deptoIdDelPadre = (doc: Documento): number | null => {
    const padreIncluido = doc.documento_padre;
    if (padreIncluido) {
      const id = padreIncluido.departamento_actual_id ?? padreIncluido.departamento_actual?.id;
      return id != null ? Number(id) : null;
    }
    if (!doc.documento_padre_id) return null;
    const padre = documentos.find((d) => String(d.id) === String(doc.documento_padre_id));
    const id = padre?.departamento_actual_id ?? padre?.departamento_actual?.id;
    return id != null ? Number(id) : null;
  };

  const esDocumentoRespuesta = (doc: Documento) =>
    Boolean(doc.documento_padre_id) && deptoIdDelPadre(doc) === departamentoId;

  const deptoActualDelDoc = (doc: Documento) =>
    Number(doc.departamento_actual_id ?? doc.departamento_actual?.id);
  const estaEnMiDepto = (doc: Documento) => deptoActualDelDoc(doc) === departamentoId;

  // FILTRADO ESTRICTO POR DEPARTAMENTO ACTIVO
  const documentosDepartamento = documentos.filter((doc) => {
    if (doc.documento_padre_id) return false;

    const deptoActualId = doc.departamento_actual_id ?? doc.departamento_actual?.id;
    const destinoId = doc.destino?.id;

    const esDestinadoAEsteDepto = Number(deptoActualId) === departamentoId && ["ASIGNADO", "RECIBIDO_UNIDAD", "DEVUELTO_DESPACHO", "ARCHIVADO"].includes(doc.estatus);
    const esDevueltoPorEsteDepto = doc.estatus === 'DEVUELTO_DESPACHO' && Number(destinoId) === departamentoId;

    return esDestinadoAEsteDepto || esDevueltoPorEsteDepto;
  });

  const documentosRespuestas = documentos.filter(esDocumentoRespuesta);
  const esTabRespuestas = filtroEstatus === 'RESPUESTAS';
  const esTabArchivados = filtroEstatus === 'ARCHIVADO';
  const documentosArchivados = [
    ...documentosDepartamento.filter((doc) => doc.estatus === 'ARCHIVADO'),
    ...documentosRespuestas.filter((doc) => doc.estatus === 'ARCHIVADO' && estaEnMiDepto(doc)),
  ];

  type TipoSeleccionRespuesta = 'POR_AVALAR' | 'DEVUELTO_UNIDAD' | 'AVALADO' | 'TRAMITADO';
  type TipoSeleccionBandeja = 'ASIGNADO' | 'RECIBIDO_UNIDAD';
  type TipoSeleccionActivo = TipoSeleccionRespuesta | TipoSeleccionBandeja | null;

  const esRespuestaSeleccionable = (doc: Documento, tipo?: TipoSeleccionRespuesta | null) => {
    if (!esDocumentoRespuesta(doc)) return false;
    if (doc.estatus === 'POR_AVALAR') return !tipo || tipo === 'POR_AVALAR';
    if (doc.estatus === 'DEVUELTO_UNIDAD') return !tipo || tipo === 'DEVUELTO_UNIDAD';
    if (doc.estatus === 'AVALADO' && estaEnMiDepto(doc)) return !tipo || tipo === 'AVALADO';
    if (doc.estatus === 'TRAMITADO' && estaEnMiDepto(doc)) return !tipo || tipo === 'TRAMITADO';
    return false;
  };

  const listaBase = esTabRespuestas
    ? documentosRespuestas
    : esTabArchivados
    ? documentosArchivados
    : documentosDepartamento;

  const documentosFiltrados = listaBase.filter((doc) => {
    const coincideEstatus =
      filtroEstatus === 'TODOS' || filtroEstatus === 'RESPUESTAS' || filtroEstatus === 'ARCHIVADO'
        ? true
        : filtroEstatus === 'POR_RECEPCIONAR'
        ? doc.estatus === 'ASIGNADO'
        : doc.estatus === 'DEVUELTO_DESPACHO';

    const termino = busqueda.toLowerCase();
    const coincideBusqueda =
      (doc.oficio_serial?.toLowerCase() || '').includes(termino) ||
      (doc.origen?.nombre?.toLowerCase() || '').includes(termino) ||
      (doc.descripcion?.toLowerCase() || '').includes(termino) ||
      (doc.documento_padre?.oficio_serial?.toLowerCase() || '').includes(termino) ||
      (doc.destino?.nombre?.toLowerCase() || '').includes(termino);

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


  const documentosRecibidoUnidadSeleccionados = documentos.filter(
    (doc) => seleccionados.includes(doc.id) && doc.estatus === 'RECIBIDO_UNIDAD'
  );
  const documentosAsignadosSeleccionados = documentos.filter(
    (doc) => seleccionados.includes(doc.id) && doc.estatus === 'ASIGNADO'
  );
  const documentosPorAvalarSeleccionados = documentos.filter(
    (doc) => seleccionados.includes(doc.id) && doc.estatus === 'POR_AVALAR' && Boolean(doc.documento_padre_id)
  );
  const documentosDevueltosUnidadSeleccionados = documentos.filter(
    (doc) => seleccionados.includes(doc.id) && doc.estatus === 'DEVUELTO_UNIDAD' && Boolean(doc.documento_padre_id)
  );
  const documentosAvaladosSeleccionados = documentos.filter(
    (doc) =>
      seleccionados.includes(doc.id) &&
      doc.estatus === 'AVALADO' &&
      Boolean(doc.documento_padre_id) &&
      estaEnMiDepto(doc)
  );
  const documentosTramitadosSeleccionados = documentos.filter(
    (doc) =>
      seleccionados.includes(doc.id) &&
      doc.estatus === 'TRAMITADO' &&
      Boolean(doc.documento_padre_id) &&
      estaEnMiDepto(doc)
  );

  const tipoSeleccionActivo: TipoSeleccionActivo = esTabRespuestas
    ? documentosPorAvalarSeleccionados.length > 0
      ? 'POR_AVALAR'
      : documentosDevueltosUnidadSeleccionados.length > 0
      ? 'DEVUELTO_UNIDAD'
      : documentosAvaladosSeleccionados.length > 0
      ? 'AVALADO'
      : documentosTramitadosSeleccionados.length > 0
      ? 'TRAMITADO'
      : null
    : documentosAsignadosSeleccionados.length > 0
      ? 'ASIGNADO'
      : documentosRecibidoUnidadSeleccionados.length > 0
      ? 'RECIBIDO_UNIDAD'
      : null;

  const documentosSeleccionables = documentosPaginados.filter((doc) => {
    if (esTabRespuestas) {
      return esRespuestaSeleccionable(doc, tipoSeleccionActivo as TipoSeleccionRespuesta | null);
    }
    if (doc.estatus !== 'ASIGNADO' && doc.estatus !== 'RECIBIDO_UNIDAD') return false;
    if (tipoSeleccionActivo) return doc.estatus === tipoSeleccionActivo;
    return true;
  });
  const tiposEnPagina = new Set(
    documentosPaginados
      .filter((doc) =>
        esTabRespuestas
          ? esRespuestaSeleccionable(doc)
          : doc.estatus === 'ASIGNADO' || doc.estatus === 'RECIBIDO_UNIDAD'
      )
      .map((doc) => doc.estatus)
  );
  const selectAllDeshabilitado =
    documentosSeleccionables.length === 0 || (!tipoSeleccionActivo && tiposEnPagina.size > 1);
  const todosSeleccionadosEnPagina =
    documentosSeleccionables.length > 0 &&
    documentosSeleccionables.every((doc) => seleccionados.includes(doc.id));
  const mostrarArchivar =
    (!esTabRespuestas && documentosRecibidoUnidadSeleccionados.length > 0) ||
    (esTabRespuestas && documentosTramitadosSeleccionados.length > 0);
  const mostrarRegistrarRespuesta =
    !esTabRespuestas &&
    seleccionados.length === 1 &&
    documentosRecibidoUnidadSeleccionados.length === 1;
  const mostrarEnviarAval = esTabRespuestas && documentosPorAvalarSeleccionados.length > 0;
  const mostrarTramitar = esTabRespuestas && documentosAvaladosSeleccionados.length > 0;
  const idsParaArchivar = esTabRespuestas
    ? documentosTramitadosSeleccionados.map((d) => d.id)
    : documentosRecibidoUnidadSeleccionados.map((d) => d.id);

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
    if (esTabRespuestas) {
      if (!esRespuestaSeleccionable(docAAlternar, tipoSeleccionActivo as TipoSeleccionRespuesta | null)) {
        return;
      }
    } else {
      if (docAAlternar.estatus !== 'ASIGNADO' && docAAlternar.estatus !== 'RECIBIDO_UNIDAD') return;
      if (tipoSeleccionActivo && docAAlternar.estatus !== tipoSeleccionActivo) return;
    }

    if (seleccionados.includes(id)) {
      setSeleccionados(seleccionados.filter((item) => item !== id));
    } else {
      setSeleccionados([...seleccionados, id]);
    }
  };

  const handleConfirmarRecepcion = async (docId: string) => {
    try {
      setLoadingRecepcion(true);
      setErrorApi(null);
      await confirmarRecepcionDepartamento(docId);
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => id !== docId));
      if (documentoSeleccionado?.id === docId) {
        setDocumentoSeleccionado(null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al confirmar recepción');
      }
    } finally {
      setLoadingRecepcion(false);
    }
  };

  const handleConfirmarRecepcionMasiva = async (ids?: string[]) => {
    const idsAConfirmar =
      ids ??
      documentos
        .filter(
          (doc) =>
            seleccionados.includes(doc.id) &&
            (doc.estatus === 'ASIGNADO' || doc.estatus === 'DEVUELTO_UNIDAD')
        )
        .map((doc) => doc.id);
    if (idsAConfirmar.length === 0) return;

    try {
      setLoadingRecepcion(true);
      setErrorApi(null);
      await Promise.all(idsAConfirmar.map((id) => confirmarRecepcionDepartamento(id)));
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => !idsAConfirmar.includes(id)));
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al confirmar recepción masiva');
      }
    } finally {
      setLoadingRecepcion(false);
    }
  };

  const handleTramitar = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      setLoadingTramitar(true);
      setErrorApi(null);
      await tramitarDocumentos(ids);
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => !ids.includes(id)));
      if (documentoSeleccionado && ids.includes(documentoSeleccionado.id)) {
        setDocumentoSeleccionado(null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al tramitar documentos');
      } else {
        setErrorApi('Error de conexión al tramitar documentos');
      }
    } finally {
      setLoadingTramitar(false);
    }
  };

  const solicitarArchivar = (ids: string[]) => {
    if (ids.length === 0) return;
    setIdsPendientesArchivar(ids);
  };

  const handleArchivar = async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      setLoadingArchivar(true);
      setErrorApi(null);
      await archivarDocumentos(ids);
      setIdsPendientesArchivar(null);
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => !ids.includes(id)));
      if (documentoSeleccionado && ids.includes(documentoSeleccionado.id)) {
        setDocumentoSeleccionado(null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al archivar documentos');
      } else {
        setErrorApi('Error de conexión al archivar documentos');
      }
    } finally {
      setLoadingArchivar(false);
    }
  };

  const handleEnviarADespachoPorAval = async () => {
    const ids = documentosPorAvalarSeleccionados.map((d) => d.id);
    if (ids.length === 0) return;

    try {
      setLoadingEnviarAval(true);
      setErrorApi(null);
      await enviarRespuestasPorAval(ids);
      await cargarDocumentos();
      setSeleccionados([]);
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al enviar respuestas a Despacho');
      } else {
        setErrorApi('Error de conexión al enviar respuestas a Despacho');
      }
    } finally {
      setLoadingEnviarAval(false);
    }
  };

  const handleRegistrarRespuesta = (docId: string) => {
    navigate('/documentos/responder', {
      state: { documentoPadreId: docId, from: '/departamento/bandeja' },
    });
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

  const handleDevolverADespacho = async (docId: string) => {
    const motivo = prompt('Por favor, indique el motivo de la devolución a Despacho:');
    if (!motivo) return;

    try {
      setErrorApi(null);
      await apiDevolverADespacho(docId, motivo);
      await cargarDocumentos();
      setSeleccionados((prev) => prev.filter((id) => id !== docId));
      if (documentoSeleccionado?.id === docId) {
        setDocumentoSeleccionado(null);
      }
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al devolver el documento');
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

  const cantPorRecep = documentosDepartamento.filter((d) => d.estatus === 'ASIGNADO').length;
  const cantDevueltos = documentosDepartamento.filter((d) => d.estatus === 'DEVUELTO_DESPACHO').length;
  const cantArchivados = documentosArchivados.length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{departamentoNombre}</h1>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 font-semibold text-xs rounded-full">
              {documentosDepartamento.length} Documentos
            </span>

          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestión y procesamiento de correspondencias asignadas a esta unidad.
          </p>
        </div>

        <div className="flex flex-col items-stretch md:items-end gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por oficio, origen..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
          {(mostrarArchivar ||
            mostrarRegistrarRespuesta ||
            mostrarEnviarAval ||
            mostrarTramitar ||
            documentosDevueltosUnidadSeleccionados.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {documentosDevueltosUnidadSeleccionados.length > 0 && (
                <button
                  onClick={() =>
                    handleConfirmarRecepcionMasiva(
                      documentosDevueltosUnidadSeleccionados.map((d) => d.id)
                    )
                  }
                  disabled={loadingRecepcion}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <CheckCircle2 size={14} />{' '}
                  {loadingRecepcion ? 'Confirmando...' : 'Confirmar Recepción'}
                </button>
              )}
              {mostrarEnviarAval && (
                <button
                  onClick={handleEnviarADespachoPorAval}
                  disabled={loadingEnviarAval}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <SendHorizontal size={14} />{' '}
                  {loadingEnviarAval ? 'Enviando...' : 'Enviar a despacho por aval'}
                </button>
              )}
              {mostrarTramitar && (
                <button
                  onClick={() => handleTramitar(documentosAvaladosSeleccionados.map((d) => d.id))}
                  disabled={loadingTramitar}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <FileCheck size={14} /> {loadingTramitar ? 'Procesando...' : 'TRAMITADO'}
                </button>
              )}
              {mostrarArchivar && (
                <button
                  onClick={() => solicitarArchivar(idsParaArchivar)}
                  disabled={loadingArchivar}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <Archive size={14} /> {loadingArchivar ? 'Archivando...' : 'ARCHIVAR'}
                </button>
              )}
              {mostrarRegistrarRespuesta && (
                <button
                  onClick={() => handleRegistrarRespuesta(documentosRecibidoUnidadSeleccionados[0].id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <MessageSquarePlus size={14} /> Registrar Respuesta
                </button>
              )}
            </div>
          )}
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
            Todos ({documentosDepartamento.length})
          </button>

          <button
            onClick={() => setFiltroEstatus('POR_RECEPCIONAR')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              filtroEstatus === 'POR_RECEPCIONAR'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-300"></span>
            Por Recepcionar ({cantPorRecep})
          </button>

          <button
            onClick={() => setFiltroEstatus('DEVUELTO_DESPACHO')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              filtroEstatus === 'DEVUELTO_DESPACHO'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            
            <span className="w-2 h-2 rounded-full bg-rose-300"></span>
            Devueltos a Despacho ({cantDevueltos})
          </button>

          <button
            onClick={() => setFiltroEstatus('ARCHIVADO')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              filtroEstatus === 'ARCHIVADO'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Archivados ({cantArchivados})
          </button>

          <button
            onClick={() => setFiltroEstatus('RESPUESTAS')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              filtroEstatus === 'RESPUESTAS'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-300"></span>
            Respuestas ({documentosRespuestas.length})
          </button>
        </div>

        {documentosAsignadosSeleccionados.length > 0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl animate-fade-in">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckSquare size={16} /> {documentosAsignadosSeleccionados.length} por recepcionar
            </span>
            <button
              onClick={() => handleConfirmarRecepcionMasiva()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
            >
              <CheckCircle2 size={14} /> Confirmar Recepción
            </button>
          </div>
        )}
      </div>

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
                <th className="p-4">Origen / Emisor</th>
                {esTabRespuestas && (
                  <>
                    <th className="p-4">Original</th>
                    <th className="p-4">Ubicación del original</th>
                    <th className="p-4">Destino respuesta</th>
                  </>
                )}
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Cargando correspondencias de la unidad...
                  </td>
                </tr>
              ) : documentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No hay correspondencias en esta categoría.
                  </td>
                </tr>
              ) : (
                documentosPaginados.map((doc) => {
                  const estatusConf = ESTATUS_CONFIG[doc.estatus] || {
                    label: doc.estatus,
                    color: 'bg-slate-100 text-slate-700',
                  };
                  const porConfirmar =
                    (!esTabRespuestas && doc.estatus === 'ASIGNADO') ||
                    (esTabRespuestas && doc.estatus === 'DEVUELTO_UNIDAD');
                  const puedeSeleccionar = esTabRespuestas
                    ? esRespuestaSeleccionable(
                        doc,
                        tipoSeleccionActivo as TipoSeleccionRespuesta | null
                      )
                    : (doc.estatus === 'ASIGNADO' || doc.estatus === 'RECIBIDO_UNIDAD') &&
                      (!tipoSeleccionActivo || doc.estatus === tipoSeleccionActivo);
                  const isChecked = seleccionados.includes(doc.id);
                  const ubicacionOriginal =
                    doc.documento_padre?.departamento_actual?.nombre ||
                    documentos.find((d) => String(d.id) === String(doc.documento_padre_id))
                      ?.departamento_actual?.nombre ||
                    departamentoNombre;

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isChecked ? 'bg-blue-50/40' : ''
                      }`}
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
                      <td>
                      {esTabRespuestas || doc.estatus === "RECIBIDO_UNIDAD" || doc.estatus === "ARCHIVADO" ? (
                            <button
                              onClick={() => abrirDetalle(doc)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                              Ver Detalle
                            </button>
                        ) : ""}
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
                      {esTabRespuestas && (
                        <>
                          <td className="p-4 font-semibold text-slate-700 whitespace-nowrap">
                            {doc.documento_padre?.oficio_serial || 'N/A'}
                          </td>
                          <td className="p-4 text-slate-600 whitespace-nowrap text-xs">
                            {ubicacionOriginal}
                          </td>
                          <td className="p-4 text-slate-600 whitespace-nowrap text-xs">
                            {doc.destino?.nombre || 'N/A'}
                          </td>
                        </>
                      )}
                      
                      <td className="p-4 text-right whitespace-nowrap space-x-2">
                        {porConfirmar ? (
                          <>
                            <button
                              onClick={() => handleConfirmarRecepcion(doc.id)}
                              disabled={loadingRecepcion}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} /> Confirmar Entrada
                            </button>
                            {!esTabRespuestas && (
                              <button
                                onClick={() => handleDevolverADespacho(doc.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <RotateCcw size={14} /> Devolver
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {esTabRespuestas && doc.estatus === 'AVALADO' && estaEnMiDepto(doc) && (
                              <button
                                onClick={() => handleTramitar([doc.id])}
                                disabled={loadingTramitar}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                              >
                                <Stamp size={14} /> TRAMITADO
                              </button>
                            )}
                            {esTabRespuestas && doc.estatus === 'TRAMITADO' && estaEnMiDepto(doc) && (
                              <button
                                onClick={() => solicitarArchivar([doc.id])}
                                disabled={loadingArchivar}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                              >
                                <Archive size={14} /> ARCHIVAR
                              </button>
                            )}
                            {puedeEditar && (
                              <button
                                onClick={() =>
                                  navigate(`/documentos/editar/${doc.id}`, {
                                    state: { from: '/departamento/bandeja' },
                                  })
                                }
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Pencil size={14} /> Editar
                              </button>
                            )}
                            {esAdmin && (
                              <button
                                onClick={() =>
                                  setDocumentoAEliminar({ id: doc.id, oficio_serial: doc.oficio_serial })
                                }
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white border border-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                              >
                                <Trash2 size={14} /> Anular
                              </button>
                            )}
                          </>
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

      
      {/* Modal reutilizable de Confirmación de Eliminación */}
      <ConfirmModalEliminar
        isOpen={!!documentoAEliminar}
        onClose={() => setDocumentoAEliminar(null)}
        onConfirm={handleConfirmarEliminacion}
        identificadorDoc={documentoAEliminar?.oficio_serial}
        loading={loadingEliminar}
      />

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
                        • {r.recaudo?.nombre}
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              {documentoSeleccionado.estatus === 'RECIBIDO_UNIDAD' && !documentoSeleccionado.documento_padre_id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => solicitarArchivar([documentoSeleccionado.id])}
                    disabled={loadingArchivar}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                  >
                    <Archive size={16} /> {loadingArchivar ? 'Archivando...' : 'Archivar'}
                  </button>
                  <button
                    onClick={() => handleRegistrarRespuesta(documentoSeleccionado.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                  >
                    <MessageSquarePlus size={16} /> Registrar Respuesta
                  </button>
                </div>
              ) : documentoSeleccionado.estatus === 'DEVUELTO_UNIDAD' &&
                documentoSeleccionado.documento_padre_id ? (
                <button
                  onClick={() => handleConfirmarRecepcion(documentoSeleccionado.id)}
                  disabled={loadingRecepcion}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />{' '}
                  {loadingRecepcion ? 'Confirmando...' : 'Confirmar Recepción'}
                </button>
              ) : documentoSeleccionado.estatus === 'AVALADO' &&
                documentoSeleccionado.documento_padre_id &&
                estaEnMiDepto(documentoSeleccionado) ? (
                <button
                  onClick={() => handleTramitar([documentoSeleccionado.id])}
                  disabled={loadingTramitar}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <FileCheck size={16} /> {loadingTramitar ? 'Procesando...' : 'TRAMITADO'}
                </button>
              ) : documentoSeleccionado.estatus === 'TRAMITADO' &&
                documentoSeleccionado.documento_padre_id &&
                estaEnMiDepto(documentoSeleccionado) ? (
                <button
                  onClick={() => solicitarArchivar([documentoSeleccionado.id])}
                  disabled={loadingArchivar}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <Archive size={16} /> {loadingArchivar ? 'Archivando...' : 'ARCHIVAR'}
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

      <ConfirmModal
        isOpen={!!idsPendientesArchivar}
        onClose={() => {
          if (!loadingArchivar) setIdsPendientesArchivar(null);
        }}
        onConfirm={() => handleArchivar(idsPendientesArchivar || [])}
        titulo="Archivar correspondencia"
        mensaje={
          (idsPendientesArchivar?.length || 0) === 1
            ? '¿Está seguro de que desea archivar este documento? Esta acción cambiará su estatus a ARCHIVADO.'
            : `¿Está seguro de que desea archivar ${idsPendientesArchivar?.length || 0} documentos? Esta acción cambiará su estatus a ARCHIVADO.`
        }
        confirmLabel="Archivar"
        loading={loadingArchivar}
      />
    </div>
  );
};