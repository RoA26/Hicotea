import { cajitas, categorias, fuentes } from '../api/cliente'
import type { Cajita, Categoria, Fuente, TipoCategoria } from '../api/tipos'
import { useDatos } from './datos'

export type Catalogos = { categorias: Categoria[]; fuentes: Fuente[]; cajitas: Cajita[] }

/** Categorías, fuentes y cajitas que necesitan los formularios. */
export function useCatalogos() {
  return useDatos<Catalogos>(async () => {
    const [c, f, k] = await Promise.all([categorias.listar(), fuentes.listar(), cajitas.listar()])
    return { categorias: c, fuentes: f, cajitas: k }
  })
}

/** Activas de esos tipos, más la actual aunque esté desactivada (para poder editar). */
export function categoriasPara(todas: Categoria[], tipos: TipoCategoria[], actual?: number | null) {
  return todas.filter((c) => tipos.includes(c.tipo) && (c.activa || c.id === actual))
}
