import { useCallback, useEffect, useSyncExternalStore } from 'react'

/**
 * Preferencias visuales centralizadas: cuatro ejes independientes
 * (docs/decisiones-foundations.md §6 y docs/decisiones-design-system.md).
 *
 *  - estilo      → data-estilo   (sin atributo = original)
 *  - apariencia  → data-theme    ("light" = claro; sin atributo = oscuro). "sistema" sigue al SO.
 *  - paleta      → data-paleta   (depende del estilo; inválida → la primera del estilo)
 *  - movimiento  → data-movimiento (efectivo: prefers-reduced-motion siempre fuerza "reducido")
 *
 * Se guardan en localStorage (son preferencias por dispositivo, no datos
 * financieros). `index.html` aplica lo mismo antes del primer render para
 * evitar destellos; si cambias las claves o los valores, cámbialos también allí.
 * Compatibilidad: `hicotea:tema` sigue aceptando "claro" y "oscuro"; se añade "sistema".
 */

export type Estilo = 'original' | 'natura' | 'impact' | 'rebel'
export type Apariencia = 'oscuro' | 'claro' | 'sistema'
export type Movimiento = 'completo' | 'sutil' | 'reducido'

export type Preferencias = { estilo: Estilo; apariencia: Apariencia; paleta: string; movimiento: Movimiento }

/** Estilos publicados. IMPACT y REBEL están preparados en la arquitectura pero no se pueden elegir aún. */
export const ESTILOS: { id: Estilo; nombre: string; descripcion: string; disponible: boolean }[] = [
  { id: 'original', nombre: 'Original', descripcion: 'Oscuro con tinte verde, preciso y sereno.', disponible: true },
  { id: 'natura', nombre: 'Natura', descripcion: 'Orgánico y cálido: crema, oliva y salvia.', disponible: true },
  { id: 'impact', nombre: 'IMPACT', descripcion: 'Editorial y expresivo. Próximamente.', disponible: false },
  { id: 'rebel', nombre: 'REBEL', descripcion: 'Angular y gráfico. Próximamente.', disponible: false },
]

/** Paletas por estilo; la primera es la de por defecto. `muestra` = [fondo claro, acento claro, acento oscuro]. */
export const PALETAS: Record<Estilo, { id: string; nombre: string; muestra: [string, string, string] }[]> = {
  original: [{ id: 'hicotea', nombre: 'Hicotea', muestra: ['#f4fbf7', '#047857', '#34d399'] }],
  natura: [
    { id: 'bosque', nombre: 'Bosque', muestra: ['#f4efe6', '#526b43', '#a9c08c'] },
    { id: 'arena', nombre: 'Arena', muestra: ['#f2e8d8', '#8b613b', '#d9b48f'] },
    { id: 'terracota', nombre: 'Terracota', muestra: ['#f8eee5', '#984f3c', '#e8a58f'] },
    { id: 'salvia', nombre: 'Salvia', muestra: ['#ecf0e6', '#4f7158', '#9cc2a5'] },
  ],
  impact: [],
  rebel: [],
}

const CLAVES = { estilo: 'hicotea:estilo', apariencia: 'hicotea:tema', paleta: 'hicotea:paleta', movimiento: 'hicotea:movimiento' }

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribir(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    /* sin almacenamiento: la preferencia dura lo que la pestaña */
  }
}

/** Resuelve cualquier combinación guardada (o inválida) a valores seguros. */
export function normalizar(p: Partial<Record<keyof Preferencias, string | null>>): Preferencias {
  const estilo = ESTILOS.find((e) => e.id === p.estilo && e.disponible)?.id ?? 'original'
  const apariencia: Apariencia = p.apariencia === 'claro' || p.apariencia === 'sistema' ? p.apariencia : 'oscuro'
  const paletas = PALETAS[estilo]
  const paleta = paletas.find((x) => x.id === p.paleta)?.id ?? paletas[0]?.id ?? 'hicotea'
  const movimiento: Movimiento = p.movimiento === 'sutil' || p.movimiento === 'reducido' ? p.movimiento : 'completo'
  return { estilo, apariencia, paleta, movimiento }
}

export function preferenciasGuardadas(): Preferencias {
  return normalizar({
    estilo: leer(CLAVES.estilo),
    apariencia: leer(CLAVES.apariencia),
    paleta: leer(CLAVES.paleta),
    movimiento: leer(CLAVES.movimiento),
  })
}

const mm = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null)
const sistemaOscuro = () => mm('(prefers-color-scheme: dark)')?.matches ?? true
const sistemaReducido = () => mm('(prefers-reduced-motion: reduce)')?.matches ?? false

export const esClaro = (p: Preferencias) => p.apariencia === 'claro' || (p.apariencia === 'sistema' && !sistemaOscuro())

/** Movimiento efectivo: el del usuario, salvo que el sistema pida reducirlo. */
export const movimientoEfectivo = (p: Preferencias): Movimiento => (sistemaReducido() ? 'reducido' : p.movimiento)

/** Para animaciones en JS (contador, partículas): true si no se debe animar. */
export function movimientoReducido(): boolean {
  return sistemaReducido() || document.documentElement.dataset.movimiento === 'reducido'
}

export function aplicar(p: Preferencias) {
  const d = document.documentElement.dataset
  if (esClaro(p)) d.theme = 'light'
  else delete d.theme
  if (p.estilo === 'original') delete d.estilo
  else d.estilo = p.estilo
  d.paleta = p.paleta
  d.movimiento = movimientoEfectivo(p)
  const color = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

// ------------------------------------------------------------------ almacén reactivo

let actual: Preferencias = typeof window === 'undefined' ? normalizar({}) : preferenciasGuardadas()
const oyentes = new Set<() => void>()

export function guardarPreferencias(cambio: Partial<Preferencias>) {
  const nuevo = normalizar({ ...actual, ...cambio })
  actual = nuevo
  escribir(CLAVES.estilo, nuevo.estilo)
  escribir(CLAVES.apariencia, nuevo.apariencia)
  escribir(CLAVES.paleta, nuevo.paleta)
  escribir(CLAVES.movimiento, nuevo.movimiento)
  aplicar(nuevo)
  oyentes.forEach((o) => o())
}

function suscribir(o: () => void) {
  oyentes.add(o)
  return () => oyentes.delete(o)
}

export function usePreferencias() {
  const p = useSyncExternalStore(suscribir, () => actual)
  // Con "sistema" o reduced-motion, seguir los cambios del SO en vivo.
  useEffect(() => {
    const oscuro = mm('(prefers-color-scheme: dark)')
    const reducido = mm('(prefers-reduced-motion: reduce)')
    const reaplicar = () => aplicar(actual)
    oscuro?.addEventListener('change', reaplicar)
    reducido?.addEventListener('change', reaplicar)
    return () => {
      oscuro?.removeEventListener('change', reaplicar)
      reducido?.removeEventListener('change', reaplicar)
    }
  }, [])
  const cambiar = useCallback((c: Partial<Preferencias>) => guardarPreferencias(c), [])
  return { preferencias: p, cambiar, claro: esClaro(p) }
}
