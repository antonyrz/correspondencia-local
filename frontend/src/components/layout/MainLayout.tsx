import { useEffect, useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, type User as Usuario } from '../../store/useAuthStore';
import { CrearUsuarioModal } from '../modals/CrearUsuarioModal';
import { GestionOrigenDestinoModal } from '../modals/GestionOrigenDestinoModal';
import { getDepartamentosApi, type Departamento } from '../../api/departamentos.api';
import {
  Inbox,
  FilePlus,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  UserPlus,
  MapPin,
  Search,
  Check,
  ChevronsUpDown,
  X,
  MessageSquarePlus,
} from 'lucide-react';

interface Props {
  usuario?: Usuario | null;
  onLogout?: () => void;
}

export const MainLayout = ({ usuario: propUsuario, onLogout }: Props) => {
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
  const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false);
  const [modalOrigenDestinoAbierto, setModalOrigenDestinoAbierto] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const storeUsuario = useAuthStore((state) => state.user);
  const storeLogout = useAuthStore((state) => state.logout);

  const usuario = propUsuario ?? storeUsuario;

  // Normalización de Roles
  const rolNormalizado = (usuario?.rol || '').toLowerCase().trim();
  const esAdmin = rolNormalizado === 'administrador' || rolNormalizado === 'admin';
  const esRecepcionista = rolNormalizado.includes('recep');
  const esJefeRecepcion = rolNormalizado.includes('jefe_recepcion');
  const esDespacho = rolNormalizado.includes('despacho') || rolNormalizado.includes('secretaria');

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<Departamento | null>(null);

  // Estados para el selector/buscador de departamentos del Admin
  const [busquedaDepto, setBusquedaDepto] = useState('');
  const [comboDeptoAbierto, setComboDeptoAbierto] = useState(false);


  useEffect(() => {
    const cargarDepartamentos = async () => {
      const data = await getDepartamentosApi();
      const lista = data ? data : [];
      setDepartamentos(lista);

      // Buscar el departamento propio del usuario
      const deptoUsuario = lista.find(
        (d) => d.nombre.toLowerCase() === usuario?.departamento?.toLowerCase()
      );

      if (deptoUsuario) {
        setDepartamentoSeleccionado(deptoUsuario);
      } else if (lista.length > 0) {
        setDepartamentoSeleccionado(lista[0]);
      }
    };
    cargarDepartamentos();
  }, [usuario?.departamento]);

  // Nombre dinámico para la opción de menú del departamento
  const nombreDeptoMenu = useMemo(() => {
    if (esAdmin) {
      return departamentoSeleccionado?.nombre || 'Gestión de Departamento';
    }
    return usuario?.departamento || departamentoSeleccionado?.nombre || 'Mi Departamento';
  }, [esAdmin, departamentoSeleccionado, usuario?.departamento]);

  // Construcción dinámica de las opciones de menú según el ROL
  const opcionesNavegacion = useMemo(() => {
    const menu = [];

    if (esRecepcionista || esAdmin) {
      menu.push({
        titulo: 'Registrar Correspondencia',
        ruta: '/documentos/crear',
        icono: FilePlus,
      });

      menu.push({
        titulo: 'Bandeja de Recepción',
        ruta: '/recepcion/bandeja',
        icono: Inbox,
      });
    }
    
    if (esDespacho || esAdmin) {
      menu.push({
        titulo: 'Bandeja de Despacho',
        ruta: '/despacho/bandeja',
        icono: Inbox,
      });
      menu.push({
        titulo: 'Respuestas',
        ruta: '/despacho/respuestas',
        icono: MessageSquarePlus,
      });
    }
    
    if(esJefeRecepcion || esDespacho){
      menu.push({
        titulo: 'Mi Unidad',
        ruta: '/unidad',
        icono: Inbox,
      })
    };

    if (esAdmin || esJefeRecepcion) {
      menu.push({
        titulo: 'Búsqueda de Correspondencia',
        ruta: '/documentos/buscar',
        icono: Search,
      });
    }

    // Para jefes de departamento, usuarios regulares o el administrador
    if (!esRecepcionista && !esDespacho || esAdmin) {
      menu.push({
        titulo: nombreDeptoMenu,
        ruta: '/departamento/bandeja',
        icono: Building2,
      });
    }

      // Para jefes de departamento, usuarios regulares o el administrador
      if (esAdmin) {
        menu.push({
          titulo: "Anulados",
          ruta: '/anulados',
          icono: X,
        });
      }

    return menu;
  }, [esAdmin, esRecepcionista, esDespacho, esJefeRecepcion, nombreDeptoMenu]);

  // Departamentos filtrados para la búsqueda del Administrador

  const departamentosFiltrados = departamentos.filter((d) =>
    d.nombre.toLowerCase().includes(busquedaDepto.toLowerCase()))

  const handleCerrarSesion = () => {
    if (onLogout) {
      onLogout();
    } else if (storeLogout) {
      storeLogout();
    }
    setMenuUsuarioAbierto(false);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* SIDEBAR LATERAL IZQUIERDO */}
      <aside
        className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 relative z-20 ${
          sidebarColapsado ? 'w-20' : 'w-64'
        }`}
      >
        {/* Encabezado del Sidebar */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!sidebarColapsado ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Building2 size={18} />
              </div>
              <span className="font-bold text-white text-base truncate">Sistema SGC</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold mx-auto">
              <Building2 size={18} />
            </div>
          )}

          <button
            onClick={() => setSidebarColapsado(!sidebarColapsado)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer hidden md:block"
          >
            {sidebarColapsado ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Buscador / Selector de Departamento exclusivo para Administrador */}
        {esAdmin && !sidebarColapsado && (
          <div className="p-3 border-b border-slate-800 relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Departamento Activo (Admin)
            </label>
            <button
              onClick={() => setComboDeptoAbierto(!comboDeptoAbierto)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700/80 rounded-xl text-xs text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <span className="truncate">
                {departamentoSeleccionado?.nombre || 'Seleccionar...'}
              </span>
              <ChevronsUpDown size={14} className="text-slate-400 shrink-0 ml-1" />
            </button>

            {comboDeptoAbierto && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setComboDeptoAbierto(false)}
                />
                <div className="absolute left-3 right-3 top-16 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-40 p-2 space-y-2">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Buscar unidad..."
                      value={busquedaDepto}
                      onChange={(e) => setBusquedaDepto(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                    {departamentosFiltrados.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">
                        Sin resultados
                      </p>
                    ) : (
                      departamentosFiltrados.map((dept) => (
                        <button
                          key={dept.id}
                          onClick={() => {
                            setDepartamentoSeleccionado(dept);
                            setComboDeptoAbierto(false);
                            setBusquedaDepto('');
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                            departamentoSeleccionado?.id === dept.id
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <span className="truncate">{dept.nombre}</span>
                          {departamentoSeleccionado?.id === dept.id && (
                            <Check size={12} className="shrink-0 ml-1" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Menú de Opciones */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {opcionesNavegacion.map((item) => {
            const Icono = item.icono;
            const estaActivo = location.pathname === item.ruta;
            return (
              <button
                key={item.ruta}
                onClick={() => navigate(item.ruta)}
                title={sidebarColapsado ? item.titulo : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  estaActivo
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icono size={20} className="shrink-0" />
                {!sidebarColapsado && <span className="truncate">{item.titulo}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {(esAdmin || esJefeRecepcion) && (
            <button
              onClick={() => setModalOrigenDestinoAbierto(true)}
              title={sidebarColapsado ? 'Orígenes / Destinos' : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-800/80 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-700/50 transition-all cursor-pointer ${
                sidebarColapsado ? 'justify-center' : ''
              }`}
            >
              <MapPin size={18} className="shrink-0" />
              {!sidebarColapsado && <span className="truncate">Orígenes / Destinos</span>}
            </button>
          )}

          {esAdmin && (
            <button
              onClick={() => setModalUsuarioAbierto(true)}
              title={sidebarColapsado ? 'Nuevo Usuario' : undefined}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-slate-800/80 hover:bg-slate-800 text-blue-400 hover:text-blue-300 border border-slate-700/50 transition-all cursor-pointer ${
                sidebarColapsado ? 'justify-center' : ''
              }`}
            >
              <UserPlus size={18} className="shrink-0" />
              {!sidebarColapsado && <span className="truncate">Nuevo Usuario</span>}
            </button>
          )}

          {!sidebarColapsado && (
            <div className="pt-2 text-xs text-slate-500 text-center">
              SGC v1.0 • Control Interno
            </div>
          )}
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-700">
              {opcionesNavegacion.find((o) => o.ruta === location.pathname)?.titulo ||
                'Panel Principal'}
            </h2>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                {usuario?.nombre ? usuario.nombre[0].toUpperCase() : <User size={18} />}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-tight">
                  {usuario?.nombre ? `${usuario.nombre} ${usuario.apellido || ''}` : 'Usuario'}
                </p>
                <p className="text-xs text-slate-500">{usuario?.rol ? usuario.rol : 'Sin Rol'}</p>
              </div>
            </button>

            {menuUsuarioAbierto && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuUsuarioAbierto(false)}
                />

                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Cuenta activa
                    </p>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {usuario?.nombre ? `${usuario.nombre} ${usuario.apellido || ''}` : 'Usuario'}
                    </p>
                    <p className="text-xs text-blue-600 font-semibold mt-0.5">
                      {departamentoSeleccionado?.nombre || usuario?.departamento || 'Sin Departamento'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setMenuUsuarioAbierto(false);
                      navigate('/perfil');
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <User size={16} className="text-slate-400" /> Mi Perfil
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={handleCerrarSesion}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer font-medium"
                  >
                    <LogOut size={16} /> Cerrar Sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-2 sm:p-6">
          {/* Outlet envía la información completa del departamento y del usuario autenticado */}
          <Outlet
            context={
              {
              departamentoIdContext: departamentoSeleccionado?.id || 0,
              departamentoNombreContext: departamentoSeleccionado?.nombre || usuario?.departamento || 'Mi Departamento',
              usuarioActualContext: usuario,
            }}
          />
        </main>
      </div>

      {/* Modal de Creación de Usuario */}
      {esAdmin && (
        <CrearUsuarioModal
          isOpen={modalUsuarioAbierto}
          onClose={() => setModalUsuarioAbierto(false)}
        />
      )}

      {(esAdmin || esJefeRecepcion) && (
        <GestionOrigenDestinoModal
          isOpen={modalOrigenDestinoAbierto}
          onClose={() => setModalOrigenDestinoAbierto(false)}
        />
      )}
    </div>
  );
};