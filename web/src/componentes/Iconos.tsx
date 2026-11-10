// Íconos de trazo (24×24) dibujados a mano para no cargar una librería.
const TRAZOS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  cerrar: 'M6 6l12 12M18 6L6 18',
  mas: 'M12 5v14M5 12h14',
  sol: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66l1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14l-1.41-1.41M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  luna: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  inicio: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  movimientos: 'M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l-3 3m3-3l3 3',
  fuentes: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  cajitas: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  metas: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10zm0-4a1 1 0 100-2 1 1 0 000 2z',
  presupuestos: 'M4 20V10m6 10V4m6 16v-7m6 7H2',
  recurrentes: 'M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15m0 5v-5h5',
  categorias: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4m8-4v4',
  compartir: 'M16 8a3 3 0 100-6 3 3 0 000 6zM8 15a3 3 0 100-6 3 3 0 000 6zm8 7a3 3 0 100-6 3 3 0 000 6zm-5.4-11.5l2.8-1.5m-2.8 4.5l2.8 1.5',
  atajos: 'M13 2L4 14h7l-1 8 9-12h-7z',
  salir: 'M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 16l-4-4 4-4M6 12h10',
  izquierda: 'M15 6l-6 6 6 6',
  derecha: 'M9 6l6 6-6 6',
  lapiz: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  basura: 'M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
} as const

export type NombreIcono = keyof typeof TRAZOS

export function Icono({ nombre, className = 'size-5' }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}

/** Tortuga de Hicotea (borrador v1 del logo, ver CLAUDE.md). */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <ellipse cx="14" cy="40" rx="5" ry="4" fill="#059669" />
      <ellipse cx="42" cy="40" rx="5" ry="4" fill="#059669" />
      <ellipse cx="54" cy="28" rx="7" ry="6" fill="#34D399" />
      <circle cx="56" cy="26" r="1.3" fill="#047857" />
      <path d="M4 36 Q6 10 28 8 Q50 10 52 36 Z" fill="#10B981" stroke="#059669" strokeWidth="2" />
      <path d="M12 36 L16 22 M44 36 L40 22 M16 22 Q28 14 40 22 M16 22 L28 30 L40 22 M28 30 V36" stroke="#047857" strokeWidth="1.6" fill="none" />
      <path d="M28 16 l5 3 v5 l-5 3 l-5 -3 v-5 z" fill="#A3E635" />
    </svg>
  )
}
