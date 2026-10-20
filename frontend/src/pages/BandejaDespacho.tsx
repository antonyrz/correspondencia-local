import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { ESTATUS_DOCUMENTO } from '../constants/statusDocumento';
import { isAxiosError } from 'axios';
import { obtenerTodosDocumentos, cambiarEstatusDocumento, confirmarDevolucionDespacho, eliminarDocumento, enviarDocumentosADestino} from '../api/documentos.api';
import { getDepartamentosApi, type Departamento } from '../api/departamentos.api';
import { ConfirmModalEliminar } from '../components/layout/ConfirmModalEliminar';
import { Paginacion } from '../components/ui/Paginacion';
import { ITEMS_POR_PAGINA, paginarLista } from '../utils/paginacion';


import {
  Search,
  Eye,
  Pencil,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Paperclip,
  Building2,
  MapPin,
  RotateCcw,
  SendHorizontal,
  Clock,
  User,
  ExternalLink,
  Trash2,
  ShieldAlertIcon
} from 'lucide-react';

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
  destino_id?: number | string | null;
  departamento_actual_id?: number | null;
  departamentos?: OrigenDestino[];
  departamento_actual?: OrigenDestino | null;
  usuario_registra?: UsuarioRegistra;
  recaudos?: RecaudoDetalle[];
  observacion: string;
  documento_padre_id?: string | number | null;
}

const ESTATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RECIBIDO: { label: 'RECIBIDO', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  EN_DESPACHO: { label: 'EN DESPACHO', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  VISADO: { label: 'VISADO POR DIRECCIÓN', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ASIGNADO: { label: 'ASIGNADO', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  RECIBIDO_UNIDAD: { label: 'RECIBIDO EN UNIDAD', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  DEVUELTO_DESPACHO: { label: 'DEVUELTO A DESPACHO', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  DEVUELTO_UNIDAD: { label: 'DEVUELTO A UNIDAD', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  PROCESO_DE_AVAL: { label: 'PROCESO DE AVAL', color: 'bg-violet-100 text-violet-800 border-violet-300' },
  AVALADO: { label: 'AVALADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  TRAMITADO: { label: 'TRAMITADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  ARCHIVADO: { label: 'ARCHIVADO', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

interface BandejaDespachoProps {
  onExito?: () => void;
}

export const BandejaDespacho: React.FC<BandejaDespachoProps> = ({ onExito }) => {
  const navigate = useNavigate();
  const usuario = useAuthStore((state) => state.user);
  const rol = (usuario?.rol || '').toLowerCase().trim();
  const esAdmin = rol === 'administrador';
  const esSecretaria = rol === 'secretaria_despacho';

  // Estados de datos
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);

  const scrollSuperiorRef = useRef<HTMLDivElement>(null);
  const scrollTablaRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLTableElement>(null);
  const [anchoTabla, setAnchoTabla] = useState(0);

  // Estados de filtros y selección
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstatus, setFiltroEstatus] = useState<string>('TODOS');
  const [filtroDeptoActual, setFiltroDeptoActual] = useState<string>('TODOS');
  const [deptoDestinoSeleccionado, setDeptoDestinoSeleccionado] = useState<string>('');
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);

  const [documentoAEliminar, setDocumentoAEliminar] = useState<{ id: string; oficio_serial: string } | null>(null);
  const [loadingEliminar, setLoadingEliminar] = useState<boolean>(false);
  const [paginaActual, setPaginaActual] = useState(1);

  // Función unificada para cargar/refrescar la lista de documentos
  const cargarDocumentos = useCallback(async (mostrarLoading = false) => {

    try {
      if (mostrarLoading) {
        setLoading(true);
      }
      setErrorApi(null);
      const lista = await obtenerTodosDocumentos();
      const filtroDepartamento = lista.filter((doc) =>  {
      if(doc.departamento_actual_id === 2 || doc.estatus === 'ASIGNADO' || doc.estatus === 'RECIBIDO_UNIDAD' || doc.estatus === 'DEVUELTO_DESPACHO' ){
        return doc; 
      }
      });
      setDocumentos(filtroDepartamento);
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

  const cargarDepartamentos = useCallback(async (mostrarLoading = false) => {
    try {
      if (mostrarLoading) {
        setLoading(true);
      }
      setErrorApi(null);
      const data = await getDepartamentosApi();
      setDepartamentos(data ? data : []);
    } catch (err) {
      console.error('Error al cargar Departamentos:', err);
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al obtener la lista de departamentos');
      } else {
        setErrorApi('Error al conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial al montar el componente
  useEffect(() => {
    let isMounted = true;
  
    const ejecutarCarga = async () => {
      await cargarDocumentos(false);
      await cargarDepartamentos(false);
    };
  
    ejecutarCarga();
  
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper de ubicación
  const obtenerNombreUbicacion = (doc: Documento): { nombre: string; esDespacho: boolean } | null => {
    const deptoId = doc.departamento_actual_id ?? doc.departamento_actual?.id;
    if (!deptoId) return null;

    if (+deptoId === 2) {
      return { nombre: 'SECRETARÍA DE DESPACHO', esDespacho: true };
    }

    const deptoEncontrado =
      departamentos.find((d) => d.id === Number(deptoId)) ||
      doc.departamentos?.find((d) => d.id === deptoId);

    const nombre = deptoEncontrado?.nombre || doc.departamento_actual?.nombre || `Depto. #${deptoId}`;

    return { nombre, esDespacho: false };
  };

  // Filtrado de documentos visibles
  const documentosFiltrados = Array.isArray(documentos)
    ? documentos
        .filter((doc) => {
          if (doc.estatus === 'RECIBIDO') return false;
          if (doc.documento_padre_id) return false;

          const coincideEstatus =
            filtroEstatus === 'TODOS' ? true : doc.estatus === filtroEstatus;

          const coincideDeptoDestino =
            filtroDeptoActual === 'TODOS'
              ? true
              : String(doc.departamento_actual_id) === filtroDeptoActual ||
                String(doc.departamento_actual_id) === filtroDeptoActual;

          const termino = busqueda.toLowerCase();
          const coincideBusqueda =
            (doc.oficio_serial?.toLowerCase() || '').includes(termino) ||
            (doc.origen?.nombre?.toLowerCase() || '').includes(termino) ||
            (doc.descripcion?.toLowerCase() || '').includes(termino);

          return coincideEstatus && coincideDeptoDestino && coincideBusqueda;
        })
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
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
  }, [filtroEstatus, filtroDeptoActual, busqueda]);

  // Selección de documentos
  const documentosSeleccionadosObjs = documentos.filter((d) => seleccionados.includes(String(d.id)));

  const todosPorVisar =
    documentosSeleccionadosObjs.length > 0 &&
    documentosSeleccionadosObjs.every((d) => d.estatus === 'EN_DESPACHO');

  const todosListosParaEnviar =
    documentosSeleccionadosObjs.length > 0 &&
    documentosSeleccionadosObjs.every(
      (d) => d.estatus === 'VISADO'
    );

  const toggleSeleccion = (doc: Documento) => {
    const stringId = String(doc.id);

    if (seleccionados.includes(stringId)) {
      setSeleccionados(seleccionados.filter((item) => item !== stringId));
      return;
    }

    if (seleccionados.length > 0) {
      const primerEstatus = documentosSeleccionadosObjs[0].estatus;

      if (primerEstatus !==  doc.estatus) {
        alert('No puedes seleccionar al mismo tiempo documentos en diferentes status.');
        return;
      }

    }

    setSeleccionados([...seleccionados, stringId]);
  };

  // Acciones de API
  const handleMarcarComoVisado = async () => {
    if (seleccionados.length === 0 || !todosPorVisar) return;

    if (!confirm(`¿Desea marcar como VISADO ${seleccionados.length} correspondencia(s)?`)) {
      return;
    }

    try {
      setProcesandoAccion(true);
      setErrorApi(null);

      for (const id of seleccionados) {
        await cambiarEstatusDocumento(id, ESTATUS_DOCUMENTO?.VISADO || 'VISADO');
      }

      setSeleccionados([]);
      await cargarDocumentos();
      if (onExito) onExito();
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al cambiar estatus a Visado');
      } else {
        setErrorApi('Error inesperado al procesar la solicitud');
      }
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Confirmación de devolución utilizando la función específica del controlador que cambia estatus a DEVUELTO_DESPACHO y depto a 2
  const handleConfirmarDevolucion = async (idDocumento: string) => {
    if (!confirm('¿Desea confirmar la recepción de esta devolución en Despacho?')) {
      return;
    }

    try {
      setProcesandoAccion(true);
      setErrorApi(null);

      // Llamada directa al endpoint correspondiente que ejecuta la transacción en el backend
      const res = await confirmarDevolucionDespacho(idDocumento);

      await cargarDocumentos();
      if (onExito) onExito();
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al confirmar la devolución');
      } else {
        setErrorApi('Error inesperado al procesar la devolución');
      }
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleEnviarADepartamento = async () => {
    if (seleccionados.length === 0 || !todosListosParaEnviar) return;

    if (!deptoDestinoSeleccionado) {
      alert('Por favor, selecciona un departamento de destino para realizar el envío.');
      return;
    }

    const deptoObj = departamentos.find((d) => d.id === Number(deptoDestinoSeleccionado));

    if(!deptoObj) return

    if (
      !confirm(
        `¿Desea enviar ${seleccionados.length} documento(s) al departamento: ${deptoObj?.nombre}?`
      )
    ){
      return;
    }
    
    try {
      setProcesandoAccion(true);
      setErrorApi(null);

      const nuevoEstatus = ESTATUS_DOCUMENTO?.ASIGNADO || 'ASIGNADO';


      for (const id of seleccionados) {
        await enviarDocumentosADestino(seleccionados, deptoObj.id);
        await cambiarEstatusDocumento(id, nuevoEstatus, Number(deptoDestinoSeleccionado));
      }

      setSeleccionados([]);
      setDeptoDestinoSeleccionado('');
      await cargarDocumentos();
      if (onExito) onExito();
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al enviar correspondencia al departamento');
      } else {
        setErrorApi('Error inesperado al procesar la transferencia');
      }
    } finally {
      setProcesandoAccion(false);
    }
  };

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
      {/* Header General */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Módulo de Secretaría de Despacho</h1>
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-full">
              {documentosFiltrados.length} Visibles
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Revisión, visado oficial y distribución de correspondencias internas hacia departamentos.
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
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
            />
          </div>

          

          {/* Botón Visar */}
          {todosPorVisar && (
            <button
              onClick={handleMarcarComoVisado}
              disabled={procesandoAccion}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-sm animate-pulse"
            >
              <CheckCircle2 size={16} />
              Marcar como Visado ({seleccionados.length})
            </button>
          )}

          {/* Formulario de envío */}
          {todosListosParaEnviar && (
            <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-xl border border-indigo-200">
              <select
                value={deptoDestinoSeleccionado}
                onChange={(e) => setDeptoDestinoSeleccionado(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none max-w-55"
              >
                <option value="">-- Seleccionar Destino --</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>

              <button
                onClick={handleEnviarADepartamento}
                disabled={procesandoAccion || !deptoDestinoSeleccionado}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <SendHorizontal size={14} />
                Enviar ({seleccionados.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {errorApi && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={18} />
          {errorApi}
        </div>
      )}

      {/* Filtros Secundarios */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            onClick={() => setFiltroEstatus('TODOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filtroEstatus === 'TODOS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFiltroEstatus('EN_DESPACHO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroEstatus === 'EN_DESPACHO'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-300"></span>
            Por Visar ({documentos.filter((d) => d.estatus === 'EN_DESPACHO').length})
          </button>
          <button
            onClick={() => setFiltroEstatus('VISADO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroEstatus === 'VISADO'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-300"></span>
            Visados ({documentos.filter((d) => d.estatus === 'VISADO').length})
          </button>
          <button
            onClick={() => setFiltroEstatus('ASIGNADO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroEstatus === 'ASIGNADO'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-300"></span>
            Asignados ({documentos.filter((d) => d.estatus === 'ASIGNADO').length})
          </button>
          <button
            onClick={() => setFiltroEstatus('RECIBIDO_UNIDAD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroEstatus === 'RECIBIDO_UNIDAD'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-300"></span>
            Recibidos en Unidad ({documentos.filter((d) => d.estatus === 'RECIBIDO_UNIDAD').length})
          </button>
          <button
            onClick={() => setFiltroEstatus('DEVUELTO_DESPACHO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroEstatus === 'DEVUELTO_DESPACHO'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-300"></span>
            Devueltos ({documentos.filter((d) => d.estatus === 'DEVUELTO_DESPACHO').length})
          </button>
        </div>

        {/* Filtro por ubicacion de departamento */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            <Building2 size={14} /> Ubicación:
          </span>
          <select
            value={filtroDeptoActual}
            onChange={(e) => setFiltroDeptoActual(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="TODOS">Todos los departamentos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
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
                <th className="p-4 w-12 text-center">Sel.</th>
                <th className="p-4">Estatus</th>
                <th className="p-4">Info</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">N° Oficio</th>
                <th className="p-4">Asunto / Descripción</th>
                <th className="p-4">Origen</th>
                <th className="p-4">Ubicación Actual</th>
                <th className="p-4">Destino Asignado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    Cargando correspondencias de Despacho...
                  </td>
                </tr>
              ) : documentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <FileText className="mx-auto mb-2 text-slate-300" size={32} />
                    No hay correspondencias en esta sección.
                  </td>
                </tr>
              ) : (
                documentosPaginados.map((doc) => {
                  const stringId = String(doc.id);
                  const estaSeleccionado = seleccionados.includes(stringId);

                  const sePuedeSeleccionar =
                    doc.estatus === 'EN_DESPACHO' ||
                    doc.estatus === 'VISADO';

                  const configEstatus = ESTATUS_CONFIG[doc.estatus] || {
                    label: doc.estatus,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  const ubicacion = obtenerNombreUbicacion(doc);
                  const deptoDestinoObj = departamentos.find(
                    (d) => d.id === Number(doc.destino_id || doc.destino?.id)
                  );

                  return (
                    <tr
                      key={stringId}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        estaSeleccionado ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      
                      <td className="p-4 text-center">
                        {sePuedeSeleccionar && (
                          <input
                            type="checkbox"
                            checked={estaSeleccionado}
                            onChange={() => toggleSeleccion(doc)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                      </td>
                      
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${configEstatus.color}`}
                        >
                          {doc.estatus === 'DEVUELTO_DESPACHO' ? (
                            <RotateCcw size={12} />
                          ) : doc.estatus === 'EN_DESPACHO' ? (
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
                        {deptoDestinoObj ? deptoDestinoObj.nombre : 'Sin asignar'}
                      </td>
                      
                      
                      <td className="p-4 text-right whitespace-nowrap space-x-2">
                        {doc.estatus === 'DEVUELTO_DESPACHO' && (
                          <button
                            onClick={() => handleConfirmarDevolucion(stringId)}
                            disabled={procesandoAccion}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            title="Confirmar Devolución"
                          >
                            <CheckCircle2 size={14} /> Confirmar Devolución
                          </button>
                        )}

                        {esSecretaria && 
                          doc.departamento_actual_id == 2 &&
                        (
                          <button
                            onClick={() =>
                              navigate(`/documentos/editar/${stringId}`, {
                                state: { from: '/despacho/bandeja' },
                              })
                            }
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Pencil size={14} /> Editar
                          </button>
                        )}

                          {esAdmin && 
                          (
                            <button
                              onClick={() =>
                                navigate(`/documentos/editar/${stringId}`, {
                                  state: { from: '/despacho/bandeja' },
                                })
                              }
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Pencil size={14} /> Editar
                            </button>
                          )}

                          {esAdmin && (
                            <button
                              onClick={() => setDocumentoAEliminar({ id: stringId, oficio_serial: doc.oficio_serial })}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white border border-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            >
                              <Trash2 size={14} /> Anular
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

        {/* Modal reutilizable de Confirmación de Eliminación */}
        <ConfirmModalEliminar
          isOpen={!!documentoAEliminar}
          onClose={() => setDocumentoAEliminar(null)}
          onConfirm={handleConfirmarEliminacion}
          identificadorDoc={documentoAEliminar?.oficio_serial}
          loading={loadingEliminar}
      />

      {/* Modal Visor de Detalles */}
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
                    <p className="text-sm font-semibold text-slate-800 wrap-break-words">
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {documentoSeleccionado.estatus === 'DEVUELTO_DESPACHO' && (
                <button
                  onClick={() => {
                    handleConfirmarDevolucion(String(documentoSeleccionado.id));
                    setDocumentoSeleccionado(null);
                  }}
                  disabled={procesandoAccion}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 size={16} /> Confirmar Devolución
                </button>
              )}
              <button
                onClick={() => setDocumentoSeleccionado(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer ml-auto"
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