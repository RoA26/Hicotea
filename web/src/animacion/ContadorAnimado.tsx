import type { AnimationPlaybackControls } from 'motion'
import { useLayoutEffect, useRef } from 'react'
import { dinero, numero } from '../lib/formato'
import { movimientoReducido } from '../tema/preferencias'

interface Props {
  valor: string | number
  className?: string
  /** Duración en milisegundos (por defecto 450ms) */
  duracion?: number
  /** Si es true, formatea como dinero colombiano `$ 120.000` */
  esDinero?: boolean
}

/** easeOutCubic, la misma curva que usaba la versión con requestAnimationFrame. */
const FRENADO = [0.33, 1, 0.68, 1] as const

/**
 * Motion se carga bajo demanda la primera vez que una cifra cambia (~25 kB gzip
 * que no van en el paquete inicial). La primera pintura muestra la cifra final
 * sin esperar a nada. Ver docs/decisiones-foundations.md (D-M2).
 */
let cargaMotion: Promise<typeof import('./motionAnimar')> | null = null
const motion = () => (cargaMotion ??= import('./motionAnimar'))

/**
 * Contador de cifras animado: al registrar un ingreso, gasto o usar un atajo,
 * el saldo rueda hacia la nueva cantidad.
 *
 * Usa `animate()` de Motion y escribe el texto directamente en el DOM, así que
 * React no vuelve a renderizar en cada frame. Si llega un valor nuevo a mitad
 * de camino, continúa desde la cifra que se está viendo (no salta).
 * Con prefers-reduced-motion, o si Motion no carga (sin red y sin caché), la
 * cifra cambia sin animación.
 */
export function ContadorAnimado({ valor, className, duracion = 450, esDinero = true }: Props) {
  const destino = typeof valor === 'number' ? valor : numero(valor)
  const ref = useRef<HTMLSpanElement>(null)
  const visible = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const pintar = (n: number) => {
      visible.current = n
      el.textContent = esDinero ? dinero(n) : Math.round(n).toLocaleString('es-CO')
    }
    const inicio = visible.current
    const reducido = movimientoReducido() // prefers-reduced-motion o preferencia "reducido"
    if (inicio === null || inicio === destino || reducido) {
      pintar(destino)
      return
    }
    let cancelado = false
    let control: AnimationPlaybackControls | null = null
    motion().then(
      ({ animate }) => {
        if (cancelado) return
        control = animate(inicio, destino, {
          duration: duracion / 1000,
          ease: FRENADO,
          onUpdate: pintar,
          onComplete: () => pintar(destino),
        })
      },
      () => {
        cargaMotion = null // reintenta la próxima vez
        if (!cancelado) pintar(destino)
      },
    )
    return () => {
      cancelado = true
      control?.stop()
    }
  }, [destino, duracion, esDinero])

  // El texto lo escribe el efecto; React no lo toca para no pisar la animación.
  return <span ref={ref} className={className} />
}
