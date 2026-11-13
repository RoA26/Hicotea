import type { Cajita, Meta } from '../../api/tipos'
import { dinero, fechaLarga, formatoPorcentaje } from '../../lib/formato'
import { Barra, Insignia } from '../ui'
import { etiquetaPorcentaje } from './datos'

/**
 * Las tres métricas de una cajita, siempre separadas y con su nombre:
 *  1. Reparto: regla configurada para repartir ingresos (no es dinero).
 *  2. Proporción: cuánto del ahorro total está en esta cajita (solo número).
 *  3. Meta: progreso de su meta activa (la única barra de las tres).
 */
export function MetricasCajita({ cajita, proporcion, meta }: { cajita: Cajita; proporcion: number | null; meta: Meta | null }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs text-texto-suave">1 · Reparto de ingresos</dt>
        <dd className="mt-0.5">
          <Insignia tono={cajita.es_resto ? 'acento' : 'suave'}>
            {cajita.es_resto ? 'Recibe el resto' : `${formatoPorcentaje(cajita.porcentaje)} de cada reparto`}
          </Insignia>
        </dd>
      </div>
      <div>
        <dt className="text-xs text-texto-suave">2 · Parte de tu ahorro</dt>
        <dd className="cifra mt-0.5 font-semibold">{proporcion === null ? '—' : `${etiquetaPorcentaje(proporcion)} del total`}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-texto-suave">3 · Meta</dt>
        <dd className="mt-0.5">
          {meta ? <ProgresoMeta meta={meta} /> : <span className="text-texto-suave">Sin meta activa.</span>}
        </dd>
      </div>
    </dl>
  )
}

export function ProgresoMeta({ meta }: { meta: Meta }) {
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="font-medium">{meta.nombre}</span>
        <span className="cifra text-texto-suave">
          {dinero(meta.saldo_cajita)} de {dinero(meta.monto_objetivo)}
        </span>
      </p>
      <Barra porcentaje={meta.porcentaje} etiqueta={`Progreso de la meta ${meta.nombre}`} />
      <p className="cifra text-xs text-texto-suave">
        {meta.cumplida ? '¡Objetivo alcanzado!' : `${meta.porcentaje} % · faltan ${dinero(meta.faltante)}`}
        {meta.fecha_objetivo && ` · para el ${fechaLarga(meta.fecha_objetivo)}`}
        {meta.aporte_mensual && !meta.cumplida && ` · aporta ${dinero(meta.aporte_mensual)} al mes`}
        {meta.vencida && !meta.cumplida && ' · la fecha ya pasó'}
      </p>
    </div>
  )
}
