import type { KeyboardEvent } from 'react'
import { cx } from '../ui'

/**
 * Tortuga del Caparazón (SVG propio de Hicotea).
 *
 * Las placas son hexágonos **del mismo tamaño**: no representan cuánto dinero
 * hay en cada cajita (eso lo muestra `ProporcionAhorro`, que sí es
 * proporcional). Cada placa identifica una cajita con color de serie, patrón
 * propio, inicial y número, así no depende solo del color.
 *
 * Capacidad: 7 placas. Con más cajitas, la última placa agrupa el resto
 * ("+N") y la lista accesible sigue mostrando todas: no hay límite de cajitas.
 * La interacción principal también existe en la lista (`ListaCaparazon`).
 */

export const PLACAS = 7
const R = 34 // radio de cada hexágono
const CX = 190
const CY = 132
const PASO = R * Math.sqrt(3) + 4 // distancia entre centros (con junta)

/** Centro primero y luego el anillo, en sentido horario desde arriba. */
const CENTROS: [number, number][] = [
  [CX, CY],
  ...[-90, -30, 30, 90, 150, 210].map((g): [number, number] => {
    const a = (g * Math.PI) / 180
    return [CX + PASO * Math.cos(a), CY + PASO * Math.sin(a)]
  }),
]

const hexagono = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i // hexágono de lado plano arriba
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')

export type Placa =
  | { tipo: 'cajita'; clave: string; nombre: string; numero: number; serie: number; conSaldo: boolean; etiqueta: string }
  | { tipo: 'grupo'; clave: 'grupo'; cantidad: number; etiqueta: string }
  | { tipo: 'libre'; clave: string }

/** Patrones por serie (índice 0-5): rayas, puntos, horizontales, cuadrícula, verticales, liso. */
function Patrones() {
  const t = 'var(--texto-sobre-serie)'
  return (
    <defs>
      <pattern id="pc-0" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="3" height="8" fill={t} opacity="0.22" />
      </pattern>
      <pattern id="pc-1" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.6" fill={t} opacity="0.28" />
      </pattern>
      <pattern id="pc-2" width="8" height="7" patternUnits="userSpaceOnUse">
        <rect width="8" height="2" fill={t} opacity="0.22" />
      </pattern>
      <pattern id="pc-3" width="9" height="9" patternUnits="userSpaceOnUse">
        <path d="M0 0H9M0 0V9" stroke={t} strokeWidth="1.2" opacity="0.25" />
      </pattern>
      <pattern id="pc-4" width="7" height="8" patternUnits="userSpaceOnUse">
        <rect width="2" height="8" fill={t} opacity="0.22" />
      </pattern>
      <pattern id="pc-5" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="none" />
      </pattern>
    </defs>
  )
}

export function Tortuga({
  placas,
  seleccion,
  alSeleccionar,
  alLibre,
}: {
  placas: Placa[]
  seleccion: string | null
  alSeleccionar: (clave: string) => void
  /** Placa libre: invita a crear una cajita. */
  alLibre?: () => void
}) {
  const activar = (e: KeyboardEvent, hacer: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      hacer()
    }
  }
  const resumen = placas.filter((p) => p.tipo !== 'libre').length

  return (
    <svg
      viewBox="0 0 380 270"
      className="mx-auto block h-auto w-full max-w-md select-none"
      role="group"
      aria-label={`Caparazón con ${resumen} ${resumen === 1 ? 'placa' : 'placas'}. Las placas tienen el mismo tamaño; la proporción del ahorro se muestra aparte.`}
    >
      <Patrones />
      {/* Cuerpo: cabeza, patas y cola (sin datos) */}
      <g aria-hidden fill="var(--superficie-2)" stroke="var(--borde)" strokeWidth="2">
        <ellipse cx="330" cy="134" rx="28" ry="22" />
        <circle cx="343" cy="127" r="3" fill="var(--texto)" stroke="none" />
        <ellipse cx="104" cy="222" rx="26" ry="15" transform="rotate(-25 104 222)" />
        <ellipse cx="276" cy="222" rx="26" ry="15" transform="rotate(25 276 222)" />
        <ellipse cx="104" cy="42" rx="24" ry="14" transform="rotate(25 104 42)" />
        <ellipse cx="276" cy="42" rx="24" ry="14" transform="rotate(-25 276 42)" />
        <path d="M70 132 L42 124 L46 142 Z" />
        <ellipse cx={CX} cy={CY} rx="124" ry="110" fill="var(--superficie)" strokeWidth="3" />
      </g>

      {CENTROS.map(([x, y], i) => {
        const p = placas[i] ?? { tipo: 'libre', clave: `libre-${i}` }
        const elegida = p.tipo !== 'libre' && p.clave === seleccion

        if (p.tipo === 'libre') {
          return (
            <g
              key={p.clave}
              role={alLibre ? 'button' : undefined}
              tabIndex={alLibre ? 0 : undefined}
              aria-label={alLibre ? 'Placa libre: crear una cajita' : undefined}
              aria-hidden={alLibre ? undefined : true}
              onClick={alLibre}
              onKeyDown={alLibre ? (e) => activar(e, alLibre) : undefined}
              className={cx('placa-caparazon', alLibre && 'cursor-pointer')}
            >
              <polygon points={hexagono(x, y, R)} fill="transparent" stroke="var(--borde)" strokeWidth="2" strokeDasharray="5 4" />
              {alLibre && i === 0 && (
                <text x={x} y={y + 7} textAnchor="middle" fontSize="22" fill="var(--texto-suave)">
                  +
                </text>
              )}
            </g>
          )
        }

        const color = p.tipo === 'cajita' ? `var(--serie-${(p.serie % 6) + 1})` : 'var(--superficie-2)'
        const sinSaldo = p.tipo === 'cajita' && !p.conSaldo
        return (
          <g
            key={p.clave}
            role="button"
            tabIndex={0}
            aria-pressed={elegida}
            aria-label={p.etiqueta}
            onClick={() => alSeleccionar(p.clave)}
            onKeyDown={(e) => activar(e, () => alSeleccionar(p.clave))}
            className="placa-caparazon cursor-pointer"
            data-elegida={elegida || undefined}
            style={{ transformOrigin: `${x}px ${y}px` }}
          >
            <polygon
              points={hexagono(x, y, R)}
              fill={sinSaldo ? 'var(--superficie-2)' : color}
              stroke={elegida ? 'var(--texto)' : sinSaldo ? color : 'var(--fondo)'}
              strokeWidth={elegida ? 4 : 2.5}
              strokeDasharray={sinSaldo ? '6 4' : undefined}
            />
            {p.tipo === 'cajita' && !sinSaldo && <polygon points={hexagono(x, y, R)} fill={`url(#pc-${p.serie % 6})`} />}
            <text
              x={x}
              y={y + 2}
              textAnchor="middle"
              fontSize={p.tipo === 'grupo' ? 18 : 22}
              fontWeight="700"
              fill={sinSaldo || p.tipo === 'grupo' ? 'var(--texto)' : 'var(--texto-sobre-serie)'}
            >
              {p.tipo === 'grupo' ? `+${p.cantidad}` : p.nombre.charAt(0).toUpperCase()}
            </text>
            {p.tipo === 'cajita' && (
              <text
                x={x}
                y={y + 18}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={sinSaldo ? 'var(--texto-suave)' : 'var(--texto-sobre-serie)'}
              >
                {sinSaldo ? `${p.numero} · sin saldo` : p.numero}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
