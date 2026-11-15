import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useSearchParams } from 'react-router'
import { TransicionPagina } from '../../animacion/TransicionPagina'
import { admin } from '../../api/cliente'
import type { CuentaAdmin, EstadoInvitacion, EventoAuditoria, InvitacionAdmin, InvitacionCreada, Pagina } from '../../api/tipos'
import { useAvisar, useConfirmar, useSesion } from '../../componentes/Globales'
import { Icono, type NombreIcono } from '../../componentes/Iconos'
import { Wordmark } from '../../componentes/Marca'
import { Modal } from '../../componentes/Modal'
import {
  AlertaError,
  Boton,
  Campo,
  Cargando,
  cx,
  Encabezado,
  Entrada,
  ErrorCarga,
  Insignia,
  Selector,
  Seccion,
  Tarjeta,
  Vacio,
} from '../../componentes/ui'
import { useDatos, useEnvio } from '../../lib/datos'
import { fechaHora } from '../../lib/formato'

/*
 * Panel de administración de la plataforma. Separado de la experiencia
 * financiera: su propio marco, sin acceso a montos de nadie. Ocultar o
 * mostrar cosas aquí es solo comodidad; la autorización real está en la API
 * (cada /api/admin/* responde 403 a quien no es administrador).
 */

const SECCIONES: { a: string; texto: string; icono: NombreIcono }[] = [
  { a: '/admin', texto: 'Resumen', icono: 'inicio' },
  { a: '/admin/usuarios', texto: 'Usuarios', icono: 'usuarios' },
  { a: '/admin/invitaciones', texto: 'Invitaciones', icono: 'sobre' },
  { a: '/admin/auditoria', texto: 'Auditoría', icono: 'historial' },
]

const ACCIONES: Record<string, string> = {
  BLOQUEAR_CUENTA: 'Bloqueó una cuenta',
  DESBLOQUEAR_CUENTA: 'Desbloqueó una cuenta',
  CERRAR_SESIONES: 'Cerró las sesiones',
  CREAR_INVITACION: 'Creó una invitación',
  REVOCAR_INVITACION: 'Revocó una invitación',
  OTORGAR_ADMIN: 'Otorgó rol de administrador',
  REVOCAR_ADMIN: 'Quitó rol de administrador',
}

const ESTADO_INVITACION: Record<EstadoInvitacion, { texto: string; tono: 'acento' | 'suave' | 'aviso' | 'gasto' }> = {
  PENDIENTE: { texto: 'Pendiente', tono: 'acento' },
  USADA: { texto: 'Usada', tono: 'suave' },
  EXPIRADA: { texto: 'Vencida', tono: 'aviso' },
  REVOCADA: { texto: 'Revocada', tono: 'gasto' },
}

// ------------------------------------------------------------------ marco

