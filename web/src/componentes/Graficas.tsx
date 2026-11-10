import { useState, type ReactNode } from 'react'
import { dinero, nombreMesCorto, numero } from '../lib/formato'
import { cx } from './ui'

// Gráficas en HTML (sin librería). Cada una: lectura al pasar o tocar una barra,
// leyenda cuando hay dos series y una tabla equivalente para quien no ve el color.
// Verde y rojo no se distinguen con deuteranopía, así que los gastos llevan textura rayada.

const RAYADO = {
  backgroundImage: 'repeating-linear-gradient(135deg, var(--gasto) 0 3px, color-mix(in oklab, var(--gasto) 45%, transparent) 3px 6px)',
}

function Lectura({ children }: { children: ReactNode }) {
  return <p className="cifra mb-2 h-5 truncate text-sm text-texto-suave">{children}</p>
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-texto-suave hover:text-texto">Ver como tabla</summary>
      <table className="cifra mt-2 w-full">
        <thead>
          <tr className="text-left text-texto-suave">
            {columnas.map((c, i) => (
              <th key={c} className={cx('py-1 font-medium', i > 0 && 'text-right')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-t border-borde">
              {f.map((v, j) => (
                <td key={j} className={cx('py-1', j > 0 && 'text-right')}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

const alto = (v: number, max: number) => `${max > 0 ? Math.max(v > 0 ? 2 : 0, (v / max) * 100) : 0}%`

/** Ingresos y gastos por mes: barras agrupadas. */
export function GraficaMeses({ datos }: { datos: { mes: string; ingresos: string; gastos: string }[] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const max = Math.max(0, ...datos.flatMap((d) => [numero(d.ingresos), numero(d.gastos)]))
  const d = activo !== null ? datos[activo] : null
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-texto-suave">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-ingreso" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={RAYADO} /> Gastos
        </span>
      </div>
      <Lectura>
        {d ? `${nombreMesCorto(d.mes)}: ingresos ${dinero(d.ingresos)} · gastos ${dinero(d.gastos)}` : 'Toca un mes para ver el detalle'}
      </Lectura>
      <div className="flex h-40 items-end gap-2 border-b border-borde" onMouseLeave={() => setActivo(null)}>
        {datos.map((x, i) => (
          <button
            key={x.mes}
            type="button"
            aria-label={`${nombreMesCorto(x.mes)}: ingresos ${dinero(x.ingresos)}, gastos ${dinero(x.gastos)}`}
            onMouseEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            onClick={() => setActivo(i)}
            className={cx('flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md', activo === i && 'bg-superficie-2')}
          >
            <span className="w-full max-w-4 rounded-t bg-ingreso" style={{ height: alto(numero(x.ingresos), max) }} />
            <span className="w-full max-w-4 rounded-t" style={{ ...RAYADO, height: alto(numero(x.gastos), max) }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-center text-xs text-texto-suave">
        {datos.map((x) => (
          <span key={x.mes} className="flex-1 truncate">
            {nombreMesCorto(x.mes)}
          </span>
        ))}
      </div>
      <Tabla columnas={['Mes', 'Ingresos', 'Gastos']} filas={datos.map((x) => [nombreMesCorto(x.mes), dinero(x.ingresos), dinero(x.gastos)])} />
    </div>
  )
}

/** Gastos del mes por categoría: barras horizontales con etiqueta directa. */
export function GraficaCategorias({ datos }: { datos: { categoria: string; total: string }[] }) {
  const max = Math.max(0, ...datos.map((d) => numero(d.total)))
  return (
    <div>
      <ul className="space-y-2.5">
        {datos.map((d) => (
          <li key={d.categoria} title={`${d.categoria}: ${dinero(d.total)}`}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="truncate">{d.categoria}</span>
              <span className="cifra shrink-0 text-texto-suave">{dinero(d.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-superficie-2">
              <div className="h-full rounded-full bg-gasto" style={{ width: `${max ? (numero(d.total) / max) * 100 : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Producido por día del mes. */
export function GraficaDias({ datos }: { datos: { dia: number; total: string }[] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const max = Math.max(0, ...datos.map((d) => numero(d.total)))
  const d = activo !== null ? datos[activo] : null
  return (
    <div>
      <Lectura>{d ? `Día ${d.dia}: ${dinero(d.total)}` : 'Toca un día para ver el producido'}</Lectura>
      <div className="flex h-32 items-end gap-[2px] border-b border-borde" onMouseLeave={() => setActivo(null)}>
        {datos.map((x, i) => (
          <button
            key={x.dia}
            type="button"
            aria-label={`Día ${x.dia}: ${dinero(x.total)}`}
            onMouseEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            onClick={() => setActivo(i)}
            className={cx('flex h-full flex-1 items-end rounded-t-sm', activo === i && 'bg-superficie-2')}
          >
            <span className="w-full rounded-t-sm bg-ingreso" style={{ height: alto(numero(x.total), max) }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-texto-suave">
        <span>{datos[0]?.dia}</span>
        <span>{datos.at(-1)?.dia}</span>
      </div>
      <Tabla columnas={['Día', 'Producido']} filas={datos.map((x) => [x.dia, dinero(x.total)])} />
    </div>
  )
}
