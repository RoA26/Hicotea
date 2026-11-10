import type { ReactNode } from 'react'
import type { Movimiento } from '../api/tipos'
import { fechaCorta, NOMBRE_TIPO_MOVIMIENTO } from '../lib/formato'
import { Monto } from './ui'

export function tituloMovimiento(m: Movimiento): string {
  if (m.tipo === 'INGRESO' || m.tipo === 'GASTO') return m.nombre_categoria ?? NOMBRE_TIPO_MOVIMIENTO[m.tipo]
  return `${NOMBRE_TIPO_MOVIMIENTO[m.tipo]} · ${m.nombre_cajita ?? ''}`
}

function detalle(m: Movimiento): string {
  const partes = [fechaCorta(m.fecha)]
  if (m.nombre_fuente) partes.push(m.nombre_fuente)
  if (m.nombre_cajita_origen) partes.push(`desde ${m.nombre_cajita_origen}`)
  if (m.descripcion) partes.push(m.descripcion)
  return partes.join(' · ')
}

/** Lista de movimientos; `acciones` pinta los botones de cada fila. */
export function ListaMovimientos({ movimientos, acciones }: { movimientos: Movimiento[]; acciones?: (m: Movimiento) => ReactNode }) {
  return (
    <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
      {movimientos.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{tituloMovimiento(m)}</p>
            <p className="truncate text-xs text-texto-suave">{detalle(m)}</p>
          </div>
          <Monto valor={m.monto} entrada={m.entrada} signo className="font-semibold" />
          {acciones && <div className="flex shrink-0 gap-1">{acciones(m)}</div>}
        </li>
      ))}
    </ul>
  )
}
