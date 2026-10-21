import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  getCatalogs,
  getRecaudos,
  createDocumento,
  actualizarDocumento,
  getDocumentoDetalle,
  verificarSerialDocumento,
  type CategoriaCatalog,
  type RecaudoCatalog,
} from '../api/documentos.api';
import { 
  FileUp, 
  Send, 
  CheckCircle2, 
  Calendar, 
  FileText, 
  CheckSquare, 
  AlertCircle, 
  Upload, 
  FileCheck, 
  X,
  Loader2
} from 'lucide-react';

const TIPOS_DOCUMENTO = [
  'SOLICITUD DE PROCESO/TRAMITE',
  'SOLICITUD DE DATA',
  'SOLICITUD DE INFORMACION',
  'INFORMATIVO',
] as const;

const CATEGORIAS_PRIORITARIAS = [
  'RECTORÍA',
  'VICERRECTORADO ACADÉMICO',
  'VICERRECTORADO ADMINISTRATIVO',
  'SECRETARIA',
  'SECRETARÍA',
];

const NOMBRE_SIN_RECAUDOS = 'sin recaudos adjuntos';

const esRecaudoSinAdjuntos = (nombre: string) =>
  nombre.trim().toLowerCase() === NOMBRE_SIN_RECAUDOS;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const archivoOpcionalSchema = z
  .custom<FileList>()
  .optional()
  .refine(
    (files) => !files || files.length === 0 || files[0]?.type === 'application/pdf',
    'El archivo debe ser en formato PDF'
  )
  .refine(
    (files) => !files || files.length === 0 || files[0]?.size <= MAX_FILE_SIZE,
    'El archivo no debe superar los 10MB'
  );

const archivoRequeridoSchema = z
  .custom<FileList>()
  .refine((files) => files && files.length > 0, 'Debes adjuntar un archivo PDF')
  .refine((files) => files && files[0]?.type === 'application/pdf', 'El archivo debe ser en formato PDF')
  .refine((files) => files && files[0]?.size <= MAX_FILE_SIZE, 'El archivo no debe superar los 10MB');

const fechaMaximaHoy = () => new Date().toISOString().split('T')[0];

const crearDocumentoSchema = (esEdicion: boolean, esRespuesta: boolean) =>
  z.object({
    serial: z.string().min(1, 'El serial o número correlativo es obligatorio'),
    fechaEmision: z
      .string()
      .min(1, 'La fecha del documento es obligatoria')
      .refine(
        (fecha) => fecha <= fechaMaximaHoy(),
        'La fecha del documento no puede ser futura'
      ),
    titulo: z.string().min(3, 'El asunto es obligatorio'),
    categoriaOrigenId: z
      .string()
      .min(1, esRespuesta ? 'Selecciona la categoría destino' : 'Selecciona la categoría de origen'),
    origenId: z
      .string()
      .min(1, esRespuesta ? 'Selecciona el destino específico' : 'Selecciona el origen'),
    tipoDocumento: z.string().min(1, 'Selecciona el tipo de documento'),
    prioridad: z.boolean(),
    requiresResponse: z.boolean(),
    recaudosSeleccionados: esRespuesta
      ? z.array(z.string()).optional()
      : z.array(z.string()).min(1, 'Seleccione al menos un recaudo'),
    observacion: z.string().optional(),
    archivo: esEdicion ? archivoOpcionalSchema : archivoRequeridoSchema,
  });

type DocumentoForm = z.infer<ReturnType<typeof crearDocumentoSchema>>;

