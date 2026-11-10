import type { MesCalendario } from '../api/tipos'
import { dinero, nombreMes, numero } from '../lib/formato'
import { Icono } from './Iconos'
import { Boton, Cifra, cx, Tarjeta } from './ui'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Cifra compacta para celdas pequeñas: 85000 → "85k", 1250000 → "1,3M". */
function corta(v: string) {
  const n = numero(v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}

export function VistaCalendario({ c, alCambiarMes }: { c: MesCalendario; alCambiarMes: (mes: string) => void }) {
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Boton chico variante="secundario" aria-label="Mes anterior" onClick={() => alCambiarMes(c.mes_anterior)}>
          <Icono nombre="izquierda" className="size-4" />
        </Boton>
        <span className="min-w-44 text-center font-semibold">{nombreMes(c.mes)}</span>
        <Boton chico variante="secundario" aria-label="Mes siguiente" onClick={() => alCambiarMes(c.mes_siguiente)}>
          <Icono nombre="derecha" className="size-4" />
        </Boton>
      </div>
      <Tarjeta className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra etiqueta="Ingresos" valor={c.total_ingresos} tono="ingreso" />
        <Cifra etiqueta="Gastos" valor={c.total_gastos} tono="gasto" />
        <div>
          <p className="text-xs text-texto-suave">Días con producido</p>
          <p className="cifra text-lg font-semibold">{c.dias_con_producido}</p>
        </div>
        <div>
          <p className="text-xs text-texto-suave">Días sin producido</p>
          <p className="cifra text-lg font-semibold">{c.dias_sin_producido}</p>
        </div>
      </Tarjeta>
      <div className="overflow-hidden rounded-2xl border border-borde bg-superficie">
        <div className="grid grid-cols-7 border-b border-borde text-center text-xs text-texto-suave">
          {DIAS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {c.semanas.map((s, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-borde last:border-b-0">
            {s.map((d) => {
              const ing = numero(d.ingresos) > 0
              const gas = numero(d.gastos) > 0
              return (
                <div
                  key={d.fecha}
                  title={`${d.fecha}: ingresos ${dinero(d.ingresos)}, gastos ${dinero(d.gastos)}`}
                  className={cx(
                    'cifra min-h-16 border-r border-borde p-1 text-[11px] leading-tight last:border-r-0 sm:min-h-20 sm:p-1.5 sm:text-xs',
                    !d.del_mes && 'opacity-35',
                    d.sin_producido && 'bg-aviso/5',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cx('grid size-6 place-items-center rounded-full', d.hoy && 'bg-acento font-bold text-sobre-acento')}>{Number(d.fecha.slice(8))}</span>
                    {d.con_producido && <span className="size-1.5 rounded-full bg-acento-vivo" aria-label="Con producido" />}
                  </div>
                  {ing && <p className="truncate text-ingreso">+{corta(d.ingresos)}</p>}
                  {gas && <p className="truncate text-gasto">−{corta(d.gastos)}</p>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-4 text-xs text-texto-suave">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-acento-vivo" /> Día con producido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-borde bg-aviso/10" /> Día sin producido
        </span>
      </p>
    </>
  )
}
