import type { ReactNode } from 'react'
import { useLocation } from 'react-router'

interface Props {
  children: ReactNode
}

/**
 * Transición de página sutil (Fase 4):
 * Fade + desplazamiento vertical de 8px en ~200ms al cambiar de ruta.
 * Activada limpiamente mediante la clave de ruta (key={pathname}) y CSS.
 * Respeta estrictamente prefers-reduced-motion.
 */
export function TransicionPagina({ children }: Props) {
  const { pathname } = useLocation()

  return (
    <div key={pathname} className="anim-escalonado">
      {children}
    </div>
  )
}
