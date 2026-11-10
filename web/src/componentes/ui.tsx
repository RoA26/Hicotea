import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import type { ErrorApi } from '../api/cliente'
import { dinero } from '../lib/formato'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ------------------------------------------------------------------ botones

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-acento text-sobre-acento hover:brightness-110 font-semibold',
  secundario: 'bg-superficie-2 text-texto border border-borde hover:border-acento/60',
  peligro: 'bg-gasto/10 text-gasto border border-gasto/30 hover:bg-gasto/20',
  fantasma: 'text-texto-suave hover:text-texto hover:bg-superficie-2',
}

const claseBoton = (v: Variante, chico?: boolean) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-xl transition-[filter,background-color,border-color,color] select-none',
    'disabled:opacity-50 disabled:pointer-events-none',
    chico ? 'h-9 px-3 text-sm' : 'h-11 px-4',
    VARIANTES[v],
  )

export function Boton({
  variante = 'primario',
  chico,
  className,
  cargando,
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; chico?: boolean; cargando?: boolean }) {
  return (
    <button type="button" className={cx(claseBoton(variante, chico), className)} disabled={cargando || p.disabled} {...p}>
      {cargando ? 'Un momento…' : children}
    </button>
  )
}

export function BotonEnlace({
  variante = 'primario',
  chico,
  className,
  ...p
}: LinkProps & { variante?: Variante; chico?: boolean }) {
  return <Link className={cx(claseBoton(variante, chico), className)} {...p} />
}

// ------------------------------------------------------------------ formularios

export function Campo({
  etiqueta,
  error,
  ayuda,
  children,
  className,
}: {
  etiqueta: string
  error?: string
  ayuda?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-texto-suave">{etiqueta}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-gasto">{error}</span>
      ) : ayuda ? (
        <span className="mt-1 block text-xs text-texto-suave">{ayuda}</span>
      ) : null}
    </label>
  )
}

const claseEntrada =
  'block w-full h-11 rounded-xl bg-superficie-2 border border-borde px-3 text-texto placeholder:text-texto-suave/60 focus:border-acento focus:outline-none aria-invalid:border-gasto'

export function Entrada({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(claseEntrada, className)} {...p} />
}

/** Campo de monto: el usuario escribe "85.000" o "85000"; la api lo interpreta. */
export function EntradaMonto(p: InputHTMLAttributes<HTMLInputElement>) {
  return <Entrada inputMode="decimal" autoComplete="off" placeholder="0" {...p} className={cx('cifra', p.className)} />
}

export function Selector({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(claseEntrada, 'appearance-none pr-8', className)} {...p}>
      {children}
    </select>
  )
}

export function Interruptor({
  marcado,
  onCambio,
  etiqueta,
}: {
  marcado: boolean
  onCambio: (v: boolean) => void
  etiqueta: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-sm">{etiqueta}</span>
      <input type="checkbox" className="peer sr-only" checked={marcado} onChange={(e) => onCambio(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-borde transition-colors peer-checked:bg-acento peer-focus-visible:outline-2 peer-focus-visible:outline-acento after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-texto after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  )
}

/** Selector segmentado (p. ej. Ingreso / Gasto). */
export function Segmentos<T extends string>({
  valor,
  opciones,
  onCambio,
}: {
  valor: T
  opciones: { valor: T; etiqueta: string; tono?: 'acento' | 'gasto' }[]
  onCambio: (v: T) => void
}) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-borde bg-superficie-2 p-1">
      {opciones.map((o) => {
        const activo = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(o.valor)}
            className={cx(
              'h-9 rounded-lg text-sm font-medium transition-colors',
              activo
                ? o.tono === 'gasto'
                  ? 'bg-gasto text-sobre-acento'
                  : 'bg-acento text-sobre-acento'
                : 'text-texto-suave hover:text-texto',
            )}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

export function AlertaError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <p role="alert" className="rounded-xl border border-gasto/30 bg-gasto/10 px-3 py-2 text-sm text-gasto">
      {mensaje}
    </p>
  )
}

export function AlertaExito({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <p role="status" className="rounded-xl border border-acento/30 bg-acento/10 px-3 py-2 text-sm text-acento">
      {mensaje}
    </p>
  )
}

// ------------------------------------------------------------------ contenedores

export function Tarjeta({ className, children, ...p }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl border border-borde bg-superficie p-4', className)} {...p}>
      {children}
    </div>
  )
}

export function Encabezado({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-texto-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  )
}

export function Seccion({ titulo, acciones, children }: { titulo: string; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-texto-suave uppercase">{titulo}</h2>
        {acciones}
      </div>
      {children}
    </section>
  )
}

export function Vacio({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-borde px-4 py-8 text-center text-sm text-texto-suave">
      <p>{children}</p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

export function Cargando() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-superficie" />
      ))}
    </div>
  )
}

export function ErrorCarga({ error, reintentar }: { error: ErrorApi; reintentar: () => void }) {
  return (
    <div className="rounded-2xl border border-gasto/30 bg-gasto/5 p-4 text-sm">
      <p className="text-gasto">{error.message}</p>
      <Boton chico variante="secundario" className="mt-3" onClick={reintentar}>
        Reintentar
      </Boton>
    </div>
  )
}

// ------------------------------------------------------------------ datos

/** Monto con color según si entra (verde) o sale (rojo) dinero. */
export function Monto({
  valor,
  entrada,
  signo,
  className,
}: {
  valor: string | number
  entrada?: boolean
  signo?: boolean
  className?: string
}) {
  const tono = entrada === undefined ? '' : entrada ? 'text-ingreso' : 'text-gasto'
  const prefijo = signo && entrada !== undefined ? (entrada ? '+ ' : '− ') : ''
  return <span className={cx('cifra whitespace-nowrap', tono, className)}>{prefijo}{dinero(valor)}</span>
}

export function Barra({ porcentaje, tono = 'acento' }: { porcentaje: number; tono?: 'acento' | 'aviso' | 'gasto' }) {
  const color = { acento: 'bg-acento', aviso: 'bg-aviso', gasto: 'bg-gasto' }[tono]
  return (
    <div className="h-2 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }} />
    </div>
  )
}

export function Insignia({ children, tono = 'suave' }: { children: ReactNode; tono?: 'suave' | 'acento' | 'aviso' | 'gasto' }) {
  const t = {
    suave: 'bg-superficie-2 text-texto-suave border-borde',
    acento: 'bg-acento/10 text-acento border-acento/30',
    aviso: 'bg-aviso/10 text-aviso border-aviso/30',
    gasto: 'bg-gasto/10 text-gasto border-gasto/30',
  }[tono]
  return <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', t)}>{children}</span>
}

export function Cifra({ etiqueta, valor, tono, grande }: { etiqueta: string; valor: string; tono?: 'ingreso' | 'gasto'; grande?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-texto-suave">{etiqueta}</p>
      <p
        className={cx(
          'cifra truncate font-semibold',
          grande ? 'text-3xl tracking-tight' : 'text-lg',
          tono === 'ingreso' && 'text-ingreso',
          tono === 'gasto' && 'text-gasto',
        )}
      >
        {dinero(valor)}
      </p>
    </div>
  )
}
