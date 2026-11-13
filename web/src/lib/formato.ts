import type { Frecuencia, Periodicidad, PropositoCajita, TipoCategoria, TipoMovimiento } from '../api/tipos'

const ZONA = 'America/Bogota'

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

/** "85000.00" → "$ 85.000"; "1250000.50" → "$ 1.250.000,5". */
export function dinero(monto: string | number | null | undefined): string {
  const n = Number(monto ?? 0)
  return `$ ${pesos.format(Number.isFinite(n) ? n : 0)}`
}

/** "85000.00" → "85.000" (para precargar un campo de monto editable). */
export function montoEditable(monto: string | null | undefined): string {
  if (!monto) return ''
  return pesos.format(Number(monto))
}

export const numero = (monto: string | number | null | undefined) => Number(monto ?? 0)

/**
 * Normaliza un porcentaje numérico a la escala 0-100.
 * Si viene una fracción decimal (ej. 0.05 en vez de 5), la interpreta como 5.
 */
export function porcentajeNumero(valor: string | number | null | undefined): number {
  const n = Number(valor ?? 0)
  if (!Number.isFinite(n)) return 0
  return n > 0 && n < 1 ? Number((n * 100).toFixed(2)) : n
}

/**
 * Formatea un porcentaje como valor humano legible (p. ej. "5%", "12,5%").
 * Muestra valores enteros sin decimales innecesarios ("5%") y preserva decimales significativos ("12,5%").
 */
export function formatoPorcentaje(valor: string | number | null | undefined): string {
  const pct = porcentajeNumero(valor)
  return `${pesos.format(pct)}%`
}

/** Fecha de hoy en Bogotá como "YYYY-MM-DD" (la api valida "no futura" con esa zona). */
export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

/** "2026-11" del mes actual en Bogotá. */
export const mesActual = () => hoy().slice(0, 7)

function aFecha(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d, 12))
}

const fmtCorta = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtLarga = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtDia = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const fmtMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtMesCorto = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })

export const fechaCorta = (iso: string) => fmtCorta.format(aFecha(iso))
export const fechaLarga = (iso: string) => fmtLarga.format(aFecha(iso))
export const fechaDia = (iso: string) => fmtDia.format(aFecha(iso))
/** "2026-11" → "Noviembre de 2026". */
export const nombreMes = (mes: string) => {
  const t = fmtMes.format(aFecha(`${mes}-01`))
  return t.charAt(0).toUpperCase() + t.slice(1)
}
export const nombreMesCorto = (mes: string) => fmtMesCorto.format(aFecha(`${mes}-01`)).replace('.', '')

export function sumarMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function primerDiaMes(mes: string) {
  return `${mes}-01`
}

export function ultimoDiaMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m, 0))
  return `${mes}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// ------------------------------------------------------------------ nombres de enums

export const NOMBRE_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  INGRESO: 'Ingreso',
  GASTO: 'Gasto',
  APORTE: 'Aporte a cajita',
  RETIRO: 'Retiro de cajita',
  RENDIMIENTO: 'Rendimiento',
  SALDO_INICIAL: 'Saldo que ya tenía',
}

export const NOMBRE_TIPO_CATEGORIA: Record<TipoCategoria, string> = {
  INGRESO: 'Ingreso',
  GASTO: 'Gasto personal',
  COSTO_OPERATIVO: 'Costo operativo',
}

export const NOMBRE_FRECUENCIA: Record<Frecuencia, string> = {
  DIARIA: 'Diaria',
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
}

export const NOMBRE_PERIODICIDAD: Record<Periodicidad, string> = {
  SEMANAL: 'Cada semana',
  QUINCENAL: 'Cada 15 días',
  MENSUAL: 'Cada mes',
  ANUAL: 'Cada año',
}

export const NOMBRE_PROPOSITO: Record<PropositoCajita, string> = {
  CAPITAL: 'Capital',
  COMPRAS: 'Compras',
  EMERGENCIA: 'Emergencia',
  LIBRE: 'Libre',
}

export const DESCRIPCION_PROPOSITO: Record<PropositoCajita, string> = {
  CAPITAL: 'Para reinvertir en tu trabajo',
  COMPRAS: 'Para algo que quieres comprar',
  EMERGENCIA: 'Para imprevistos',
  LIBRE: 'Sin destino fijo',
}
