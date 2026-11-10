import { cx } from './ui'

// Identidad final de Hicotea (símbolo 10B): tortuga con caparazón de tres discos de moneda
// y una moneda entrando en la alcancía. Misma geometría que Identidad/s_mbolo_oficial_logo_svg.svg;
// los colores son fijos (el símbolo se ve igual en tema oscuro y claro, como en el kit).

/** Solo el símbolo. Para espacios pequeños o cuadrados (carga, favicon, avatar). */
export function Simbolo({ className = 'size-8', titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      <g>
      <path d="M15 74 L5 67 L15 62 Z" fill="#34D399"/>
      <rect x="23" y="76" width="16" height="20" rx="8" fill="#34D399"/>
      <rect x="63" y="76" width="16" height="20" rx="8" fill="#34D399"/>
      <path d="M13 65 C13 78 89 78 89 65 V74 C89 87 13 87 13 74 Z" fill="#16261F" stroke="#34D399" strokeWidth="4" strokeLinejoin="round"/>
      <ellipse cx="51" cy="64" rx="38" ry="11.5" fill="#0E1A15" stroke="#34D399" strokeWidth="4.5"/>
      <line x1="34" y1="74" x2="34" y2="81" stroke="#34D399" strokeWidth="3" strokeLinecap="round"/>
      <line x1="51" y1="75" x2="51" y2="82" stroke="#34D399" strokeWidth="3" strokeLinecap="round"/>
      <line x1="68" y1="74" x2="68" y2="81" stroke="#34D399" strokeWidth="3" strokeLinecap="round"/>
      <path d="M19 49 C19 59 83 59 83 49 V57 C83 67 19 67 19 57 Z" fill="#16261F" stroke="#34D399" strokeWidth="4" strokeLinejoin="round"/>
      <ellipse cx="51" cy="48" rx="32" ry="10" fill="#0E1A15" stroke="#34D399" strokeWidth="4.5"/>
      <line x1="38" y1="57" x2="38" y2="63" stroke="#34D399" strokeWidth="3" strokeLinecap="round"/>
      <line x1="51" y1="58" x2="51" y2="64" stroke="#34D399" strokeWidth="3" strokeLinecap="round"/>
      <line x1="64" y1="57" x2="64" y2="63" stroke="#34D399" strokeWidth="3" strokeLinecap="round"/>
      <path d="M26 35 C26 43 76 43 76 35 V42 C76 50 26 50 26 42 Z" fill="#34D399" stroke="#07100C" strokeWidth="2.5"/>
      <ellipse cx="51" cy="34" rx="25" ry="8.5" fill="#34D399" stroke="#07100C" strokeWidth="3"/>
      <rect x="35" y="30.5" width="32" height="7" rx="3.5" fill="#07100C"/>
      <g transform="translate(51, 24) rotate(-18)">
        <ellipse cx="0" cy="3.5" rx="13" ry="8.5" fill="#16261F" stroke="#A3E635" strokeWidth="3"/>
        <ellipse cx="0" cy="0" rx="13" ry="8.5" fill="#A3E635" stroke="#07100C" strokeWidth="3"/>
        <ellipse cx="0" cy="0" rx="6" ry="3.2" fill="none" stroke="#07100C" strokeWidth="2.5"/>
      </g>
      <path d="M36 34.5 H66" stroke="#07100C" strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M83 52 H96 C107 52 115 59 115 69 C115 76 109 81 99 81 H81 Z" fill="#34D399" stroke="#07100C" strokeWidth="3.5" strokeLinejoin="round"/>
      <circle cx="104" cy="65" r="3" fill="#07100C"/>
      <rect x="90" y="57" width="8.5" height="4" rx="2" fill="#A3E635"/>
      </g>
    </svg>
  )
}

const TAMANOS = {
  sm: { simbolo: 'size-8', texto: 'text-xl' },
  md: { simbolo: 'size-9', texto: 'text-2xl' },
  lg: { simbolo: 'size-12', texto: 'text-3xl' },
}

/** Símbolo + "Hicotea." en Plus Jakarta Sans 800, con el punto en acento vivo (lockup del kit). */
export function Wordmark({ tamano = 'sm', className }: { tamano?: keyof typeof TAMANOS; className?: string }) {
  const t = TAMANOS[tamano]
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <Simbolo className={cx(t.simbolo, 'shrink-0')} />
      <span className={cx('font-marca leading-none font-extrabold tracking-[-0.03em] text-texto', t.texto)}>
        Hicotea<span className="text-acento-vivo">.</span>
      </span>
    </span>
  )
}
