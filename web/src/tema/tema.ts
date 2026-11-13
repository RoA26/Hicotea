import { aplicar, preferenciasGuardadas, usePreferencias } from './preferencias'

/**
 * Compatibilidad con el API anterior (tema claro/oscuro). La fuente de verdad
 * ahora es `tema/preferencias.ts`, que además maneja estilo, paleta,
 * apariencia "sistema" y movimiento.
 */
export type Tema = 'oscuro' | 'claro'

export function aplicarPreferenciasGuardadas() {
  aplicar(preferenciasGuardadas())
}

export function useTema() {
  const { claro, cambiar } = usePreferencias()
  const tema: Tema = claro ? 'claro' : 'oscuro'
  return { tema, alternar: () => cambiar({ apariencia: claro ? 'oscuro' : 'claro' }) }
}
