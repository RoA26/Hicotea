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

const MILES_CON_PUNTO = /^\d{1,3}(\.\d{3})+$/
const NUMERO = /^[+]?(\d+\.?\d*|\.\d+)$/

/**
 * Lee un monto escrito por el usuario con las mismas reglas que la API
 * (api/app/modelo/dinero.py → parsear): "85000", "85.000", "$ 85.000", "85.000,50".
 * Devuelve `null` si está vacío, 0 si son solo ceros (la API los omite en el
 * reparto) y `NaN` si no es un monto válido. Solo sirve para mostrar sumas en
 * vivo: la API sigue siendo quien valida.
 */
export function parsearMonto(texto: string | null | undefined): number | null {
  let limpio = (texto ?? '').replace(/[$\s ]/g, '')
  if (limpio === '') return null
  if (limpio.includes(',')) limpio = limpio.replace(/\./g, '').replace(',', '.')
  else if (MILES_CON_PUNTO.test(limpio)) limpio = limpio.replace(/\./g, '')
  if (!NUMERO.test(limpio) || (limpio.split('.')[1] ?? '').length > 2) return NaN
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

/**
 * Porcentaje como número en escala 0-100. La API siempre usa esa escala
 * (NUMERIC(5,2) con CHECK 0..100): "0.50" es medio por ciento, no 50 %.
 * No reinterpretar valores entre 0 y 1 como fracciones (ver docs/auditoria-foundations.md, F-01).
 */
export function porcentajeNumero(valor: string | number | null | undefined): number {
  const n = Number(valor ?? 0)
  return Number.isFinite(n) ? n : 0
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

/**
 * C-03: fecha precargada desde la URL (`?fecha=YYYY-MM-DD`) para registrar en
 * un día pasado. Si falta, es inválida o es futura, se usa hoy (la API
 * rechaza las fechas futuras de todos modos).
 */
export function fechaPrecargada(valor: string | null): string {
  const h = hoy()
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && valor <= h ? valor : h
}

/** Ruta interna a la que volver tras registrar (`?volver=`); nunca un enlace externo. */
export function rutaVolver(valor: string | null): string | null {
  return valor && valor.startsWith('/') && !valor.startsWith('//') ? valor : null
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
