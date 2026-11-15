import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router'
import { TransicionPagina } from '../animacion/TransicionPagina'
import { FUNCIONES } from '../lib/funciones'
import { useTema } from '../tema/tema'
import { AjustesApariencia } from './AjustesApariencia'
import { useSesion } from './Globales'
import { HojaRegistrar } from './HojaRegistrar'
import { Modal } from './Modal'
import { Icono, type NombreIcono } from './Iconos'
import { Wordmark } from './Marca'
import { cx } from './ui'

type Entrada = { a: string; texto: string; icono: NombreIcono; tambien?: string[] }

/** `tambien`: otras rutas que cuentan como esa sección (p. ej. el detalle de una cajita está en Caparazón). */
const MENU: Entrada[] = [
  { a: '/inicio', texto: 'Inicio', icono: 'inicio' },
  { a: '/movimientos', texto: 'Movimientos', icono: 'movimientos', tambien: ['/producido'] },
  { a: '/calendario', texto: 'Calendario', icono: 'calendario' },
  { a: '/fuentes', texto: 'Fuentes de ingreso', icono: 'fuentes' },
  // Caparazón reúne cajitas, metas, reparto e historial de ahorro (Cajitas y Metas ya no son entradas aparte).
  { a: '/caparazon', texto: 'Caparazón', icono: 'cajitas', tambien: ['/cajitas', '/metas'] },
  { a: '/presupuestos', texto: 'Presupuestos', icono: 'presupuestos' },
  { a: '/recurrentes', texto: 'Recurrentes', icono: 'recurrentes' },
  { a: '/atajos', texto: 'Atajos', icono: 'atajos' },
  // Compartir sale del menú de forma reversible (lib/funciones.ts); sus rutas y datos siguen intactos.
  ...(FUNCIONES.compartir ? [{ a: '/compartir', texto: 'Compartir', icono: 'compartir' as const }] : []),
]

const activa = (m: Entrada, pathname: string) =>
  pathname === m.a || pathname.startsWith(m.a + '/') || !!m.tambien?.some((r) => pathname.startsWith(r))

const claseOpcion = 'flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto'

function Navegacion({ alElegir }: { alElegir?: () => void }) {
  const { usuario, salir } = useSesion()
  const { tema, alternar } = useTema()
  const { pathname } = useLocation()
  const [ajustes, setAjustes] = useState(false)
  return (
    <div className="flex h-full flex-col">
      <Link to="/inicio" onClick={alElegir} className="px-4 py-4" aria-label="Hicotea, ir a Inicio">
        <Wordmark />
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2" aria-label="Secciones">
        {MENU.map((m) => (
          <NavLink
            key={m.a}
            to={m.a}
            onClick={alElegir}
            aria-current={activa(m, pathname) ? 'page' : undefined}
            className={cx(
              'flex min-h-11 items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors',
              activa(m, pathname) ? 'bg-acento/10 font-semibold text-acento' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto',
            )}
          >
            <Icono nombre={m.icono} />
            {m.texto}
          </NavLink>
        ))}
        {usuario?.rol === 'ADMIN' && (
          <NavLink to="/admin" onClick={alElegir} className={cx(claseOpcion, 'mt-3 border-t border-borde pt-3')}>
            <Icono nombre="escudo" />
            Administración
          </NavLink>
        )}
      </nav>
      <div className="space-y-1 border-t border-borde p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={alternar} className={claseOpcion}>
          <Icono nombre={tema === 'oscuro' ? 'sol' : 'luna'} />
          {tema === 'oscuro' ? 'Tema claro' : 'Tema oscuro'}
        </button>
        <button type="button" onClick={() => setAjustes(true)} className={claseOpcion}>
          <Icono nombre="categorias" />
          Estilo y apariencia
        </button>
        <Modal abierto={ajustes} onCerrar={() => setAjustes(false)} titulo="Estilo y apariencia">
          {ajustes && <AjustesApariencia />}
        </Modal>
        <button type="button" onClick={salir} className={claseOpcion}>
          <Icono nombre="salir" />
          <span className="min-w-0 flex-1 truncate text-left">
            Cerrar sesión <span className="text-xs">· @{usuario?.nombre_usuario}</span>
          </span>
        </button>
      </div>
    </div>
  )
}

/** Destinos de la barra inferior (móvil). El resto vive en "Más" (el cajón con el menú completo). */
const BARRA: Entrada[] = [
  { a: '/inicio', texto: 'Inicio', icono: 'inicio' },
  { a: '/movimientos', texto: 'Movimientos', icono: 'movimientos', tambien: ['/producido'] },
  { a: '/calendario', texto: 'Calendario', icono: 'calendario' },
]

