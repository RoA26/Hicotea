import { useEffect, useState } from 'react'

export type Tema = 'oscuro' | 'claro'
const CLAVE = 'hicotea:tema'

export function temaGuardado(): Tema {
  try {
    return localStorage.getItem(CLAVE) === 'claro' ? 'claro' : 'oscuro'
  } catch {
    return 'oscuro'
  }
}

export function aplicarTema(t: Tema) {
  if (t === 'claro') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
  const color = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(temaGuardado)
  useEffect(() => {
    aplicarTema(tema)
    try {
      localStorage.setItem(CLAVE, tema)
    } catch {
      /* sin almacenamiento: el tema dura lo que la pestaña */
    }
  }, [tema])
  return { tema, alternar: () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro')) }
}
