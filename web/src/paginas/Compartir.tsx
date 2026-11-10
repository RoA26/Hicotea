import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { compartir as api } from '../api/cliente'
import type { Acceso } from '../api/tipos'
import { useAvisar, useConfirmar } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { AlertaError, Boton, Campo, Cargando, Encabezado, Entrada, ErrorCarga, Seccion, Tarjeta, Vacio } from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import { fechaLarga } from '../lib/formato'

export default function Compartir() {
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const concedidos = useDatos(api.concedidos)
  const recibidos = useDatos(api.recibidos)
  const { enviando, error, errores, enviar } = useEnvio()
  const [usuario, setUsuario] = useState('')

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => api.conceder(usuario))
    if (r) {
      concedidos.poner(r)
      setUsuario('')
      avisar('Listo. Ahora puede ver tu cuenta (solo lectura).')
    }
  }

  async function revocar(a: Acceso) {
    if (!(await confirmar({ titulo: 'Dejar de compartir', mensaje: `${a.nombre_completo_invitado} ya no podrá ver tu cuenta.`, aceptar: 'Dejar de compartir', peligro: true }))) return
    try {
      await api.revocar(a.id)
      void concedidos.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <>
      <Encabezado titulo="Compartir" subtitulo="Deja que alguien de confianza vea tu cuenta. Solo puede mirar, nunca cambiar nada." />
      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <Tarjeta>
            <form onSubmit={alEnviar} className="flex items-end gap-2">
              <Campo etiqueta="Usuario de la persona" error={errores.nombre_usuario} className="flex-1">
                <Entrada value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" placeholder="usuario" required />
              </Campo>
              <Boton type="submit" cargando={enviando}>
                Compartir
              </Boton>
            </form>
            {!errores.nombre_usuario && (
              <div className="mt-3">
                <AlertaError mensaje={error} />
              </div>
            )}
          </Tarjeta>
          <Seccion titulo="Pueden ver mi cuenta">
            {concedidos.error ? (
              <ErrorCarga error={concedidos.error} reintentar={concedidos.recargar} />
            ) : !concedidos.datos ? (
              <Cargando />
            ) : concedidos.datos.length === 0 ? (
              <Vacio>Nadie más ve tu cuenta.</Vacio>
            ) : (
              <ul className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
                {concedidos.datos.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.nombre_completo_invitado}</p>
                      <p className="truncate text-xs text-texto-suave">
                        @{a.nombre_usuario_invitado} · desde el {fechaLarga(a.fecha_concesion)}
                      </p>
                    </div>
                    <Boton chico variante="peligro" onClick={() => revocar(a)}>
                      Quitar
                    </Boton>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
        <Seccion titulo="Cuentas que puedo ver">
          {recibidos.error ? (
            <ErrorCarga error={recibidos.error} reintentar={recibidos.recargar} />
          ) : !recibidos.datos ? (
            <Cargando />
          ) : recibidos.datos.length === 0 ? (
            <Vacio>Nadie te ha compartido su cuenta todavía.</Vacio>
          ) : (
            <ul className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
              {recibidos.datos.map((a) => (
                <li key={a.id}>
                  <Link to={`/compartido/${a.id_titular}`} className="flex items-center gap-3 px-4 py-3 hover:bg-superficie-2">
                    <Icono nombre="ojo" className="size-5 text-texto-suave" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.nombre_completo_titular}</span>
                    <Icono nombre="derecha" className="size-4 text-texto-suave" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </div>
    </>
  )
}