function MarcoAdmin({ children }: { children: ReactNode }) {
  const { usuario, salir } = useSesion()
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-borde bg-fondo/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
          <Link to="/admin" aria-label="Administración de Hicotea" className="flex items-center gap-2">
            <Wordmark />
            <span className="hidden min-[360px]:inline-flex">
              <Insignia tono="acento">Admin</Insignia>
            </span>
          </Link>
          <span className="flex-1" />
          <Link to="/inicio" className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm text-texto-suave hover:text-texto">
            <Icono nombre="izquierda" className="size-4" />
            <span className="hidden sm:inline">Mis finanzas</span>
            <span className="sm:hidden">Finanzas</span>
          </Link>
          <button type="button" onClick={salir} aria-label={`Cerrar sesión (@${usuario?.nombre_usuario})`} className="grid size-11 place-items-center rounded-control text-texto-suave hover:text-texto">
            <Icono nombre="salir" />
          </button>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto max-w-6xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex min-w-max gap-1">
            {SECCIONES.map((s) => (
              <li key={s.a}>
                <NavLink
                  to={s.a}
                  end={s.a === '/admin'}
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors',
                      isActive ? 'border-acento font-semibold text-acento' : 'border-transparent text-texto-suave hover:text-texto',
                    )
                  }
                >
                  <Icono nombre={s.icono} className="size-4" />
                  {s.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6">
        <TransicionPagina>{children}</TransicionPagina>
      </main>
    </div>
  )
}

function Paginador<T>({ p, alCambiar }: { p: Pagina<T>; alCambiar: (n: number) => void }) {
  if (!p.hay_anterior && !p.hay_siguiente) return <p className="mt-3 text-sm text-texto-suave">{p.total} en total</p>
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-texto-suave sm:flex-row sm:items-center sm:justify-between">
      <span>
        {p.total} en total · página {p.pagina + 1}
      </span>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Boton variante="secundario" className="sm:h-9 sm:text-sm" disabled={!p.hay_anterior} onClick={() => alCambiar(p.pagina - 1)}>
          <Icono nombre="izquierda" className="size-4" /> Anterior
        </Boton>
        <Boton variante="secundario" className="sm:h-9 sm:text-sm" disabled={!p.hay_siguiente} onClick={() => alCambiar(p.pagina + 1)}>
          Siguiente <Icono nombre="derecha" className="size-4" />
        </Boton>
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono?: 'aviso' | 'gasto' }) {
  return (
    <div className="min-w-0 rounded-tarjeta border border-borde bg-superficie px-4 py-3">
      <dt className="truncate text-xs text-texto-suave">{etiqueta}</dt>
      <dd className={cx('cifra text-2xl font-bold', tono === 'aviso' && valor > 0 && 'text-aviso', tono === 'gasto' && valor > 0 && 'text-gasto')}>{valor}</dd>
    </div>
  )
}

