/** Cantidad de correspondencias por página en las bandejas (UI) */
export const ITEMS_POR_PAGINA = 25;

export function calcTotalPaginas(totalItems: number, porPagina = ITEMS_POR_PAGINA): number {
  if (totalItems <= 0) return 1;
  return Math.ceil(totalItems / porPagina);
}

export function paginarLista<T>(
  lista: T[],
  pagina: number,
  porPagina = ITEMS_POR_PAGINA
): {
  items: T[];
  totalPaginas: number;
  paginaActual: number;
  totalItems: number;
} {
  const totalItems = lista.length;
  const totalPaginas = calcTotalPaginas(totalItems, porPagina);
  const paginaActual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;

  return {
    items: lista.slice(inicio, inicio + porPagina),
    totalPaginas,
    paginaActual,
    totalItems,
  };
}
