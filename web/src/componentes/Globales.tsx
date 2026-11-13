import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { auth, EVENTO_SESION_VENCIDA, type Usuario } from '../api/cliente'
import type { Saldo } from '../api/tipos'
import { Modal } from './Modal'
import { Boton, cx } from './ui'

// ------------------------------------------------------------------ sesión

type Sesion = {
  usuario: Usuario | null | undefined // undefined = todavía comprobando
  setUsuario: (u: Usuario | null) => void
  salir: () => Promise<void>
}

const CtxSesion = createContext<Sesion | null>(null)

/** La caché offline guarda datos de la cuenta: no debe sobrevivir al cierre de sesión. */
async function borrarCacheApi() {
  try {
    if ('caches' in window) await caches.delete('hicotea-api')
  } catch {
    /* sin Cache API */
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined)

  useEffect(() => {
    auth.yo().then(setUsuario, () => setUsuario(null))
    const vencida = () => {
      void borrarCacheApi()
      setUsuario(null)
    }
    window.addEventListener(EVENTO_SESION_VENCIDA, vencida)
    return () => window.removeEventListener(EVENTO_SESION_VENCIDA, vencida)
  }, [])

  const salir = useCallback(async () => {
    await auth.logout().catch(() => undefined)
    await borrarCacheApi()
    setUsuario(null)
  }, [])

  return <CtxSesion.Provider value={{ usuario, setUsuario, salir }}>{children}</CtxSesion.Provider>
}

export function useSesion() {
  const c = useContext(CtxSesion)
  if (!c) throw new Error('useSesion fuera de ProveedorSesion')
  return c
}

// ------------------------------------------------------------------ saldo compartido

/** Último saldo conocido: los registros rápidos lo actualizan y el tablero lo anima. */
type CtxSaldoT = { saldo: Saldo | null; setSaldo: (s: Saldo | null) => void; version: number; avisarCambio: () => void }
const CtxSaldo = createContext<CtxSaldoT | null>(null)

export function ProveedorSaldo({ children }: { children: ReactNode }) {
  const [saldo, setSaldo] = useState<Saldo | null>(null)
  const [version, setVersion] = useState(0)
  const avisarCambio = useCallback(() => setVersion((v) => v + 1), [])
  return <CtxSaldo.Provider value={{ saldo, setSaldo, version, avisarCambio }}>{children}</CtxSaldo.Provider>
}

export function useSaldo() {
  const c = useContext(CtxSaldo)
  if (!c) throw new Error('useSaldo fuera de ProveedorSaldo')
  return c
}

// ------------------------------------------------------------------ confirmación global

type OpcionesConfirmar = { titulo: string; mensaje?: ReactNode; aceptar?: string; peligro?: boolean }
type Pendiente = OpcionesConfirmar & { resolver: (ok: boolean) => void }

const CtxConfirmar = createContext<((o: OpcionesConfirmar) => Promise<boolean>) | null>(null)

export function ProveedorConfirmar({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)
  const confirmar = useCallback(
    (o: OpcionesConfirmar) => new Promise<boolean>((resolver) => setPendiente({ ...o, resolver })),
    [],
  )
  const responder = (ok: boolean) => {
    pendiente?.resolver(ok)
    setPendiente(null)
  }
  return (
    <CtxConfirmar.Provider value={confirmar}>
      {children}
      <Modal abierto={!!pendiente} onCerrar={() => responder(false)} titulo={pendiente?.titulo ?? ''}>
        {pendiente?.mensaje && <div className="mb-5 text-sm text-texto-suave">{pendiente.mensaje}</div>}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => responder(false)}>
            Cancelar
          </Boton>
          <Boton variante={pendiente?.peligro ? 'peligro' : 'primario'} onClick={() => responder(true)}>
            {pendiente?.aceptar ?? 'Aceptar'}
          </Boton>
        </div>
      </Modal>
    </CtxConfirmar.Provider>
  )
}

export function useConfirmar() {
  const c = useContext(CtxConfirmar)
  if (!c) throw new Error('useConfirmar fuera de ProveedorConfirmar')
  return c
}

// ------------------------------------------------------------------ avisos (toasts)

type Aviso = {
  id: number
  texto: string
  tono: 'exito' | 'error'
  accion?: { etiqueta: string; hacer: () => void | Promise<void> }
}
type Avisar = (texto: string, o?: { tono?: Aviso['tono']; accion?: Aviso['accion'] }) => void

const CtxAvisos = createContext<Avisar | null>(null)
const DURACION = 6000

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const sig = useRef(0)

  const quitar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), [])

  const avisar = useCallback<Avisar>(
    (texto, o = {}) => {
      const id = ++sig.current
      setAvisos((a) => [...a.slice(-2), { id, texto, tono: o.tono ?? 'exito', accion: o.accion }])
      window.setTimeout(() => quitar(id), DURACION)
    },
    [quitar],
  )

  return (
    <CtxAvisos.Provider value={avisar}>
      {children}
      {createPortal(
        // Arriba en móvil (los modales suben desde abajo y quedarían tapados); abajo desde `sm`.
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:top-auto sm:bottom-0 sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {avisos.map((a) => (
            <div
              key={a.id}
              role={a.tono === 'error' ? 'alert' : 'status'}
              className={cx(
                'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-tarjeta border px-4 py-3 text-sm shadow-xl',
                'bg-superficie',
                a.tono === 'error' ? 'border-gasto/40 text-gasto' : 'border-borde text-texto',
              )}
            >
              <span className="min-w-0 flex-1">{a.texto}</span>
              {a.accion && (
                <button
                  type="button"
                  className="shrink-0 font-semibold text-acento hover:underline"
                  onClick={async () => {
                    quitar(a.id)
                    await a.accion!.hacer()
                  }}
                >
                  {a.accion.etiqueta}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </CtxAvisos.Provider>
  )
}

export function useAvisar() {
  const c = useContext(CtxAvisos)
  if (!c) throw new Error('useAvisar fuera de ProveedorAvisos')
  return c
}
