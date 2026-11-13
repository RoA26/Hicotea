import type { Cajita, Meta } from '../../api/tipos'
import { numero } from '../../lib/formato'
import { PLACAS, type Placa } from './Tortuga'

/** Una cajita del Caparazón con las tres métricas separadas. */
export type CajitaCaparazon = {
  cajita: Cajita
  /** Índice de serie (color + patrón), estable según el orden de la API. */
  serie: number
  /** Número visible en la placa y en la lista (1, 2, 3…). */
  numero: number
  saldo: number
  /** Métrica 2: proporción del dinero ahorrado (0-100), null si no hay ahorro total. */
  proporcion: number | null
  /** Métrica 3: meta activa de la cajita (como máximo una, D-C2). */
  meta: Meta | null
}

/**
 * Prepara el Caparazón a partir de los datos de la API, sin recalcular reglas
 * financieras: los saldos y el progreso de las metas vienen del backend; aquí
 * solo se ordena, se asignan series y se calcula la proporción visible.
 */
export function armarCaparazon(cajitas: Cajita[], metas: Meta[]) {
  const activas = cajitas.filter((c) => c.activa)
  const archivadas = cajitas.filter((c) => !c.activa)
  // El total protegido incluye cajitas archivadas con saldo (D-F1), como el tablero.
  const total = cajitas.reduce((s, c) => s + numero(c.saldo), 0)
  const totalActivas = activas.reduce((s, c) => s + numero(c.saldo), 0)
  const metaActiva = new Map(metas.filter((m) => m.activa).map((m) => [m.id_cajita, m]))
  const items: CajitaCaparazon[] = activas.map((c, i) => ({
    cajita: c,
    serie: i % 6,
    numero: i + 1,
    saldo: numero(c.saldo),
    proporcion: totalActivas > 0 ? (numero(c.saldo) / totalActivas) * 100 : null,
    meta: metaActiva.get(c.id) ?? null,
  }))
  const logros = metas.filter((m) => !m.activa && m.cumplida_en)
  const metasArchivadas = metas.filter((m) => !m.activa && !m.cumplida_en)
  return { items, archivadas, total, totalActivas, metasActivas: metaActiva.size, logros, metasArchivadas }
}

export const etiquetaPorcentaje = (n: number) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: n < 10 ? 1 : 0 })} %`

/** Placas de la tortuga: hasta 7; si hay más cajitas, la 7.ª agrupa el resto. */
export function placasDe(items: CajitaCaparazon[]): Placa[] {
  const caben = items.length <= PLACAS ? items : items.slice(0, PLACAS - 1)
  const placas: Placa[] = caben.map((x) => ({
    tipo: 'cajita',
    clave: String(x.cajita.id),
    nombre: x.cajita.nombre,
    numero: x.numero,
    serie: x.serie,
    conSaldo: x.saldo > 0,
    etiqueta: `Placa ${x.numero}: ${x.cajita.nombre}${x.saldo > 0 ? '' : ', sin saldo'}`,
  }))
  if (items.length > PLACAS) {
    const resto = items.length - (PLACAS - 1)
    placas.push({ tipo: 'grupo', clave: 'grupo', cantidad: resto, etiqueta: `Otras ${resto} cajitas` })
  }
  return placas
}

/** Patrón CSS equivalente al de la placa (para no depender solo del color). */
export const PATRON_CSS = [
  'repeating-linear-gradient(45deg, color-mix(in oklab, var(--texto-sobre-serie) 22%, transparent) 0 3px, transparent 3px 8px)',
  'radial-gradient(color-mix(in oklab, var(--texto-sobre-serie) 30%, transparent) 1.4px, transparent 1.6px) 0 0 / 8px 8px',
  'repeating-linear-gradient(0deg, color-mix(in oklab, var(--texto-sobre-serie) 22%, transparent) 0 2px, transparent 2px 7px)',
  'linear-gradient(color-mix(in oklab, var(--texto-sobre-serie) 25%, transparent) 1px, transparent 1px) 0 0 / 9px 9px, linear-gradient(90deg, color-mix(in oklab, var(--texto-sobre-serie) 25%, transparent) 1px, transparent 1px) 0 0 / 9px 9px',
  'repeating-linear-gradient(90deg, color-mix(in oklab, var(--texto-sobre-serie) 22%, transparent) 0 2px, transparent 2px 7px)',
  'none',
]
