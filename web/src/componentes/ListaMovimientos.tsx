import type { ReactNode } from 'react'
import { Link } from 'react-router'
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

/**
 * Lista de movimientos; `acciones` pinta los botones de cada fila y `enlace`
 * (si devuelve una ruta) hace que tocar la fila la abra: en el celular es la
 * forma cómoda de editar, sin botones pequeños que le quiten espacio al texto.
 */
export function ListaMovimientos({
  movimientos,
  acciones,
  enlace,
}: {
  movimientos: Movimiento[]
  acciones?: (m: Movimiento) => ReactNode
  enlace?: (m: Movimiento) => string | null
}) {
  return (
    <ul className="divide-y divide-borde overflow-hidden rounded-tarjeta border border-borde bg-superficie">
      {movimientos.map((m, i) => (
        <li
          key={m.id}
          className="anim-escalonado flex items-center gap-3 px-4 py-3"
          style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
        >
          {(() => {
            const ruta = enlace?.(m)
            const contenido = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tituloMovimiento(m)}</span>
                  <span className="block truncate text-xs text-texto-suave">{detalle(m)}</span>
                </span>
                <Monto valor={m.monto} entrada={m.entrada} signo className="font-semibold" />
              </>
            )
            return ruta ? (
              <Link to={ruta} className="-my-3 -ml-4 flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 hover:bg-superficie-2/40 focus-visible:outline-offset-[-2px]">
                {contenido}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3">{contenido}</div>
            )
          })()}
          {acciones && <div className="flex shrink-0 gap-1">{acciones(m)}</div>}
        </li>
      ))}
    </ul>
  )
}
