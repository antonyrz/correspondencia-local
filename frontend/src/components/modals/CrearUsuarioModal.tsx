import { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Building, User, CreditCard, Lock, Loader2 } from 'lucide-react';
import { getDepartamentosApi, type Departamento } from '../../api/departamentos.api';
import { getRolesApi, type Rol } from '../../api/roles.api'; 
import { crearUsuarioApi } from '../../api/usuarios.api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CrearUsuarioModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const [prefijoCedula, setPrefijoCedula] = useState<'V' | 'E'>('V');
  const [numeroCedula, setNumeroCedula] = useState('');

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loadingDepto, setLoadingDepto] = useState(false);

  const [roles, setRoles] = useState<Rol[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    password: '',
    rol_usuario: '',
    departamentoId: '',
  });

  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [rolSelected, setRolSelected] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadData = async () => {
      setLoadingDepto(true);
      setLoadingRoles(true);
      try {
        const [deptosData, rolesData] = await Promise.all([
          getDepartamentosApi(),
          getRolesApi(),
        ]);
        if (isMounted) {
          setDepartamentos(deptosData);
          setRoles(rolesData);
        }
      } catch (error) {
        console.error('Error al obtener datos iniciales:', error);
      } finally {
        if (isMounted) {
          setLoadingDepto(false);
          setLoadingRoles(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setRolSelected(e.target.value)
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSubmit(true);

    const payload = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      cedula: `${prefijoCedula}${numeroCedula.trim()}`,
      password: formData.password,
      rol_usuario: Number(formData.rol_usuario),
      departamento_id: Number(formData.departamentoId),
    };

    try {
      await crearUsuarioApi(payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Error al registrar usuario:', error);
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Registrar Nuevo Usuario</h3>
              <p className="text-xs text-slate-400">Acceso al sistema SGC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nombre */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="nombre"
                  required
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Juan"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Apellido */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Apellido
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="apellido"
                  required
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Ej. Pérez"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Cédula */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cédula de Identidad
              </label>
              <div className="flex gap-1.5">
                <select
                  value={prefijoCedula}
                  onChange={(e) => setPrefijoCedula(e.target.value as 'V' | 'E')}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  <option value="V">V-</option>
                  <option value="E">E-</option>
                </select>
                <div className="relative flex-1">
                  <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={numeroCedula}
                    onChange={(e) => setNumeroCedula(e.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                    maxLength={9}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Rol Dinámico */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rol / Nivel
              </label>
              <div className="relative">
                <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  name="rol_usuario"
                  value={formData.rol_usuario}
                  onChange={handleChange}
                  required
                  disabled={loadingRoles}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer capitalize truncate disabled:opacity-60"
                >
                  <option value="">
                    {loadingRoles ? 'Cargando roles...' : 'Seleccionar rol...'}
                  </option>
                  {roles.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.nombre}
                    </option>
                  ))}
                </select>
                {loadingRoles && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" />
                )}
              </div>
            </div>

            {/* Departamento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Departamento
              </label>
              <div className="relative">
                <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  name="departamentoId"
                  value={formData.departamentoId}
                  onChange={handleChange}
                  required
                  disabled={rolSelected == ''}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer truncate disabled:opacity-60"
                >
                  <option value="">
                    {loadingDepto ? 'Cargando departamentos...' : 'Seleccionar departamento...'}
                  </option>
                    {rolSelected == "2" || rolSelected == "5" ? 
                      <option key="12" value="12">
                        UNIDAD DE REGISTRO E INFORMACIÓN
                      </option>

                    : rolSelected == "3" ? 
                    <option key="2" value="2">
                        DESPACHO
                      </option>

                    : rolSelected == "4" ? 
                    departamentos.filter((d) => {
                      if(d.id == 2 || d.id == 12){
                        return
                      }else{
                        return d
                      }
                    }).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))

                    : departamentos.map((dpto) => (
                    <option key={dpto.id} value={dpto.id}>
                      {dpto.nombre}
                    </option>
                  ))}
                </select>
                {loadingDepto && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" />
                )}
              </div>
            </div>

          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loadingSubmit}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {loadingSubmit && <Loader2 size={16} className="animate-spin" />}
              {loadingSubmit ? 'Guardando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};