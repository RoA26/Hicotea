import { useEffect, useRef, useState } from 'react'
import { dinero, numero } from '../lib/formato'

interface Props {
  valor: string | number
  className?: string
  /** Duración en milisegundos (por defecto 450ms) */
  duracion?: number
  /** Si es true, formatea como dinero colombiano `$ 120.000` */
  esDinero?: boolean
}

/**
 * Contador de cifras animado con física de frenado suave (Fase 4).
 * Al registrar un ingreso, gasto o usar un atajo, el saldo total rueda
 * fluidamente hacia la nueva cantidad sin saltos bruscos.
 * Respeta prefers-reduced-motion.
 */
export function ContadorAnimado({ valor, className, duracion = 450, esDinero = true }: Props) {
  const destino = typeof valor === 'number' ? valor : numero(valor)
  const [actual, setActual] = useState(destino)
  const previoRef = useRef(destino)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const inicio = previoRef.current
    const fin = destino
    previoRef.current = fin

    // Si no hay cambio o el usuario prefiere movimiento reducido, saltamos directo
    if (inicio === fin || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActual(fin)
      return
    }

    const tiempoInicio = performance.now()

    const animar = (tiempoAhora: number) => {
      const transcurrido = tiempoAhora - tiempoInicio
      const progreso = Math.min(transcurrido / duracion, 1)

      // Función de aceleración/desaceleración suave (easeOutCubic)
      const factor = 1 - Math.pow(1 - progreso, 3)
      const valorIntermedio = inicio + (fin - inicio) * factor

      setActual(valorIntermedio)

      if (progreso < 1) {
        frameRef.current = requestAnimationFrame(animar)
      } else {
        setActual(fin)
      }
    }

    frameRef.current = requestAnimationFrame(animar)

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [destino, duracion])

  const texto = esDinero ? dinero(actual) : Math.round(actual).toLocaleString('es-CO')

  return <span className={className}>{texto}</span>
}