export const NuevoDocumento = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation(); 
  const estadoNavegacion = location.state as { from?: string; documentoPadreId?: string } | null;
  const rutaOrigen = estadoNavegacion?.from;
  const documentoPadreId = estadoNavegacion?.documentoPadreId;
  const esRespuesta = Boolean(documentoPadreId) || location.pathname.includes('/responder');
  const esEdicion = Boolean(id) && !esRespuesta;

  const [categorias, setCategorias] = useState<CategoriaCatalog[]>([]);
  const [recaudosCatalogo, setRecaudosCatalogo] = useState<RecaudoCatalog[]>([]);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cargandoDocumento, setCargandoDocumento] = useState(esEdicion || esRespuesta);
  const [archivoActual, setArchivoActual] = useState<string | null>(null);
  const [mostrarRecaudos, setMostrarRecaudos] = useState(false);	

  const [documentoPadre, setDocumentoPadre] = useState<{
    id: string;
    oficio_serial: string;
    oficio_tipo: string;
    origen_id?: number;
    origen?: { id: number; nombre: string };
    destino_id?: number | null;
    destino?: { id: number; nombre: string } | null;
    departamento_actual_id?: number | null;
    prioridad?: boolean;
  } | null>(null);
  const omitirPrioridadAutomatica = useRef(esEdicion);

  const documentoSchema = useMemo(
    () => crearDocumentoSchema(esEdicion, esRespuesta),
    [esEdicion, esRespuesta]
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    getValues,
    reset,
    resetField,
    control,
    formState: { errors },
  } = useForm<DocumentoForm>({
    resolver: zodResolver(documentoSchema),
    defaultValues: {
      requiresResponse: false,
      prioridad: false,
      fechaEmision: new Date().toISOString().split('T')[0],
      recaudosSeleccionados: [],
    },
  });

  const selectedCategoriaOrigen = useWatch({ control, name: 'categoriaOrigenId' });
  const selectedTipoDocumento = useWatch({ control, name: 'tipoDocumento' });
  const archivoSeleccionado = useWatch({ control, name: 'archivo' });
  const recaudosSeleccionados = useWatch({ control, name: 'recaudosSeleccionados' }) || [];

  const recaudoSinAdjuntos = recaudosCatalogo.find((r) => esRecaudoSinAdjuntos(r.nombre));

  const catOrigen = categorias.find((c) => c.id === Number(selectedCategoriaOrigen));
  const origenesFiltrados = catOrigen?.origenDestinos || [];

  useEffect(() => {
    if (esRespuesta || !catOrigen || omitirPrioridadAutomatica.current) return;
    const esPrioritaria = CATEGORIAS_PRIORITARIAS.includes(
      catOrigen.nombre.trim().toUpperCase()
    );
    setValue('prioridad', esPrioritaria);
  }, [esRespuesta, catOrigen, setValue]);

  useEffect(() => {
    if (selectedTipoDocumento === 'INFORMATIVO') {
      setValue('requiresResponse', false);
    }
  }, [selectedTipoDocumento, setValue]);

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const [data, recaudos] = await Promise.all([getCatalogs(), getRecaudos()]);
        setCategorias(data.catalogos || []);
        setRecaudosCatalogo(recaudos);
      } catch {
        setErrorApi('No se pudieron cargar los catálogos del sistema');
      }
    };
    fetchCatalogs();
    window.addEventListener('catalogos-actualizados', fetchCatalogs);
    return () => window.removeEventListener('catalogos-actualizados', fetchCatalogs);
  }, []);

  useEffect(() => {
    if (!esRespuesta || !documentoPadreId) {
      if (esRespuesta && !documentoPadreId) {
        setErrorApi('No se indicó el documento origen de esta respuesta.');
        setCargandoDocumento(false);
      }
      return;
    }

    const cargarPadre = async () => {
      try {
        setCargandoDocumento(true);
        setErrorApi(null);
        const padre = await getDocumentoDetalle(documentoPadreId);
        setDocumentoPadre(padre);
        setValue('tipoDocumento', padre.oficio_tipo || '');
        setValue('prioridad', Boolean(padre.prioridad));
        setValue('requiresResponse', false);
        setValue('recaudosSeleccionados', []);
      } catch {
        setErrorApi('No se pudo cargar el documento origen de la respuesta');
      } finally {
        setCargandoDocumento(false);
      }
    };

    cargarPadre();
  }, [esRespuesta, documentoPadreId, setValue]);

  useEffect(() => {
    if (!esEdicion || !id || categorias.length === 0 || recaudosCatalogo.length === 0) return;

    const cargarDocumento = async () => {
      try {
        setCargandoDocumento(true);
        setErrorApi(null);
        omitirPrioridadAutomatica.current = true;

        const doc = await getDocumentoDetalle(id);
        const categoriaId = doc.origen?.categoria_id
          ? String(doc.origen.categoria_id)
          : categorias.find((c) =>
              c.origenDestinos.some((o) => o.id === Number(doc.origen_id ?? doc.origen?.id))
            )?.id?.toString() || '';

        const recaudosIds: string[] = Array.isArray(doc.recaudos)
          ? doc.recaudos
              .map((r: { recaudo_id?: number; recaudo?: { id?: number } }) =>
                String(r.recaudo_id ?? r.recaudo?.id ?? '')
              )
              .filter(Boolean)
          : [];

        setMostrarRecaudos(Boolean(doc.documento_padre_id));
        reset({
          serial: doc.oficio_serial || '',
          fechaEmision: doc.fecha ? String(doc.fecha).slice(0, 10) : '',
          titulo: doc.descripcion || '',
          categoriaOrigenId: categoriaId,
          origenId: String(doc.origen_id ?? doc.origen?.id ?? ''),
          tipoDocumento: doc.oficio_tipo || '',
          prioridad: Boolean(doc.prioridad),
          requiresResponse: Boolean(doc.requiere_respuesta),
          observacion: doc.observacion || '',
          recaudosSeleccionados: recaudosIds || [],
        });
        setArchivoActual(doc.pdf_nombre_original || 'Documento PDF actual');
      } catch {
        setErrorApi('No se pudo cargar el documento para editar');
      } finally {
        setCargandoDocumento(false);
        setTimeout(() => {
          omitirPrioridadAutomatica.current = false;
        }, 0);
      }
    };

    cargarDocumento();
  }, [esEdicion, id, categorias, recaudosCatalogo, reset]);

  const limpiarArchivo = () => {
    resetField('archivo');
  };

  const toggleRecaudo = (id: string, checked: boolean) => {
    const actual = getValues('recaudosSeleccionados') || [];
    const idSinAdjuntos = recaudoSinAdjuntos ? String(recaudoSinAdjuntos.id) : null;

    if (!checked) {
      setValue(
        'recaudosSeleccionados',
        actual.filter((item) => item !== id),
        { shouldDirty: true }
      );
      return;
    }

    if (idSinAdjuntos && id === idSinAdjuntos) {
      setValue('recaudosSeleccionados', [id], { shouldDirty: true });
      return;
    }

    setValue(
      'recaudosSeleccionados',
      [...actual.filter((item) => item !== idSinAdjuntos), id],
      { shouldDirty: true }
    );
  };

  const onSubmit = async (values: DocumentoForm) => {
    try {
      setLoading(true);
      setErrorApi(null);
      setExito(false);

      const serialTrim = values.serial.trim();
      const verificacion = await verificarSerialDocumento(
        serialTrim,
        esEdicion && id ? id : undefined
      );

      if (verificacion.existe) {
        const mensaje =
          'Ya existe un documento registrado con ese serial. No se puede guardar.';
        alert(mensaje);
        setError('serial', { type: 'manual', message: mensaje });
        setErrorApi(mensaje);
        return;
      }

      const requiresResponseValue = values.tipoDocumento === 'INFORMATIVO' ? false : values.requiresResponse;

      const formData = new FormData();
      formData.append('oficio_serial', serialTrim);
      formData.append(
        'oficio_tipo',
        esRespuesta ? documentoPadre?.oficio_tipo || values.tipoDocumento : values.tipoDocumento
      );
      formData.append('descripcion', values.titulo);
      formData.append('fecha_emision', values.fechaEmision);
      formData.append('observacion', String(values.observacion ?? ''));

      if (esRespuesta && documentoPadreId) {
        const origenRespuesta =
          documentoPadre?.destino_id ??
          documentoPadre?.destino?.id ??
          documentoPadre?.origen_id ??
          documentoPadre?.origen?.id;
        formData.append('documento_padre_id', String(documentoPadreId));
        formData.append('destino_id', values.origenId);
        if (origenRespuesta) {
          formData.append('origen_id', String(origenRespuesta));
        }
        if (documentoPadre?.departamento_actual_id) {
          formData.append('departamento_actual_id', String(documentoPadre.departamento_actual_id));
        }
        formData.append('prioridad', String(Boolean(documentoPadre?.prioridad)));
        formData.append('requires_response', 'false');
        formData.append('recaudo_ids', JSON.stringify([]));
        formData.append('tiene_recaudos', 'false');
      } else {
        formData.append('origen_id', values.origenId);
        formData.append('prioridad', String(values.prioridad));
        formData.append('requires_response', String(requiresResponseValue));

        const idsRecaudos = (values.recaudosSeleccionados || []).map(Number).filter((n) => !Number.isNaN(n));
        const tieneRecaudos = idsRecaudos.some((idRecaudo) => {
          const item = recaudosCatalogo.find((r) => r.id === idRecaudo);
          return item ? !esRecaudoSinAdjuntos(item.nombre) : true;
        });


        formData.append('recaudo_ids', JSON.stringify(idsRecaudos));
        formData.append('tiene_recaudos', String(tieneRecaudos));
      }

      if (values.archivo && values.archivo.length > 0) {
        formData.append('archivo', values.archivo[0]);
      }

      if (esEdicion && id) {
        await actualizarDocumento(id, formData);
        setExito(true);
        setTimeout(() => {
          if (rutaOrigen) {
            navigate(rutaOrigen);
          } else {
            navigate(-1);
          }
        }, 800);
      } else {
        await createDocumento(formData);
        setExito(true);
        if (esRespuesta && rutaOrigen) {
          setTimeout(() => navigate(rutaOrigen), 800);
        } else {
          reset();
        }
      }
    } catch (err) {
      if (isAxiosError(err)) {
        const mensajeApi =
          err.response?.data?.error ||
          (esEdicion ? 'Error al actualizar el documento' : 'Error al registrar el documento');
        if (err.response?.status === 409) {
          alert(mensajeApi);
          setError('serial', { type: 'manual', message: mensajeApi });
        }
        setErrorApi(mensajeApi);
      } else {
        setErrorApi('Error inesperado al conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  const categoriaOrigenRegister = register('categoriaOrigenId');

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <FileUp size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              {esEdicion
                ? 'Editar Correspondencia'
                : esRespuesta
                ? 'Registrar Respuesta'
                : 'Registrar Correspondencia'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {esEdicion
                ? 'Modifica los datos del documento. El archivo PDF es opcional si ya existe uno adjunto.'
                : esRespuesta
                ? 'Registra la respuesta asociada a la correspondencia seleccionada.'
                : 'Ingresa los detalles del documento y adjunta el archivo digital escaneado.'}
            </p>
          </div>
        </div>

        {errorApi && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-red-600" />
            <span>{errorApi}</span>
          </div>
        )}

        {exito && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>
              {esEdicion
                ? 'Documento actualizado exitosamente en el sistema.'
                : esRespuesta
                ? 'Respuesta registrada exitosamente en el sistema.'
                : 'Documento registrado exitosamente en el sistema.'}
            </span>
          </div>
        )}

        {cargandoDocumento ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 size={28} className="animate-spin text-blue-600" />
            <p className="text-sm font-medium">Cargando documento...</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {esRespuesta && documentoPadre && (
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 mb-1">
                Documento origen de esta respuesta
              </p>
              <p className="text-sm font-bold text-slate-800">{documentoPadre.oficio_serial}</p>
              {documentoPadre.oficio_tipo && (
                <p className="text-xs text-slate-500 mt-0.5">{documentoPadre.oficio_tipo}</p>
              )}
            </div>
          )}

          {/* Fila 1: Serial y Fecha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText size={16} className="text-slate-400" /> N° Serial / Correlativo
              </label>
              <input
                type="text"
                {...register('serial')}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 text-sm transition-all"
                placeholder="Ej: OF-2026-0045"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar size={16} className="text-slate-400" /> Fecha del Documento
              </label>
              <input
                type="date"
                max={fechaMaximaHoy()}
                {...register('fechaEmision')}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-slate-800 text-sm transition-all"
              />
              {errors.fechaEmision && <p className="text-red-500 text-xs mt-1 font-medium">{errors.fechaEmision.message}</p>}
            </div>
          </div>

          {/* Asunto / Descripción */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Asunto / Descripción
            </label>
            <input
              type="text"
              {...register('titulo')}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 text-sm transition-all"
              placeholder="Ej: Memoria descriptiva de proyecto..."
            />
            {errors.titulo && <p className="text-red-500 text-xs mt-1 font-medium">{errors.titulo.message}</p>}
          </div>

          {/* Tipo de Documento */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento</label>
            {esRespuesta ? (
              <>
                <input type="hidden" {...register('tipoDocumento')} />
                <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-sm font-medium">
                  {documentoPadre?.oficio_tipo || selectedTipoDocumento || '—'}
                </div>
              </>
            ) : (
              <select
                {...register('tipoDocumento')}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 text-sm transition-all"
              >
                <option value="">-- Seleccionar Tipo --</option>
                {TIPOS_DOCUMENTO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            )}
            {errors.tipoDocumento && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.tipoDocumento.message}</p>
            )}
          </div>

          {/* Origen / Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {esRespuesta ? 'Categoría Destino' : 'Categoría Origen'}
              </label>
              <select
                {...categoriaOrigenRegister}
                onChange={(e) => {
                  omitirPrioridadAutomatica.current = false;
                  categoriaOrigenRegister.onChange(e);
                  setValue('origenId', '');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800"
              >
                <option value="">-- Seleccionar Categoría --</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
              {errors.categoriaOrigenId && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.categoriaOrigenId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {esRespuesta ? 'Destino Específico' : 'Entidad de Origen'}
              </label>
              <select
                {...register('origenId')}
                disabled={!selectedCategoriaOrigen}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">{esRespuesta ? '-- Seleccionar Destino --' : '-- Seleccionar Origen --'}</option>
                {origenesFiltrados.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
              {errors.origenId && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.origenId.message}</p>
              )}
            </div>
          </div>

          {/* Recaudos */}
          {(!esRespuesta && !mostrarRecaudos) ? (
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckSquare size={16} className="text-slate-400" /> Recaudos y Anexos Adjuntos
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {recaudosCatalogo.map((recaudo) => {
                const idStr = String(recaudo.id);
                const esSinAdjuntos = esRecaudoSinAdjuntos(recaudo.nombre);
                return (
                  <label
                    key={recaudo.id}
                    className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer hover:bg-white p-2 rounded-lg transition-all border border-transparent hover:border-slate-200 select-none"
                  >
                    <input
                      type="checkbox"
                      value={idStr}
                      checked={recaudosSeleccionados.includes(idStr)}
                      onChange={(e) => toggleRecaudo(idStr, e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                    />

                    <span className={esSinAdjuntos ? 'text-red-600 truncate' : 'truncate'}>
                      {recaudo.nombre}
                    </span>
                  </label>
                );
              })}
            </div>
              {errors.recaudosSeleccionados && <p className="text-red-500 text-xs mt-1 font-medium">{errors.recaudosSeleccionados.message}</p>}
          </div>
          ) : (
            toggleRecaudo('12', true)
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Observacion
            </label>
            <input
              type="text"
              {...register('observacion')}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 text-sm transition-all"
            />
          </div>

          {/* Carga de Archivo PDF */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Documento Digital (PDF){esEdicion ? ' — opcional' : ''}
            </label>
            
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              {...register('archivo')}
              id="archivo-upload"
            />
        
            {archivoSeleccionado && archivoSeleccionado.length > 0 ? (
              <div className="flex items-center justify-between p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                    <FileCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {archivoSeleccionado[0].name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(archivoSeleccionado[0].size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={limpiarArchivo}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-colors cursor-pointer"
                  title="Remover archivo"
                >
                  <X size={18} />
                </button>
              </div>
            ) : esEdicion && archivoActual ? (
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg shrink-0">
                    <FileCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{archivoActual}</p>
                    <p className="text-xs text-slate-500">Archivo actual. Puedes reemplazarlo si lo necesitas.</p>
                  </div>
                </div>
                <label
                  htmlFor="archivo-upload"
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                >
                  Reemplazar
                </label>
              </div>
            ) : (
              <label
                htmlFor="archivo-upload"
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all text-center group"
              >
                <div className="p-3 bg-white group-hover:bg-blue-100 text-slate-400 group-hover:text-blue-600 rounded-full shadow-sm border border-slate-200 transition-colors mb-2">
                  <Upload size={20} />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Haz clic para examinar o arrastra el archivo PDF aquí
                </p>
                <p className="text-xs text-slate-400 mt-1">Máximo 10MB en formato PDF</p>
              </label>
            )}

            {errors.archivo && (
              <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.archivo.message as string}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{esEdicion ? 'Guardando...' : esRespuesta ? 'Registrando respuesta...' : 'Registrando...'}</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>{esEdicion ? 'Guardar cambios' : esRespuesta ? 'Registrar Respuesta' : 'Registrar Documento'}</span>
              </>
            )}
          </button>
        </form>
        )}
      </div>
    </div>
  );
};