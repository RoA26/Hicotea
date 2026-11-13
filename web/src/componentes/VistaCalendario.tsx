import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { DiaCalendario, MesCalendario } from '../api/tipos'
import { dinero, fechaDia, nombreMes, numero } from '../lib/formato'
import { Icono } from './Iconos'
import { Boton, Cifra, cx, Entrada, Tarjeta } from './ui'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Cifra compacta para celdas pequeñas: 85000 → "85k", 1250000 → "1,3M". */
function corta(v: string) {
  const n = numero(v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}

/** "2026-11-10" ± n días, sin pasar por la zona horaria del navegador. */
function sumarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Texto completo de la celda para lectores de pantalla (no depende del color). */
function etiqueta(d: DiaCalendario): string {
  const partes = [fechaDia(d.fecha)]
  if (d.hoy) partes.push('hoy')
  if (d.futuro) partes.push('día futuro')
  if (numero(d.ingresos) > 0) partes.push(`ingresos ${dinero(d.ingresos)}`)
  if (numero(d.gastos) > 0) partes.push(`gastos ${dinero(d.gastos)}`)
  if (d.operaciones_ahorro > 0) partes.push(`${d.operaciones_ahorro} ${d.operaciones_ahorro === 1 ? 'operación' : 'operaciones'} de ahorro`)
  if (d.sin_registros) partes.push('sin registros')
  if (d.sin_actividad) partes.push('confirmado sin actividad')
  if (d.compromisos.length) partes.push(`compromisos: ${d.compromisos.map((c) => c.nombre).join(', ')}`)
  return partes.join(', ')
}

/** Marcadores con forma propia (no solo color): ◆ ahorro, ○ sin registros, ◷ compromiso, • producido. */
function Marca({ simbolo, clase }: { simbolo: string; clase: string }) {
  return (
    <span aria-hidden className={cx('text-[10px] leading-none', clase)}>
      {simbolo}
    </span>
  )
}

/**
 * Calendario vivo (C-01, C-02, C-07). Cada día es un botón; la cuadrícula se
 * recorre con flechas (±1 día, ±1 semana), Inicio/Fin (semana) y RePág/AvPág
 * (mes). Los días anteriores sin registros se ven suaves, nunca como error.
 */
export function VistaCalendario({
  c,
  seleccionado,
  alSeleccionar,
  alCambiarMes,
}: {
  c: MesCalendario
  seleccionado: string | null
  alSeleccionar: (fecha: string) => void
  alCambiarMes: (mes: string, dia?: string) => void
}) {
  const dias = c.semanas.flat()
  const delMes = dias.filter((d) => d.del_mes)
  const foco =
    (seleccionado && dias.some((d) => d.fecha === seleccionado) && seleccionado) ||
    delMes.find((d) => d.hoy)?.fecha ||
    delMes[0]?.fecha
  const rejilla = useRef<HTMLDivElement>(null)
  const moverFoco = useRef(false)

  useEffect(() => {
    if (!moverFoco.current) return
    moverFoco.current = false
    rejilla.current?.querySelector<HTMLButtonElement>(`[data-fecha="${foco}"]`)?.focus()
  }, [foco, c.mes])

  function ir(destino: string) {
    moverFoco.current = true
    if (dias.some((d) => d.fecha === destino)) alSeleccionar(destino)
    else alCambiarMes(destino.slice(0, 7), destino)
  }

  function teclado(e: KeyboardEvent, d: DiaCalendario) {
    const dow = (new Date(`${d.fecha}T12:00:00Z`).getUTCDay() + 6) % 7 // 0 = lunes
    const mapa: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dow, End: 6 - dow,
    }
    if (e.key in mapa) {
      e.preventDefault()
      ir(sumarDias(d.fecha, mapa[e.key]))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      const mes = e.key === 'PageUp' ? c.mes_anterior : c.mes_siguiente
      moverFoco.current = true
      alCambiarMes(mes, `${mes}-${d.fecha.slice(8)}`)
    }
  }

  const aportes = delMes.reduce((s, d) => s + numero(d.aportes), 0)
  const sinRegistros = delMes.filter((d) => d.sin_registros).length

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="mr-auto text-xl font-semibold tracking-tight sm:text-2xl" aria-live="polite">
          {nombreMes(c.mes)}
        </h2>
        <div className="flex items-center gap-1 rounded-control border border-borde bg-superficie p-1">
          <Boton chico variante="fantasma" aria-label="Mes anterior" onClick={() => alCambiarMes(c.mes_anterior)}>
            <Icono nombre="izquierda" className="size-4" />
          </Boton>
          <Boton
            chico
            variante={c.hoy.startsWith(c.mes) ? 'fantasma' : 'secundario'}
            onClick={() => alCambiarMes(c.hoy.slice(0, 7), c.hoy)}
            aria-label="Ir a hoy"
          >
            Hoy
          </Boton>
          <Boton chico variante="fantasma" aria-label="Mes siguiente" onClick={() => alCambiarMes(c.mes_siguiente)}>
            <Icono nombre="derecha" className="size-4" />
          </Boton>
        </div>
        <label className="flex items-center gap-2 text-sm text-texto-suave">
          <span className="sr-only">Ir a un mes y año</span>
          <Entrada
            type="month"
            className="h-9 w-auto"
            value={c.mes}
            onChange={(e) => e.target.value && alCambiarMes(e.target.value)}
          />
        </label>
      </div>

      <Tarjeta className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra etiqueta="Ingresos" valor={c.total_ingresos} tono="ingreso" />
        <Cifra etiqueta="Gastos" valor={c.total_gastos} tono="gasto" />
        <Cifra etiqueta="Movido a cajitas" valor={String(aportes)} />
        <div>
          <p className="text-xs text-texto-suave">Días con producido</p>
          <p className="cifra text-lg font-semibold">{c.dias_con_producido}</p>
        </div>
      </Tarjeta>

      <div ref={rejilla} role="grid" aria-label={`Calendario de ${nombreMes(c.mes)}`} className="overflow-hidden rounded-tarjeta border border-borde bg-superficie">
        <div role="row" className="grid grid-cols-7 border-b border-borde text-center text-xs text-texto-suave">
          {DIAS.map((d) => (
            <div key={d} role="columnheader" className="py-2">
              {d}
            </div>
          ))}
        </div>
        {c.semanas.map((s, i) => (
          <div key={i} role="row" className="grid grid-cols-7 border-b border-borde last:border-b-0">
            {s.map((d) => {
              const ing = numero(d.ingresos) > 0
              const gas = numero(d.gastos) > 0
              const elegido = d.fecha === seleccionado
              return (
                <div key={d.fecha} role="gridcell" aria-selected={elegido} className="border-r border-borde last:border-r-0">
                  <button
                    type="button"
                    data-fecha={d.fecha}
                    tabIndex={d.fecha === foco ? 0 : -1}
                    aria-label={etiqueta(d)}
                    aria-current={d.hoy ? 'date' : undefined}
                    onClick={() => alSeleccionar(d.fecha)}
                    onKeyDown={(e) => teclado(e, d)}
                    className={cx(
                      'cifra block min-h-16 w-full p-1 text-left text-[11px] leading-tight transition-colors sm:min-h-20 sm:p-1.5 sm:text-xs lg:min-h-24 xl:min-h-28 xl:p-2',
                      'hover:bg-superficie-2 focus-visible:relative focus-visible:z-10',
                      !d.del_mes && 'opacity-40',
                      d.sin_registros && 'bg-superficie-2/60',
                      d.futuro && 'text-texto-suave',
                      elegido && 'relative z-10 ring-2 ring-acento ring-inset',
                    )}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className={cx('grid size-6 place-items-center rounded-full', d.hoy && 'bg-acento font-bold text-sobre-acento')}>
                        {Number(d.fecha.slice(8))}
                      </span>
                      <span className="flex items-center gap-0.5">
                        {d.con_producido && <Marca simbolo="•" clase="text-acento-vivo text-sm" />}
                        {d.operaciones_ahorro > 0 && <Marca simbolo="◆" clase="text-acento" />}
                        {d.compromisos.length > 0 && <Marca simbolo="◷" clase="text-aviso" />}
                        {d.sin_registros && <Marca simbolo="○" clase="text-texto-suave" />}
                        {d.sin_actividad && <Marca simbolo="✓" clase="text-texto-suave" />}
                      </span>
                    </span>
                    {/* Cifras compactas en pantallas chicas; completas desde xl, donde caben sin saturar. */}
                    {ing && (
                      <span className="mt-0.5 block truncate text-ingreso">
                        +<span className="xl:hidden">{corta(d.ingresos)}</span>
                        <span className="hidden xl:inline">{dinero(d.ingresos).replace('$ ', '$')}</span>
                      </span>
                    )}
                    {gas && (
                      <span className="block truncate text-gasto">
                        −<span className="xl:hidden">{corta(d.gastos)}</span>
                        <span className="hidden xl:inline">{dinero(d.gastos).replace('$ ', '$')}</span>
                      </span>
                    )}
                    {d.operaciones_ahorro > 0 && numero(d.aportes) > 0 && (
                      <span className="hidden truncate text-texto-suave lg:block">◆ {corta(d.aportes)}</span>
                    )}
                    {d.compromisos.length > 0 && (
                      <span className="hidden truncate text-texto-suave xl:block">◷ {d.compromisos[0].nombre}</span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave" aria-label="Leyenda del calendario">
        <li className="flex items-center gap-1.5">
          <span className="grid size-4 place-items-center rounded-full bg-acento text-[9px] font-bold text-sobre-acento">1</span> Hoy
        </li>
        <li className="flex items-center gap-1.5">
          <span className="text-ingreso">+</span>/<span className="text-gasto">−</span> Ingresos y gastos
        </li>
        <li className="flex items-center gap-1.5">
          <Marca simbolo="◆" clase="text-acento" /> Ahorro (entre disponible y cajitas)
        </li>
        <li className="flex items-center gap-1.5">
          <Marca simbolo="◷" clase="text-aviso" /> Compromiso previsto
        </li>
        <li className="flex items-center gap-1.5">
          <Marca simbolo="•" clase="text-acento-vivo text-sm" /> Producido
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-borde bg-superficie-2" />
          <Marca simbolo="○" clase="text-texto-suave" /> Sin registros{sinRegistros > 0 ? ` (${sinRegistros} este mes)` : ''}
        </li>
        <li className="flex items-center gap-1.5">
          <Marca simbolo="✓" clase="text-texto-suave" /> Sin actividad (confirmado)
        </li>
      </ul>
      {c.inicio_historial && (
        <p className="mt-1 text-xs text-texto-suave">
          Los días sin registros se cuentan desde tu primer movimiento ({fechaDia(c.inicio_historial)}).
        </p>
      )}
    </>
  )
}
