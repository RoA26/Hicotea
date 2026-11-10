import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { cajitas as api, movimientos } from '../api/cliente'
import type { OperacionCajita } from '../api/tipos'
import { useAvisar, useConfirmar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { ListaMovimientos, tituloMovimiento } from '../componentes/ListaMovimientos'
import { Modal } from '../componentes/Modal'
import { AlertaError, Boton, Campo, Cargando, Encabezado, Entrada, EntradaMonto, ErrorCarga, Insignia, Seccion, Selector, Tarjeta, Vacio } from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import { dinero, hoy, NOMBRE_PROPOSITO, NOMBRE_TIPO_MOVIMIENTO, numero } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'
import { FormCajita } from './Cajitas'

const OPERACIONES: { valor: OperacionCajita; ayuda: string }[] = [
  { valor: 'APORTE', ayuda: 'Pasa plata de lo disponible a esta cajita.' },
  { valor: 'RETIRO', ayuda: 'Devuelve plata de la cajita a lo disponible.' },
  { valor: 'RENDIMIENTO', ayuda: 'Intereses o ganancias que generó la cajita.' },
  { valor: 'SALDO_INICIAL', ayuda: 'Plata que ya estaba guardada antes de usar Hicotea.' },
]

export default function CajitaDetalle() {
  const id = Number(useParams().id)
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const registrado = useRegistroRapido()
  const { version, setSaldo, avisarCambio } = useSaldo()
  const cajita = useDatos(() => api.obtener(id), [id, version])
  const movs = useDatos(() => api.movimientos(id), [id, version])
  const { enviando, error, errores, enviar } = useEnvio()
  const [op, setOp] = useState({ operacion: 'APORTE' as OperacionCajita, fecha: hoy(), monto: '', descripcion: '' })
  const [editar, setEditar] = useState(false)

  if (cajita.error) return <ErrorCarga error={cajita.error} reintentar={cajita.recargar} />
  if (!cajita.datos) return <Cargando />
  const c = cajita.datos

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => api.operacion(id, op))
    if (r) {
      registrado(r)
      setOp((x) => ({ ...x, monto: '', descripcion: '' }))
    }
  }

  async function alternar() {
    const ok = await confirmar({
      titulo: c.activa ? 'Desactivar cajita' : 'Activar cajita',
      mensaje: c.activa ? 'No recibirá repartos ni operaciones mientras esté desactivada.' : undefined,
      aceptar: c.activa ? 'Desactivar' : 'Activar',
      peligro: c.activa,
    })
    if (!ok) return
    try {
      cajita.poner(await api.estado(id, !c.activa))
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  async function eliminar(idm: number, titulo: string) {
    if (!(await confirmar({ titulo: 'Eliminar movimiento', mensaje: `Se eliminará "${titulo}".`, aceptar: 'Eliminar', peligro: true }))) return
    try {
      const r = await movimientos.eliminar(idm)
      setSaldo(r.saldo)
      avisarCambio()
      avisar(r.mensaje)
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <>
      <Encabezado
        titulo={c.nombre}
        subtitulo={
          <>
            {NOMBRE_PROPOSITO[c.proposito]} · {c.es_resto ? 'recibe el resto' : `${numero(c.porcentaje)}% del reparto`} {!c.activa && <Insignia>Inactiva</Insignia>}
          </>
        }
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setEditar(true)}>
              <Icono nombre="lapiz" className="size-4" /> Editar
            </Boton>
            <Boton variante={c.activa ? 'peligro' : 'secundario'} onClick={alternar}>
              {c.activa ? 'Desactivar' : 'Activar'}
            </Boton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Tarjeta>
            <p className="text-sm text-texto-suave">Saldo</p>
            <p className="cifra texto-degradado text-4xl font-bold">{dinero(c.saldo)}</p>
          </Tarjeta>
          {c.activa && (
            <Tarjeta className="mt-4">
              <form onSubmit={alEnviar} className="space-y-4">
                <Campo etiqueta="Operación" error={errores.operacion} ayuda={OPERACIONES.find((o) => o.valor === op.operacion)?.ayuda}>
                  <Selector value={op.operacion} onChange={(e) => setOp({ ...op, operacion: e.target.value as OperacionCajita })}>
                    {OPERACIONES.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {NOMBRE_TIPO_MOVIMIENTO[o.valor]}
                      </option>
                    ))}
                  </Selector>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Monto" error={errores.monto}>
                    <EntradaMonto value={op.monto} onChange={(e) => setOp({ ...op, monto: e.target.value })} required />
                  </Campo>
                  <Campo etiqueta="Fecha" error={errores.fecha}>
                    <Entrada type="date" value={op.fecha} max={hoy()} onChange={(e) => setOp({ ...op, fecha: e.target.value })} required />
                  </Campo>
                </div>
                <Campo etiqueta="Nota (opcional)">
                  <Entrada value={op.descripcion} maxLength={200} onChange={(e) => setOp({ ...op, descripcion: e.target.value })} />
                </Campo>
                <AlertaError mensaje={error} />
                <Boton type="submit" className="w-full" cargando={enviando}>
                  Registrar
                </Boton>
              </form>
            </Tarjeta>
          )}
        </div>
        <Seccion titulo="Historial">
          {movs.error ? (
            <ErrorCarga error={movs.error} reintentar={movs.recargar} />
          ) : !movs.datos ? (
            <Cargando />
          ) : movs.datos.length === 0 ? (
            <Vacio>Esta cajita todavía no tiene movimientos.</Vacio>
          ) : (
            <ListaMovimientos
              movimientos={movs.datos}
              acciones={(m) =>
                m.eliminable ? (
                  <Boton chico variante="fantasma" aria-label="Eliminar" onClick={() => eliminar(m.id, tituloMovimiento(m))}>
                    <Icono nombre="basura" className="size-4" />
                  </Boton>
                ) : null
              }
            />
          )}
        </Seccion>
      </div>
      <Modal abierto={editar} onCerrar={() => setEditar(false)} titulo="Editar cajita">
        {editar && (
          <FormCajita
            cajita={c}
            alGuardar={(n) => {
              setEditar(false)
              cajita.poner(n)
              avisar('Cajita actualizada.')
            }}
          />
        )}
      </Modal>
    </>
  )
}
