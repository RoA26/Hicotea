import { dinero } from '../../lib/formato'
import { cx } from '../ui'
import { etiquetaPorcentaje, PATRON_CSS, type CajitaCaparazon } from './datos'


export function MuestraSerie({ serie, className }: { serie: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block shrink-0 rounded-sm', className)}
      style={{ backgroundColor: `var(--serie-${(serie % 6) + 1})`, background: `${PATRON_CSS[serie % 6]}, var(--serie-${(serie % 6) + 1})` }}
    />
  )
}

/**
 * Métrica 2 — proporción del dinero ahorrado. Esta barra SÍ es proporcional
 * (ancho = saldo / total de cajitas activas). No es el porcentaje de reparto
 * ni el progreso de una meta. Lleva tabla equivalente.
 */
export function ProporcionAhorro({ items }: { items: CajitaCaparazon[] }) {
  const conSaldo = items.filter((x) => x.saldo > 0)
  if (conSaldo.length === 0) {
    return <p className="text-sm text-texto-suave">Todavía no hay dinero en tus cajitas activas.</p>
  }
  return (
    <figure className="space-y-3">
      <figcaption className="text-xs text-texto-suave">
        Cómo se reparte hoy lo que tienes ahorrado (el ancho es proporcional al saldo).
      </figcaption>
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-borde" aria-hidden>
        {conSaldo.map((x) => (
          <span
            key={x.cajita.id}
            className="h-full border-r border-fondo last:border-r-0"
            style={{ width: `${x.proporcion}%`, background: `${PATRON_CSS[x.serie]}, var(--serie-${x.serie + 1})` }}
            title={`${x.cajita.nombre}: ${etiquetaPorcentaje(x.proporcion ?? 0)}`}
          />
        ))}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Proporción del ahorro por cajita</caption>
        <thead className="sr-only">
          <tr>
            <th>Cajita</th>
            <th>Saldo</th>
            <th>Proporción</th>
          </tr>
        </thead>
        <tbody>
          {conSaldo.map((x) => (
            <tr key={x.cajita.id} className="border-t border-borde first:border-t-0">
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <MuestraSerie serie={x.serie} className="size-3" />
                  <span className="truncate">
                    {x.numero}. {x.cajita.nombre}
                  </span>
                </span>
              </td>
              <td className="cifra py-1.5 text-right text-texto-suave">{dinero(x.saldo)}</td>
              <td className="cifra w-16 py-1.5 text-right font-semibold">{etiquetaPorcentaje(x.proporcion ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
