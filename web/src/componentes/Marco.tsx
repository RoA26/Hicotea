import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { TransicionPagina } from '../animacion/TransicionPagina'
import { useTema } from '../tema/tema'
import { useSesion } from './Globales'
import { Icono, type NombreIcono } from './Iconos'
import { Wordmark } from './Marca'
import { cx } from './ui'

const MENU: { a: string; texto: string; icono: NombreIcono }[] = [
  { a: '/inicio', texto: 'Inicio', icono: 'inicio' },
  { a: '/movimientos', texto: 'Movimientos', icono: 'movimientos' },
  { a: '/calendario', texto: 'Calendario', icono: 'calendario' },
  { a: '/fuentes', texto: 'Fuentes de ingreso', icono: 'fuentes' },
  { a: '/cajitas', texto: 'Cajitas', icono: 'cajitas' },
  { a: '/metas', texto: 'Metas', icono: 'metas' },
  { a: '/presupuestos', texto: 'Presupuestos', icono: 'presupuestos' },
  { a: '/recurrentes', texto: 'Recurrentes', icono: 'recurrentes' },
  { a: '/atajos', texto: 'Botones rápidos', icono: 'atajos' },
  { a: '/categorias', texto: 'Categorías', icono: 'categorias' },
  { a: '/compartir', texto: 'Compartir', icono: 'compartir' },
]

type Tema = ReturnType<typeof useTema>

function Navegacion({ alElegir, tema: { tema, alternar } }: { alElegir?: () => void; tema: Tema }) {
  const { usuario, salir } = useSesion()
  return (
    <div className="flex h-full flex-col">
      <Link to="/inicio" onClick={alElegir} className="px-4 py-4" aria-label="Hicotea, ir a Inicio">
        <Wordmark />
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {MENU.map((m) => (
          <NavLink
            key={m.a}
            to={m.a}
            onClick={alElegir}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                isActive ? 'bg-acento/10 font-semibold text-acento' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto',
              )
            }
          >
            <Icono nombre={m.icono} />
            {m.texto}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-borde p-2">
        <button
          type="button"
          onClick={alternar}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto"
        >
          <Icono nombre={tema === 'oscuro' ? 'sol' : 'luna'} />
          {tema === 'oscuro' ? 'Tema claro' : 'Tema oscuro'}
        </button>
        <button
          type="button"
          onClick={salir}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto"
        >
          <Icono nombre="salir" />
          <span className="min-w-0 flex-1 truncate text-left">
            Cerrar sesión <span className="text-xs">· @{usuario?.nombre_usuario}</span>
          </span>
        </button>
      </div>
    </div>
  )
}

/** Marco de la app: menú lateral fijo desde `lg`, cajón deslizable en móvil. Sin barra inferior. */
export function Marco({ children }: { children?: ReactNode }) {
  const tema = useTema()
  const { pathname } = useLocation()
  // El cajón queda abierto solo en la ruta donde se abrió: al navegar se cierra solo.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null)
  const abierto = abiertoEn === pathname
  const setAbierto = (v: boolean) => setAbiertoEn(v ? pathname : null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbiertoEn(null)
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [abierto])

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-borde bg-superficie lg:block">
        <Navegacion tema={tema} />
      </aside>

      {/* Cajón en móvil */}
      <div className={cx('fixed inset-0 z-40 lg:hidden', !abierto && 'pointer-events-none')} aria-hidden={!abierto}>
        <div
          className={cx('absolute inset-0 bg-black/60 transition-opacity duration-200', abierto ? 'opacity-100' : 'opacity-0')}
          onClick={() => setAbierto(false)}
        />
        <aside
          className={cx(
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-borde bg-superficie pt-[env(safe-area-inset-top)] transition-transform duration-200 ease-out',
            abierto ? 'translate-x-0' : '-translate-x-full',
          )}
          inert={!abierto}
        >
          <Navegacion tema={tema} alElegir={() => setAbierto(false)} />
        </aside>
      </div>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-borde bg-fondo/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="grid size-11 place-items-center rounded-xl text-texto-suave hover:text-texto"
        >
          <Icono nombre="menu" className="size-6" />
        </button>
        <Link to="/inicio" className="py-2" aria-label="Hicotea, ir a Inicio">
          <Wordmark />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-24 sm:px-6 lg:pt-8">
        <TransicionPagina>{children ?? <Outlet />}</TransicionPagina>
      </main>
    </div>
  )
}
