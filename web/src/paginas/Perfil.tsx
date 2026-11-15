import { useState, type FormEvent, type ReactNode } from 'react'
import { cuenta } from '../api/cliente'
import type { Perfil as TPerfil } from '../api/tipos'
import { AjustesApariencia } from '../componentes/AjustesApariencia'
import { useAvisar, useConfirmar, useSesion } from '../componentes/Globales'
import { Modal } from '../componentes/Modal'
import { AlertaError, Boton, Campo, Cargando, cx, Encabezado, Entrada, ErrorCarga, Insignia, Seccion, Tarjeta } from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import { fechaHora } from '../lib/formato'

/**
 * Perfil: cuenta, correo, seguridad y apariencia. Cada acción sensible abre su
 * propio formulario corto (modal) en vez de una página larga; la API vuelve a
 * pedir la contraseña actual para el correo y la contraseña.
 */
export default function Perfil() {
  const p = useDatos(cuenta.ver)
  const { setUsuario, usuario } = useSesion()

  /** Refresca el perfil y el usuario de la sesión (nombre y correo se ven en el menú). */
  function actualizado(nuevo?: TPerfil) {
    if (nuevo && usuario) setUsuario({ ...usuario, nombre_completo: nuevo.nombre_completo, correo: nuevo.correo, correo_verificado: nuevo.correo_verificado })
    void p.recargar()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Encabezado titulo="Perfil" subtitulo={usuario ? `@${usuario.nombre_usuario}` : undefined} />
      {p.error && !p.datos ? (
        <ErrorCarga error={p.error} reintentar={p.recargar} />
      ) : !p.datos ? (
        <Cargando />
      ) : (
        <>
          <SeccionCuenta p={p.datos} alCambiar={actualizado} />
          <SeccionCorreo p={p.datos} alCambiar={() => actualizado()} />
          <SeccionSeguridad p={p.datos} alCambiar={() => actualizado()} />
          <Seccion titulo="Apariencia">
            <Tarjeta>
              <AjustesApariencia />
              <p className="mt-4 text-xs text-texto-suave">Se guarda en este dispositivo. En otro celular o navegador puedes elegir otra.</p>
            </Tarjeta>
          </Seccion>
        </>
      )}
    </div>
  )
}

/** Fila de dato: etiqueta, valor y una acción opcional, sin tarjetas anidadas. */
function Fila({ etiqueta, children, accion }: { etiqueta: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-texto-suave">{etiqueta}</p>
        <div className="mt-0.5 min-w-0 break-words">{children}</div>
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  )
}

// ====================================================================== cuenta

function SeccionCuenta({ p, alCambiar }: { p: TPerfil; alCambiar: (n: TPerfil) => void }) {
  const [editando, setEditando] = useState(false)
  return (
    <Seccion titulo="Tu cuenta">
      <Tarjeta className="divide-y divide-borde">
        <Fila
          etiqueta="Nombre"
          accion={
            <Boton chico variante="secundario" onClick={() => setEditando(true)}>
              Editar
            </Boton>
          }
        >
          <p className="font-medium">{p.nombre_completo}</p>
        </Fila>
        <Fila etiqueta="Usuario">
          <p className="font-medium">@{p.nombre_usuario}</p>
          <p className="text-xs text-texto-suave">Con él inicias sesión. No se puede cambiar.</p>
        </Fila>
        <Fila etiqueta="En Hicotea desde">
          <p>{fechaHora(p.fecha_registro)}</p>
        </Fila>
      </Tarjeta>
      <Modal abierto={editando} onCerrar={() => setEditando(false)} titulo="Tu nombre">
        {editando && (
          <FormNombre
            actual={p.nombre_completo}
            alTerminar={(n) => {
              setEditando(false)
              alCambiar(n)
            }}
            alCancelar={() => setEditando(false)}
          />
        )}
      </Modal>
    </Seccion>
  )
}

function FormNombre({ actual, alTerminar, alCancelar }: { actual: string; alTerminar: (n: TPerfil) => void; alCancelar: () => void }) {
  const [nombre, setNombre] = useState(actual)
  const { enviando, error, errores, enviar } = useEnvio()
  const avisar = useAvisar()
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => cuenta.actualizar({ nombre_completo: nombre }))
    if (r) {
      avisar('Nombre actualizado.')
      alTerminar(r)
    }
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="Nombre completo" error={errores.nombre_completo}>
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={100} required autoFocus />
      </Campo>
      <AlertaError mensaje={errores.nombre_completo ? null : error} />
      <Botones enviando={enviando} alCancelar={alCancelar} texto="Guardar" />
    </form>
  )
}

// ====================================================================== correo

