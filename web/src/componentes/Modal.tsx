import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icono } from './Iconos'

/** Modal accesible: se cierra con Escape o tocando fuera; en móvil sube como hoja inferior. */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
}) {
  const id = useId()
  const caja = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    // Enfoca el primer campo; si no hay, la caja.
    const primero = caja.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-cerrar])')
    ;(primero ?? caja.current)?.focus()
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
      // Devuelve el foco a quien abrió el modal solo si se perdió (quedó en <body>).
      // Si el modal se cerró al navegar, la pantalla nueva ya pudo enfocar su primer campo.
      const actual = document.activeElement
      if (!actual || actual === document.body || caja.current?.contains(actual)) previo?.focus?.()
    }
  }, [abierto])

  if (!abierto) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="anim-fondo absolute inset-0 bg-[var(--velo)] backdrop-blur-xs" onClick={onCerrar} aria-hidden />
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="anim-modal relative max-h-[90dvh] w-full overflow-y-auto rounded-t-modal border border-borde bg-superficie p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-elevada outline-none sm:max-w-md sm:rounded-modal"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={id} className="text-lg font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            data-cerrar
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full text-texto-suave hover:bg-superficie-2 hover:text-texto"
          >
            <Icono nombre="cerrar" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
