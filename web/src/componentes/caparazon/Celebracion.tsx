import { useEffect, useRef } from 'react'
import type { Meta } from '../../api/tipos'
import { dinero, fechaLarga } from '../../lib/formato'
import { movimientoReducido } from '../../tema/preferencias'
import { Boton } from '../ui'

/**
 * Celebración breve y accesible al reconocer un logro. El anuncio va por
 * `role="status"`; la animación (Motion, carga diferida) es decorativa, solo
 * usa transform/opacity y se omite con movimiento reducido. No mueve dinero.
 */
export function Celebracion({ meta, alCerrar }: { meta: Meta; alCerrar: () => void }) {
  const moneda = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = moneda.current
    if (!el || movimientoReducido()) return
    let parar: (() => void) | undefined
    void import('../../animacion/motionAnimar').then(({ animate }) => {
      const c = animate(el, { scale: [0.6, 1.12, 1], rotate: [-18, 8, 0], opacity: [0, 1] }, { duration: 0.6, ease: [0.22, 1, 0.36, 1] })
      parar = () => c.stop()
    })
    return () => parar?.()
  }, [])

  return (
    <div role="status" className="anim-escalonado flex gap-4 rounded-tarjeta border border-acento/40 bg-acento/10 p-4">
      <svg ref={moneda} viewBox="0 0 48 48" className="size-12 shrink-0" aria-hidden>
        <circle cx="24" cy="24" r="20" fill="var(--acento-vivo)" />
        <circle cx="24" cy="24" r="14" fill="none" stroke="var(--fondo)" strokeWidth="2.5" opacity="0.5" />
        <path d="M17 24.5l5 5 9-11" fill="none" stroke="var(--fondo)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">¡Lograste «{meta.nombre}»!</p>
        <p className="mt-1 text-texto-suave">
          Guardaste <span className="cifra font-medium text-texto">{dinero(meta.monto_logrado ?? meta.monto_objetivo)}</span>
          {meta.alcanzada_en && <> · la cajita llegó al objetivo el {fechaLarga(meta.alcanzada_en)}</>}. El dinero sigue en tu cajita: úsalo o
          retíralo cuando quieras. El logro queda en tu archivo.
        </p>
      </div>
      <Boton chico variante="fantasma" onClick={alCerrar} aria-label="Cerrar celebración">
        ✕
      </Boton>
    </div>
  )
}
