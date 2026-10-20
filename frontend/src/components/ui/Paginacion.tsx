import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginacionProps {
  paginaActual: number;
  totalPaginas: number;
  totalItems: number;
  itemsPorPagina: number;
  onCambiarPagina: (pagina: number) => void;
}

export const Paginacion = ({
  paginaActual,
  totalPaginas,
  totalItems,
  itemsPorPagina,
  onCambiarPagina,
}: PaginacionProps) => {
  if (totalPaginas <= 1) return null;

  const inicio = (paginaActual - 1) * itemsPorPagina + 1;
  const fin = Math.min(paginaActual * itemsPorPagina, totalItems);

  const paginas: number[] = [];
  for (let i = 1; i <= totalPaginas; i++) {
    paginas.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/80">
      <p className="text-xs text-slate-500">
        Mostrando <span className="font-semibold text-slate-700">{inicio}</span>–
        <span className="font-semibold text-slate-700">{fin}</span> de{' '}
        <span className="font-semibold text-slate-700">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => onCambiarPagina(paginaActual - 1)}
          disabled={paginaActual <= 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {paginas.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onCambiarPagina(num)}
            className={`min-w-8 h-8 px-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              num === paginaActual
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onCambiarPagina(paginaActual + 1)}
          disabled={paginaActual >= totalPaginas}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
