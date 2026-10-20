import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Building2,
  ExternalLink,
  User,
  Clock,
  Eye,
  X,
  FileText,
  Ban,
  AlertCircle,
  HelpCircle,
  Paperclip,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { obtenerTodosDocumentosAnulados } from '../api/documentos.api';
import { Paginacion } from '../components/ui/Paginacion';
import { ITEMS_POR_PAGINA, paginarLista } from '../utils/paginacion';

interface OrigenDestino {
  id: number;
  nombre: string;
}

interface UsuarioAccion {
  nombre: string;
  apellido: string;
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
  recaudos?: Array<{ id: string; recaudo_id?: number; recaudo?: { nombre: string } }>;
  usuario_registra?: UsuarioAccion;
  usuario_elimina?: UsuarioAccion;
  
  // Campos de trazabilidad de anulación / eliminación
  razon_eliminacion?: string;
  eliminado_at?: string;
  eliminado_por_usuario_id?: UsuarioAccion;
}

export const Anulados = () => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState<Documento | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);

  const cargarDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      setErrorApi(null);
      const lista = await obtenerTodosDocumentosAnulados();
      setDocumentos(lista);
    } catch (err) {
      if (isAxiosError(err)) {
        setErrorApi(err.response?.data?.error || 'Error al cargar documentos anulados');
      } else {
        setErrorApi('Error de conexión con el servidor');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  // Filtrado exclusivo de estatus ANULADO y búsqueda textual

  const documentosAnulados = documentos.filter((doc) => {
    const termino = busqueda.toLowerCase().trim();
    const coincideBusqueda =
      (doc.oficio_serial?.toLowerCase() || '').includes(termino) ||
      (doc.origen?.nombre?.toLowerCase() || '').includes(termino) ||
      (doc.descripcion?.toLowerCase() || '').includes(termino);

    return coincideBusqueda;
  });

  const {
    items: documentosPaginados,
    totalPaginas,
    paginaActual: paginaSegura,
    totalItems,
  } = paginarLista(documentosAnulados, paginaActual, ITEMS_POR_PAGINA);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Documentos Anulados</h1>
            <span className="px-2.5 py-0.5 bg-red-100 text-red-700 font-semibold text-xs rounded-full border border-red-200">
              {documentosAnulados.length} Anulados
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Histórico y registro de correspondencias que han sido anuladas o dadas de baja en el sistema.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por oficio, origen o asunto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none w-64 md:w-80"
          />
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

      {/* Tabla de Documentos Anulados */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Estatus</th>
                <th className="p-4">N° Oficio</th>
                <th className="p-4">Origen / Emisor</th>
                <th className="p-4">Asunto / Descripción</th>
                <th className="p-4">Fecha Registro</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    Cargando historial de documentos anulados...
                  </td>
                </tr>
              ) : documentosAnulados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Ban className="mx-auto mb-2 text-slate-300" size={32} />
                    No se encontraron correspondencias anuladas.
                  </td>
                </tr>
              ) : (
                documentosPaginados.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
                        <Ban size={12} />
                        ANULADO
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-slate-700 whitespace-nowrap">
                      {doc.oficio_serial}
                    </td>
                    <td className="p-4 font-medium text-slate-700 whitespace-nowrap">
                      {doc.origen?.nombre || 'N/A'}
                    </td>
                    <td className="p-4 text-slate-600 max-w-xs truncate" title={doc.descripcion}>
                      {doc.descripcion}
                    </td>
                    <td className="p-4 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(doc.fecha).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setDocumentoSeleccionado(doc)
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye size={14} /> Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))
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

      {/* Modal Ver Detalle (Con información de Anulación) */}
      {documentoSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                  Documento Anulado — {documentoSeleccionado.oficio_tipo}
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
              {/* Sección Destacada: Informes de Anulación */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                  <AlertCircle size={18} className="text-red-600" />
                  Información de la Anulación
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-xs text-red-600 font-semibold uppercase block">Anulado Por:</span>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <User size={14} className="text-slate-500" />
                      {documentoSeleccionado.usuario_elimina
                        ? `${documentoSeleccionado.usuario_elimina.nombre} ${documentoSeleccionado.usuario_elimina.apellido}`
                        : 'No especificado'}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-red-600 font-semibold uppercase block">Fecha / Hora de Anulación:</span>
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Clock size={14} className="text-slate-500" />
                      {documentoSeleccionado.eliminado_at
                        ? new Date(documentoSeleccionado.eliminado_at).toLocaleString()
                        : 'No registrada'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-red-200/60 pt-2.5">
                  <span className="text-xs text-red-600 font-semibold uppercase block flex items-center gap-1 mb-1">
                    <HelpCircle size={13} /> Motivo o Razón de la Anulación:
                  </span>
                  <p className="text-sm text-slate-700 bg-white/80 p-3 rounded-lg border border-red-100 italic">
                    "{documentoSeleccionado.razon_eliminacion || 'Sin motivo registrado.'}"
                  </p>
                </div>
              </div>

              {/* Datos Generales del Documento */}
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
                    <User size={14} /> Registrado Originalmente Por
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {documentoSeleccionado.usuario_registra
                      ? `${documentoSeleccionado.usuario_registra.nombre} ${documentoSeleccionado.usuario_registra.apellido}`
                      : 'Sistema / N/A'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                    <Clock size={14} /> Fecha Registro Original
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {new Date(documentoSeleccionado.fecha).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Asunto */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Descripción / Asunto
                </h3>
                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
                  {documentoSeleccionado.descripcion}
                </p>
              </div>

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

              {/* Visor PDF si existe */}
              {documentoSeleccionado.pdf_url ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} /> Archivo Adjunto (PDF)
                    </h3>
                    <a
                      href={documentoSeleccionado.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Abrir en nueva pestaña <ExternalLink size={12} />
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
              ) : (
                <div className="p-4 bg-slate-100 text-slate-500 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} />
                  Este documento no posee archivo PDF adjunto.
                </div>
              )}
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