function BarraInferior({ alRegistrar, alMas, masAbierto }: { alRegistrar: () => void; alMas: () => void; masAbierto: boolean }) {
  const { pathname } = useLocation()
  const enBarra = BARRA.some((m) => activa(m, pathname))
  const item = (m: Entrada) => (
    <NavLink
      key={m.a}
      to={m.a}
      aria-current={activa(m, pathname) ? 'page' : undefined}
      className={cx(
        'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
        activa(m, pathname) ? 'text-acento' : 'text-texto-suave hover:text-texto',
      )}
    >
      <Icono nombre={m.icono} className="size-6" />
      {m.texto}
    </NavLink>
  )
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-1">
        {item(BARRA[0])}
        {item(BARRA[1])}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={alRegistrar}
            aria-label="Registrar un movimiento"
            className="grid size-13 place-items-center rounded-full bg-acento text-sobre-acento shadow-elevada transition-transform active:scale-95"
          >
            <Icono nombre="mas" className="size-7" />
          </button>
        </div>
        {item(BARRA[2])}
        <button
          type="button"
          onClick={alMas}
          aria-expanded={masAbierto}
          aria-haspopup="dialog"
          className={cx(
            'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
            !enBarra ? 'text-acento' : 'text-texto-suave hover:text-texto',
          )}
        >
          <Icono nombre="menu" className="size-6" />
          Más
        </button>
      </div>
    </nav>
  )
}

const CLAVE_SCROLL = 'hicotea:scroll'

/**
 * Al ir a una pantalla nueva, arriba. Al volver (atrás/adelante), donde se
 * dejó: la lista de movimientos conserva su posición después de editar uno.
 * Los datos llegan después del primer render, así que se reintenta unos
 * cuadros hasta que la página sea lo bastante alta.
 */
function useScrollRecordado() {
  const { key } = useLocation()
  const tipo = useNavigationType()
  const posiciones = useRef<Record<string, number> | null>(null)
  // La clave de la pantalla visible. Se actualiza antes de mover el scroll, así
  // los eventos de scroll que provoca el cambio de pantalla nunca pisan la
  // posición guardada de la pantalla anterior.
  const claveActual = useRef(key)

  useEffect(() => {
    let cuadro = 0
    const guardar = () => {
      posiciones.current ??= leerPosiciones()
      posiciones.current[claveActual.current] = Math.round(window.scrollY)
      cancelAnimationFrame(cuadro)
      cuadro = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(CLAVE_SCROLL, JSON.stringify(posiciones.current))
        } catch {
          /* sin almacenamiento: se recuerda solo en memoria */
        }
      })
    }
    window.addEventListener('scroll', guardar, { passive: true })
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener('scroll', guardar)
    }
  }, [])

  useLayoutEffect(() => {
    claveActual.current = key
    posiciones.current ??= leerPosiciones()
    const objetivo = tipo === 'POP' ? (posiciones.current[key] ?? 0) : 0
    window.scrollTo(0, objetivo)
    if (!objetivo) return
    let intentos = 0
    let cuadro = requestAnimationFrame(function intentar() {
      window.scrollTo(0, objetivo)
      if (Math.abs(window.scrollY - objetivo) > 2 && ++intentos < 120) cuadro = requestAnimationFrame(intentar)
    })
    return () => cancelAnimationFrame(cuadro)
  }, [key, tipo])
}

function leerPosiciones(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_SCROLL) ?? '{}')
  } catch {
    return {}
  }
}

/**
 * Marco de la app. Escritorio (`lg`): menú lateral fijo. Móvil: barra superior
 * con la marca, barra inferior con los destinos frecuentes y "Registrar" al
 * centro, y "Más" abre el cajón con el menú completo.
 */
export function Marco({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  // El cajón y la hoja quedan abiertos solo en la ruta donde se abrieron: al navegar se cierran solos.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null)
  const [registrarEn, setRegistrarEn] = useState<string | null>(null)
  const abierto = abiertoEn === pathname
  const setAbierto = (v: boolean) => setAbiertoEn(v ? pathname : null)

  useScrollRecordado()

  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbiertoEn(null)
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [abierto])

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-borde bg-superficie lg:block">
        <Navegacion />
      </aside>

      {/* Cajón en móvil ("Más") */}
      <div className={cx('fixed inset-0 z-40 lg:hidden', !abierto && 'pointer-events-none')} aria-hidden={!abierto}>
        <div
          className={cx('absolute inset-0 bg-[var(--velo)] transition-opacity duration-200', abierto ? 'opacity-100' : 'opacity-0')}
          onClick={() => setAbierto(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className={cx(
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-borde bg-superficie pt-[env(safe-area-inset-top)] transition-transform duration-200 ease-out',
            abierto ? 'translate-x-0' : '-translate-x-full',
          )}
          inert={!abierto}
        >
          <Navegacion alElegir={() => setAbierto(false)} />
        </aside>
      </div>

      <header className="sticky top-0 z-30 flex h-[calc(3.25rem+env(safe-area-inset-top))] items-center border-b border-borde bg-fondo/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <Link to="/inicio" aria-label="Hicotea, ir a Inicio">
          <Wordmark />
        </Link>
      </header>

      {/* Pantallas de trabajo amplias (calendario, Caparazón) aprovechan monitores grandes. */}
      <main
        className={cx(
          'mx-auto w-full px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:pt-8 lg:pb-24',
          /^\/(calendario|caparazon)/.test(pathname) ? 'max-w-7xl' : 'max-w-5xl',
        )}
      >
        <TransicionPagina>{children ?? <Outlet />}</TransicionPagina>
      </main>

      <BarraInferior alRegistrar={() => setRegistrarEn(pathname)} alMas={() => setAbierto(true)} masAbierto={abierto} />
      <HojaRegistrar abierta={registrarEn === pathname} onCerrar={() => setRegistrarEn(null)} />
    </div>
  )
}