function ListaAuditoria({ eventos }: { eventos: EventoAuditoria[] }) {
  return (
    <ul className="divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
      {eventos.map((e) => (
        <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {ACCIONES[e.accion] ?? e.accion}
              {e.recurso_nombre && <span className="font-normal text-texto-suave"> · {e.recurso_nombre}</span>}
            </p>
            <p className="text-xs text-texto-suave">
              @{e.admin_nombre} · {fechaHora(e.fecha)}
              {e.detalle && ` · ${e.detalle}`}
            </p>
          </div>
          {e.resultado === 'RECHAZADO' && <Insignia tono="aviso">Rechazada</Insignia>}
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------ resumen

function Resumen() {
  const r = useDatos(admin.resumen)
  if (r.error && !r.datos) return <ErrorCarga error={r.error} reintentar={r.recargar} />
  if (!r.datos) return <Cargando />
  const { cuentas, invitaciones, actividad_reciente } = r.datos
  return (
    <>
      <Encabezado titulo="Administración" subtitulo="Cuentas e invitaciones de la plataforma. Aquí no se ven las finanzas de nadie." />
      <Seccion titulo="Cuentas">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato etiqueta="Registradas" valor={cuentas.total} />
          <Dato etiqueta="Habilitadas" valor={cuentas.activas} />
          <Dato etiqueta="Bloqueadas" valor={cuentas.bloqueadas} tono="gasto" />
          <Dato etiqueta="Administradores" valor={cuentas.administradores} />
        </dl>
      </Seccion>
      <Seccion titulo="Invitaciones" acciones={<Link to="/admin/invitaciones" className="-my-3 inline-flex min-h-11 items-center text-sm text-acento hover:underline">Gestionar</Link>}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato etiqueta="Pendientes" valor={invitaciones.PENDIENTE} />
          <Dato etiqueta="Usadas" valor={invitaciones.USADA} />
          <Dato etiqueta="Vencidas" valor={invitaciones.EXPIRADA} tono="aviso" />
          <Dato etiqueta="Revocadas" valor={invitaciones.REVOCADA} />
        </dl>
      </Seccion>
      <Seccion titulo="Actividad reciente" acciones={<Link to="/admin/auditoria" className="-my-3 inline-flex min-h-11 items-center text-sm text-acento hover:underline">Ver todo</Link>}>
        {actividad_reciente.length ? <ListaAuditoria eventos={actividad_reciente} /> : <Vacio>Todavía no hay acciones administrativas.</Vacio>}
      </Seccion>
    </>
  )
}

// ------------------------------------------------------------------ usuarios

function EstadoCuenta({ c }: { c: CuentaAdmin }) {
  return (
    <span className="flex flex-wrap gap-1">
      {c.activo ? <Insignia tono="acento">Habilitada</Insignia> : <Insignia tono="gasto">Bloqueada</Insignia>}
      {c.rol === 'ADMIN' && <Insignia>Admin</Insignia>}
    </span>
  )
}

function Usuarios() {
  const { usuario } = useSesion()
  const confirmar = useConfirmar()
  const avisar = useAvisar()
  const [q, setQ] = useSearchParams()
  const filtro = {
    q: q.get('q') ?? '',
    estado: (q.get('estado') as 'ACTIVA' | 'BLOQUEADA' | null) ?? undefined,
    pagina: Number(q.get('pagina') ?? 0) || 0,
  }
  const [texto, setTexto] = useState(filtro.q)
  const lista = useDatos(() => admin.usuarios({ q: filtro.q || undefined, estado: filtro.estado, pagina: filtro.pagina }), [q.toString()])
  const [ocupado, setOcupado] = useState<number | null>(null)

  const poner = (c: Partial<typeof filtro>) => {
    const s = new URLSearchParams()
    const n = { ...filtro, pagina: 0, ...c }
    if (n.q) s.set('q', n.q)
    if (n.estado) s.set('estado', n.estado)
    if (n.pagina) s.set('pagina', String(n.pagina))
    setQ(s, { replace: true })
  }

  async function accion(c: CuentaAdmin, tipo: 'bloquear' | 'desbloquear' | 'sesiones') {
    const textos = {
      bloquear: {
        titulo: `Bloquear a @${c.nombre_usuario}`,
        mensaje: 'No podrá entrar y se cerrarán todas sus sesiones abiertas. Sus datos se conservan intactos y puedes desbloquearla después.',
        aceptar: 'Bloquear',
        peligro: true,
      },
      desbloquear: { titulo: `Desbloquear a @${c.nombre_usuario}`, mensaje: 'Podrá volver a iniciar sesión con su contraseña.', aceptar: 'Desbloquear', peligro: false },
      sesiones: {
        titulo: `Cerrar las sesiones de @${c.nombre_usuario}`,
        mensaje: `Se cerrarán ${c.sesiones_activas} ${c.sesiones_activas === 1 ? 'sesión' : 'sesiones'} en todos sus dispositivos. La cuenta sigue habilitada.`,
        aceptar: 'Cerrar sesiones',
        peligro: true,
      },
    }[tipo]
    if (!(await confirmar(textos))) return
    setOcupado(c.id)
    try {
      if (tipo === 'bloquear') await admin.bloquear(c.id)
      else if (tipo === 'desbloquear') await admin.desbloquear(c.id)
      else await admin.cerrarSesiones(c.id)
      avisar(tipo === 'bloquear' ? 'Cuenta bloqueada.' : tipo === 'desbloquear' ? 'Cuenta desbloqueada.' : 'Sesiones cerradas.')
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    } finally {
      setOcupado(null)
    }
  }

  function buscar(e: FormEvent) {
    e.preventDefault()
    poner({ q: texto.trim() })
  }

  return (
    <>
      <Encabezado titulo="Usuarios" subtitulo="Información básica de cuenta. Las contraseñas y las finanzas no son visibles." />
      <form onSubmit={buscar} role="search" className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Campo etiqueta="Buscar">
          <Entrada type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Usuario, nombre o correo" maxLength={60} enterKeyHint="search" />
        </Campo>
        <Campo etiqueta="Estado">
          <Selector value={filtro.estado ?? ''} onChange={(e) => poner({ q: texto.trim(), estado: (e.target.value as 'ACTIVA' | 'BLOQUEADA') || undefined })}>
            <option value="">Todas</option>
            <option value="ACTIVA">Habilitadas</option>
            <option value="BLOQUEADA">Bloqueadas</option>
          </Selector>
        </Campo>
        <Boton type="submit" variante="secundario">
          Buscar
        </Boton>
      </form>

      {lista.error && !lista.datos ? (
        <ErrorCarga error={lista.error} reintentar={lista.recargar} />
      ) : !lista.datos ? (
        <Cargando />
      ) : lista.datos.elementos.length === 0 ? (
        <Vacio>No hay cuentas con esos filtros.</Vacio>
      ) : (
        <>
          {/* Tarjetas en celular y tableta; tabla desde lg. */}
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {lista.datos.elementos.map((c) => (
              <li key={c.id}>
                <Tarjeta>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">@{c.nombre_usuario}</p>
                      <p className="truncate text-sm text-texto-suave">{c.nombre_completo}</p>
                      {c.correo && <p className="truncate text-xs text-texto-suave">{c.correo}{!c.correo_verificado && ' (sin verificar)'}</p>}
                    </div>
                    <EstadoCuenta c={c} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-texto-suave">Registro</dt>
                      <dd>{fechaHora(c.fecha_registro)}</dd>
                    </div>
                    <div>
                      <dt className="text-texto-suave">Último ingreso</dt>
                      <dd>{fechaHora(c.ultimo_ingreso_en)}</dd>
                    </div>
                    <div>
                      <dt className="text-texto-suave">Sesiones abiertas</dt>
                      <dd className="cifra">{c.sesiones_activas}</dd>
                    </div>
                  </dl>
                  <Acciones c={c} propia={c.id === usuario?.id} ocupado={ocupado === c.id} alHacer={accion} />
                </Tarjeta>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-tarjeta border border-borde bg-superficie lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Cuentas registradas</caption>
              <thead className="border-b border-borde text-left text-xs text-texto-suave">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Cuenta</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Registro</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Último ingreso</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Sesiones</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {lista.datos.elementos.map((c) => (
                  <tr key={c.id}>
                    <td className="max-w-64 px-4 py-3">
                      <p className="truncate font-medium">@{c.nombre_usuario}</p>
                      <p className="truncate text-xs text-texto-suave">
                        {c.nombre_completo}
                        {c.correo && ` · ${c.correo}${c.correo_verificado ? '' : ' (sin verificar)'}`}
                      </p>
                    </td>
                    <td className="px-4 py-3"><EstadoCuenta c={c} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-texto-suave">{fechaHora(c.fecha_registro)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-texto-suave">{fechaHora(c.ultimo_ingreso_en)}</td>
                    <td className="cifra px-4 py-3 text-right">{c.sesiones_activas}</td>
                    <td className="px-4 py-3">
                      <Acciones c={c} propia={c.id === usuario?.id} ocupado={ocupado === c.id} alHacer={accion} compacto />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginador p={lista.datos} alCambiar={(n) => poner({ q: filtro.q, estado: filtro.estado, pagina: n })} />
        </>
      )}
    </>
  )
}

function Acciones({
  c,
  propia,
  ocupado,
  alHacer,
  compacto,
}: {
  c: CuentaAdmin
  propia: boolean
  ocupado: boolean
  alHacer: (c: CuentaAdmin, tipo: 'bloquear' | 'desbloquear' | 'sesiones') => void
  compacto?: boolean
}) {
  if (propia) return <p className={cx('text-xs text-texto-suave', !compacto && 'mt-3')}>Es tu cuenta</p>
  const clase = compacto ? 'sm:h-9 sm:px-3 sm:text-sm' : 'flex-1'
  return (
    <div className={cx('flex flex-wrap gap-2', compacto ? 'justify-end' : 'mt-3 border-t border-borde pt-3')}>
      {c.activo && c.sesiones_activas > 0 && (
        <Boton variante="secundario" className={clase} disabled={ocupado} onClick={() => alHacer(c, 'sesiones')}>
          Cerrar sesiones
        </Boton>
      )}
      {c.activo ? (
        <Boton variante="peligro" className={clase} cargando={ocupado} onClick={() => alHacer(c, 'bloquear')}>
          Bloquear
        </Boton>
      ) : (
        <Boton variante="secundario" className={clase} cargando={ocupado} onClick={() => alHacer(c, 'desbloquear')}>
          Desbloquear
        </Boton>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ invitaciones

function NuevaInvitacion({ alCrear }: { alCrear: (i: InvitacionCreada) => void }) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState({ dias: '7', correo: '', nota: '' })
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => admin.crearInvitacion({ dias: Number(f.dias), correo: f.correo.trim() || null, nota: f.nota.trim() || null }))
    if (r) alCrear(r)
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="Vence en" error={errores.dias}>
        <Selector value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value })}>
          {[1, 3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? 'día' : 'días'}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Para (nota, opcional)" error={errores.nota} ayuda="Solo para recordar a quién se la diste.">
        <Entrada value={f.nota} maxLength={100} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="Ej.: Prima Laura" />
      </Campo>
      <Campo etiqueta="Correo (opcional)" error={errores.correo} ayuda="Si lo pones, solo se podrá usar con ese correo.">
        <Entrada type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={f.correo} maxLength={254} onChange={(e) => setF({ ...f, correo: e.target.value })} />
      </Campo>
      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
        Crear invitación
      </Boton>
    </form>
  )
}

function EnlaceCreado({ inv, alCerrar }: { inv: InvitacionCreada; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(inv.enlace)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-texto-suave">
        Comparte este enlace por un canal privado. <strong className="text-texto">No se vuelve a mostrar</strong>: si lo pierdes, revoca esta
        invitación y crea otra. Sirve una sola vez y vence el {fechaHora(inv.expira_en)}.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-texto-suave">Enlace de invitación</span>
        <Entrada readOnly value={inv.enlace} onFocus={(e) => e.currentTarget.select()} className="cifra text-sm" />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" onClick={alCerrar}>
          Listo
        </Boton>
        <Boton onClick={copiar}>
          <Icono nombre="copiar" className="size-4" /> {copiado ? '¡Copiado!' : 'Copiar enlace'}
        </Boton>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {copiado ? 'Enlace copiado al portapapeles' : ''}
      </p>
    </div>
  )
}

function Invitaciones() {
  const confirmar = useConfirmar()
  const avisar = useAvisar()
  const [estado, setEstado] = useState<EstadoInvitacion | ''>('')
  const [pagina, setPagina] = useState(0)
  const lista = useDatos(() => admin.invitaciones({ estado: estado || undefined, pagina }), [estado, pagina])
  const [creando, setCreando] = useState(false)
  const [creada, setCreada] = useState<InvitacionCreada | null>(null)

  async function revocar(i: InvitacionAdmin) {
    const ok = await confirmar({
      titulo: 'Revocar invitación',
      mensaje: `El enlace${i.nota ? ` de «${i.nota}»` : ''} dejará de funcionar. No se puede deshacer.`,
      aceptar: 'Revocar',
      peligro: true,
    })
    if (!ok) return
    try {
      await admin.revocarInvitacion(i.id)
      avisar('Invitación revocada.')
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <>
      <Encabezado
        titulo="Invitaciones"
        subtitulo="Cada invitación sirve una sola vez. El enlace solo se ve al crearla."
        acciones={
          <Boton onClick={() => setCreando(true)}>
            <Icono nombre="mas" /> Nueva invitación
          </Boton>
        }
      />
      <div className="mb-4 max-w-xs">
        <Campo etiqueta="Estado">
          <Selector
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoInvitacion | '')
              setPagina(0)
            }}
          >
            <option value="">Todas</option>
            {(Object.keys(ESTADO_INVITACION) as EstadoInvitacion[]).map((k) => (
              <option key={k} value={k}>
                {ESTADO_INVITACION[k].texto}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
      {lista.error && !lista.datos ? (
        <ErrorCarga error={lista.error} reintentar={lista.recargar} />
      ) : !lista.datos ? (
        <Cargando />
      ) : lista.datos.elementos.length === 0 ? (
        <Vacio accion={<Boton onClick={() => setCreando(true)}>Crear la primera</Boton>}>No hay invitaciones{estado ? ' con ese estado' : ''}.</Vacio>
      ) : (
        <>
          <ul className="divide-y divide-borde rounded-tarjeta border border-borde bg-superficie">
            {lista.datos.elementos.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{i.nota ?? i.correo ?? `Invitación #${i.id}`}</span>
                    <Insignia tono={ESTADO_INVITACION[i.estado].tono}>{ESTADO_INVITACION[i.estado].texto}</Insignia>
                  </p>
                  <p className="mt-0.5 text-xs text-texto-suave">
                    {i.correo && i.nota && `${i.correo} · `}
                    Creada {fechaHora(i.creada_en)}
                    {i.creada_por ? ` por @${i.creada_por}` : ' desde la consola'}
                    {' · '}
                    {i.estado === 'USADA' && `usada ${fechaHora(i.usada_en)}${i.usada_por ? ` por @${i.usada_por}` : ''}`}
                    {i.estado === 'REVOCADA' && `revocada ${fechaHora(i.revocada_en)}`}
                    {(i.estado === 'PENDIENTE' || i.estado === 'EXPIRADA') && `${i.estado === 'PENDIENTE' ? 'vence' : 'venció'} ${fechaHora(i.expira_en)}`}
                  </p>
                </div>
                {i.estado === 'PENDIENTE' && (
                  <Boton variante="peligro" className="sm:h-9 sm:px-3 sm:text-sm" onClick={() => revocar(i)}>
                    Revocar
                  </Boton>
                )}
              </li>
            ))}
          </ul>
          <Paginador p={lista.datos} alCambiar={setPagina} />
        </>
      )}

      <Modal abierto={creando} onCerrar={() => setCreando(false)} titulo="Nueva invitación">
        {creando && (
          <NuevaInvitacion
            alCrear={(i) => {
              setCreando(false)
              setCreada(i)
              setEstado('')
              setPagina(0)
              void lista.recargar()
            }}
          />
        )}
      </Modal>
      <Modal abierto={!!creada} onCerrar={() => setCreada(null)} titulo="Invitación creada">
        {creada && <EnlaceCreado inv={creada} alCerrar={() => setCreada(null)} />}
      </Modal>
    </>
  )
}

// ------------------------------------------------------------------ auditoría

function Auditoria() {
  const [pagina, setPagina] = useState(0)
  const lista = useDatos(() => admin.auditoria(pagina), [pagina])
  return (
    <>
      <Encabezado titulo="Auditoría" subtitulo="Acciones administrativas: quién, qué, sobre qué recurso, cuándo y con qué resultado." />
      {lista.error && !lista.datos ? (
        <ErrorCarga error={lista.error} reintentar={lista.recargar} />
      ) : !lista.datos ? (
        <Cargando />
      ) : lista.datos.elementos.length === 0 ? (
        <Vacio>Todavía no hay acciones administrativas.</Vacio>
      ) : (
        <>
          <ListaAuditoria eventos={lista.datos.elementos} />
          <Paginador p={lista.datos} alCambiar={setPagina} />
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ entrada

export default function PanelAdmin() {
  const { usuario } = useSesion()
  // Comodidad, no seguridad: la API responde 403 igual.
  if (usuario?.rol !== 'ADMIN') return <Navigate to="/inicio" replace />
  return (
    <MarcoAdmin>
      <Routes>
        <Route index element={<Resumen />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="invitaciones" element={<Invitaciones />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </MarcoAdmin>
  )
}