function SeccionCorreo({ p, alCambiar }: { p: TPerfil; alCambiar: () => void }) {
  const [form, setForm] = useState<null | { correo: string; titulo: string }>(null)
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  // Enlace pendiente para la misma dirección actual (p. ej. la del registro): es "verificar", no "cambiar".
  const pendienteEsActual = !!p.correo_pendiente && p.correo_pendiente === p.correo
  const pendienteNuevo = p.correo_pendiente && !pendienteEsActual ? p.correo_pendiente : null

  async function cancelar() {
    if (!(await confirmar({ titulo: 'Cancelar el cambio de correo', mensaje: `El enlace enviado a ${p.correo_pendiente} dejará de servir.`, aceptar: 'Cancelar cambio' })))
      return
    try {
      await cuenta.cancelarCorreo()
      avisar('Cambio de correo cancelado.')
      alCambiar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <Seccion titulo="Correo">
      <Tarjeta className="divide-y divide-borde">
        <Fila
          etiqueta="Correo de la cuenta"
          accion={
            // Con una dirección pendiente y sin correo actual, "Reenviar" ya permite corregirla.
            p.correo_disponible &&
            !(pendienteNuevo && !p.correo) && (
              <Boton chico variante="secundario" onClick={() => setForm({ correo: '', titulo: p.correo ? 'Cambiar correo' : 'Agregar correo' })}>
                {p.correo ? 'Cambiar' : 'Agregar'}
              </Boton>
            )
          }
        >
          {p.correo ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 font-medium break-all">{p.correo}</span>
              {p.correo_verificado ? <Insignia tono="acento">Verificado</Insignia> : <Insignia tono="aviso">Sin verificar</Insignia>}
            </div>
          ) : (
            <p className="text-texto-suave">Sin correo</p>
          )}
          <p className="mt-1 text-xs text-texto-suave">
            {p.correo_verificado
              ? 'Si olvidas tu contraseña, el PIN para recuperarla llega a este correo.'
              : p.correo
                ? 'Mientras no lo verifiques, el PIN de recuperación no llega aquí: te lo entrega quien administra Hicotea.'
                : 'Agrégalo para recibir el PIN si olvidas tu contraseña. Es opcional.'}
          </p>
          {p.correo && !p.correo_verificado && p.correo_disponible && (
            <Boton chico className="mt-2" onClick={() => setForm({ correo: p.correo ?? '', titulo: 'Verificar correo' })}>
              {pendienteEsActual ? 'Enviar otro enlace' : 'Verificar ahora'}
            </Boton>
          )}
        </Fila>

        {pendienteNuevo && (
          // Las acciones van debajo: un correo largo no debe partirse para dejarles sitio.
          <Fila etiqueta="Esperando verificación">
            <p className="font-medium break-all">{pendienteNuevo}</p>
            <p className="text-xs text-texto-suave">
              Abre el enlace que te enviamos{p.correo_pendiente_expira_en ? ` antes del ${fechaHora(p.correo_pendiente_expira_en)}` : ''}.
              {p.correo ? ' Hasta entonces sigues usando el correo actual.' : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Boton chico variante="secundario" onClick={() => setForm({ correo: pendienteNuevo, titulo: 'Enviar otro enlace' })}>
                Reenviar o corregir
              </Boton>
              <Boton chico variante="fantasma" onClick={cancelar}>
                Cancelar
              </Boton>
            </div>
          </Fila>
        )}

        {!p.correo_disponible && (
          <Fila etiqueta="Envío de correos">
            <p className="text-sm text-texto-suave">Este servidor todavía no puede enviar correos, así que por ahora no se pueden agregar ni verificar direcciones.</p>
          </Fila>
        )}
      </Tarjeta>

      <Modal abierto={!!form} onCerrar={() => setForm(null)} titulo={form?.titulo ?? ''}>
        {form && (
          <FormCorreo
            inicial={form.correo}
            alTerminar={(mensaje) => {
              setForm(null)
              avisar(mensaje)
              alCambiar()
            }}
            alCancelar={() => setForm(null)}
          />
        )}
      </Modal>
    </Seccion>
  )
}

function FormCorreo({ inicial, alTerminar, alCancelar }: { inicial: string; alTerminar: (mensaje: string) => void; alCancelar: () => void }) {
  const [f, setF] = useState({ correo: inicial, contrasena_actual: '' })
  const { enviando, error, errores, enviar } = useEnvio()
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => cuenta.pedirCorreo(f))
    if (r) alTerminar(r.mensaje)
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <p className="text-sm text-texto-suave">Te enviaremos un enlace a esa dirección. Solo cuenta como tu correo cuando lo abras.</p>
      <Campo etiqueta="Correo" error={errores.correo}>
        <Entrada
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          value={f.correo}
          onChange={(e) => setF({ ...f, correo: e.target.value })}
          required
          autoFocus={!inicial}
        />
      </Campo>
      <CampoContrasenaActual valor={f.contrasena_actual} error={errores.contrasena_actual} alCambiar={(v) => setF({ ...f, contrasena_actual: v })} enfocar={!!inicial} />
      <AlertaError mensaje={errores.correo || errores.contrasena_actual ? null : error} />
      <Botones enviando={enviando} alCancelar={alCancelar} texto="Enviar enlace" />
    </form>
  )
}

