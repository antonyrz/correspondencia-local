import { useEffect, useMemo, useState } from 'react';
import { X, MapPin, Loader2, Pencil, Plus } from 'lucide-react';
import { isAxiosError } from 'axios';
import {
  getCatalogosOrigenDestino,
  crearOrigenDestinoApi,
  actualizarOrigenDestinoApi,
} from '../../api/catalogos.api';
import type { CategoriaCatalog } from '../../api/documentos.api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GestionOrigenDestinoModal = ({ isOpen, onClose }: Props) => {
  const [categorias, setCategorias] = useState<CategoriaCatalog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [categoriaId, setCategoriaId] = useState('');
  const [nombre, setNombre] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const cargarCatalogos = async () => {
    setLoading(true);
    try {
      const data = await getCatalogosOrigenDestino();
      setCategorias(data.catalogos || []);
    } catch {
      setError('No se pudieron cargar las categorías y orígenes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setExito(null);
    setCategoriaId('');
    setNombre('');
    setEditandoId(null);
    setBusqueda('');
    cargarCatalogos();
  }, [isOpen]);

  const origenesVisibles = useMemo(() => {
    const lista = categorias.flatMap((cat) =>
      (cat.origenDestinos || []).map((o) => ({
        ...o,
        categoria_id: cat.id,
        categoria_nombre: cat.nombre,
      }))
    );

    const termino = busqueda.trim().toLowerCase();
    const filtrados = lista.filter((item) => {
      const coincideCat = !categoriaId || String(item.categoria_id) === categoriaId;
      const coincideTexto =
        !termino ||
        item.nombre.toLowerCase().includes(termino) ||
        item.categoria_nombre.toLowerCase().includes(termino);
      return coincideCat && coincideTexto;
    });

    return filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [categorias, categoriaId, busqueda]);

  const limpiarFormulario = () => {
    setNombre('');
    setEditandoId(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExito(null);

    if (!categoriaId) {
      setError('Seleccione primero la categoría');
      return;
    }
    if (!nombre.trim()) {
      setError('Indique el nombre del origen/destino');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        nombre: nombre.trim(),
        categoria_id: Number(categoriaId),
      };

      if (editandoId) {
        const res = await actualizarOrigenDestinoApi(editandoId, payload);
        setExito(res.message || 'Origen/destino actualizado');
      } else {
        const res = await crearOrigenDestinoApi(payload);
        setExito(res.message || 'Origen/destino registrado');
      }

      window.dispatchEvent(new Event('catalogos-actualizados'));
      await cargarCatalogos();
      limpiarFormulario();
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.error || 'No se pudo guardar el origen/destino');
      } else {
        setError('Error de conexión');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Orígenes / Destinos</h2>
              <p className="text-xs text-slate-500">
                Agregue o edite entidades. Si ya existen documentos que usen el origen/destino editado, estos no serán modificados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          {exito && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm">
              {exito}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                  Categoría
                </label>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Seleccionar categoría --</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">
                  Nombre del origen / destino
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: DIRECCIÓN DE PLANIFICACIÓN"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar edición
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editandoId ? (
                  <Pencil size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {editandoId ? 'Guardar cambios' : 'Agregar origen/destino'}
              </button>
            </div>
          </form>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Existentes ({origenesVisibles.length})
              </h3>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                  Cargando...
                </div>
              ) : origenesVisibles.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">No hay orígenes/destinos</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {origenesVisibles.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                        editandoId === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.nombre}</p>
                        <p className="text-[11px] text-slate-500">{item.categoria_nombre}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoId(item.id);
                          setCategoriaId(String(item.categoria_id));
                          setNombre(item.nombre);
                          setExito(null);
                          setError(null);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