// ====================================================================== seguridad

function SeccionSeguridad({ p, alCambiar }: { p: TPerfil; alCambiar: () => void }) {
  const [cambiando, setCambiando] = useState(false)
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const otras = Math.max(0, p.sesiones_activas - 1)

  async function cerrarOtras() {
    if (!(await confirmar({ titulo: 'Cerrar las demás sesiones', mensaje: 'Tendrás que volver a iniciar sesión en tus otros dispositivos. Esta sesión sigue abierta.', aceptar: 'Cerrar sesiones' })))
      return
    try {
      const r = await cuenta.cerrarOtrasSesiones()
      avisar(r.mensaje)
      alCambiar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <Seccion titulo="Seguridad">
      <Tarjeta className="divide-y divide-borde">
        <Fila
          etiqueta="Contraseña"
          accion={
            <Boton chico variante="secundario" onClick={() => setCambiando(true)}>
              Cambiar
            </Boton>
          }
        >
          <p className="text-sm text-texto-suave">Al cambiarla se cierran tus otras sesiones.</p>
        </Fila>
        <Fila
          etiqueta="Sesiones abiertas"
          accion={
            otras > 0 && (
              <Boton chico variante="secundario" onClick={cerrarOtras}>
                Cerrar las demás
              </Boton>
            )
          }
        >
          <p className="font-medium">
            {p.sesiones_activas === 1 ? 'Solo esta' : `${p.sesiones_activas}: esta y ${otras} más`}
          </p>
          <p className="text-xs text-texto-suave">Cada navegador o celular donde iniciaste sesión cuenta como una.</p>
        </Fila>
      </Tarjeta>
      <Modal abierto={cambiando} onCerrar={() => setCambiando(false)} titulo="Cambiar contraseña">
        {cambiando && (
          <FormContrasena
            alTerminar={(mensaje) => {
              setCambiando(false)
              avisar(mensaje)
              alCambiar()
            }}
            alCancelar={() => setCambiando(false)}
          />
        )}
      </Modal>
    </Seccion>
  )
}

function FormContrasena({ alTerminar, alCancelar }: { alTerminar: (mensaje: string) => void; alCancelar: () => void }) {
  const [f, setF] = useState({ contrasena_actual: '', contrasena: '', confirmacion_contrasena: '' })
  const { enviando, error, errores, enviar } = useEnvio()
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => cuenta.cambiarContrasena(f))
    if (r) alTerminar(r.mensaje)
  }
  const algunCampo = errores.contrasena_actual || errores.contrasena || errores.confirmacion_contrasena
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <CampoContrasenaActual valor={f.contrasena_actual} error={errores.contrasena_actual} alCambiar={(v) => setF({ ...f, contrasena_actual: v })} enfocar />
      <Campo etiqueta="Contraseña nueva" error={errores.contrasena} ayuda="Mínimo 8 caracteres. Mejor una frase que una palabra.">
        <Entrada type="password" autoComplete="new-password" minLength={8} maxLength={128} value={f.contrasena} onChange={(e) => setF({ ...f, contrasena: e.target.value })} required />
      </Campo>
      <Campo etiqueta="Repite la contraseña nueva" error={errores.confirmacion_contrasena}>
        <Entrada type="password" autoComplete="new-password" maxLength={128} value={f.confirmacion_contrasena} onChange={(e) => setF({ ...f, confirmacion_contrasena: e.target.value })} required />
      </Campo>
      <AlertaError mensaje={algunCampo ? null : error} />
      <Botones enviando={enviando} alCancelar={alCancelar} texto="Cambiar contraseña" />
    </form>
  )
}

// ====================================================================== piezas comunes

function CampoContrasenaActual({ valor, error, alCambiar, enfocar }: { valor: string; error?: string; alCambiar: (v: string) => void; enfocar?: boolean }) {
  return (
    <Campo etiqueta="Tu contraseña actual" error={error} ayuda={error ? undefined : 'La pedimos para confirmar que eres tú.'}>
      <Entrada type="password" autoComplete="current-password" maxLength={128} value={valor} onChange={(e) => alCambiar(e.target.value)} required autoFocus={enfocar} />
    </Campo>
  )
}

function Botones({ enviando, alCancelar, texto }: { enviando: boolean; alCancelar: () => void; texto: string }) {
  return (
    <div className={cx('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end')}>
      <Boton variante="secundario" onClick={alCancelar}>
        Cancelar
      </Boton>
      <Boton type="submit" cargando={enviando}>
        {texto}
      </Boton>
    </div>
  )
}
