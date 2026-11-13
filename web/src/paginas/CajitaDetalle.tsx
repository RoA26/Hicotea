import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { ContadorAnimado } from '../animacion/ContadorAnimado'
import { cajitas as api, movimientos } from '../api/cliente'
import type { OperacionCajita } from '../api/tipos'
import { useAvisar, useConfirmar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { ListaMovimientos, tituloMovimiento } from '../componentes/ListaMovimientos'
import { Modal } from '../componentes/Modal'
import {
  AlertaError,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Entrada,
  EntradaMonto,
  ErrorCarga,
  Insignia,
  Seccion,
  Segmentos,
  Tarjeta,
  Vacio,
} from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import {
  dinero,
  formatoPorcentaje,
  hoy,
  NOMBRE_PROPOSITO,
  numero,
} from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'
import { FormCajita } from './Cajitas'

const AYUDA_OPERACION: Record<OperacionCajita, string> = {
  APORTE: 'Pasa plata de lo disponible a esta cajita.',
  RETIRO: 'Devuelve plata de la cajita a lo disponible.',
  RENDIMIENTO: 'Intereses o ganancias generadas por el dinero en esta cajita.',
  SALDO_INICIAL: 'Plata que ya estaba guardada antes de usar Hicotea.',
}

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

  // Estadísticas calculadas del historial
  const historial = movs.datos ?? []
  const totalAportes = historial
    .filter((m) => m.tipo === 'APORTE' || m.tipo === 'SALDO_INICIAL')
    .reduce((s, m) => s + numero(m.monto), 0)
  const totalRetiros = historial
    .filter((m) => m.tipo === 'RETIRO')
    .reduce((s, m) => s + numero(m.monto), 0)
  const totalRendimientos = historial
    .filter((m) => m.tipo === 'RENDIMIENTO')
    .reduce((s, m) => s + numero(m.monto), 0)

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => api.operacion(id, op))
    if (r) {
      registrado(r)
      setOp((x) => ({ ...x, monto: '', descripcion: '' }))
      void cajita.recargar()
      void movs.recargar()
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
    if (
      !(await confirmar({
        titulo: 'Eliminar movimiento',
        mensaje: `Se eliminará "${titulo}". El saldo se recalculará automáticamente.`,
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return
    try {
      const r = await movimientos.eliminar(idm)
      setSaldo(r.saldo)
      avisarCambio()
      avisar(r.mensaje)
      void cajita.recargar()
      void movs.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <>
      <Encabezado
        titulo={c.nombre}
        subtitulo={
          <span className="flex flex-wrap items-center gap-2">
            <span>{NOMBRE_PROPOSITO[c.proposito]}</span>
            <span>·</span>
            <span>{c.es_resto ? 'Recibe el resto del reparto' : `${formatoPorcentaje(c.porcentaje)} del reparto`}</span>
            {!c.activa && <Insignia>Inactiva</Insignia>}
          </span>
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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4">
          {/* Tarjeta principal de saldo */}
          <Tarjeta className="p-5">
            <p className="text-xs font-semibold tracking-wide text-texto-suave uppercase">
              Saldo acumulado
            </p>
            <p className="cifra texto-degradado mt-1 text-4xl sm:text-5xl font-bold tracking-tight">
              <ContadorAnimado valor={c.saldo} />
            </p>

            {/* Estadísticas de la cajita */}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-borde pt-4">
              <div>
                <p className="text-xs text-texto-suave">Aportado</p>
                <p className="cifra truncate text-sm font-semibold text-ingreso">
                  +{dinero(totalAportes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-texto-suave">Retirado</p>
                <p className="cifra truncate text-sm font-semibold text-gasto">
                  −{dinero(totalRetiros)}
                </p>
              </div>
              <div>
                <p className="text-xs text-texto-suave">Ganancias</p>
                <p className="cifra truncate text-sm font-semibold text-acento">
                  +{dinero(totalRendimientos)}
                </p>
              </div>
            </div>
          </Tarjeta>

          {/* Formulario de operaciones contextual */}
          {c.activa ? (
            <Tarjeta className="p-5">
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-texto uppercase">
                Registrar operación
              </h2>
              <form onSubmit={alEnviar} className="space-y-4">
                <Segmentos<OperacionCajita>
                  valor={op.operacion}
                  onCambio={(operacion) => setOp({ ...op, operacion })}
                  opciones={[
                    { valor: 'APORTE', etiqueta: 'Aporte', tono: 'acento' },
                    { valor: 'RETIRO', etiqueta: 'Retiro', tono: 'gasto' },
                    { valor: 'RENDIMIENTO', etiqueta: 'Rendimiento' },
                  ]}
                />

                <p className="text-xs text-texto-suave">
                  {AYUDA_OPERACION[op.operacion]}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Monto" error={errores.monto}>
                    <EntradaMonto
                      value={op.monto}
                      onChange={(e) => setOp({ ...op, monto: e.target.value })}
                      required
                    />
                  </Campo>
                  <Campo etiqueta="Fecha" error={errores.fecha}>
                    <Entrada
                      type="date"
                      value={op.fecha}
                      max={hoy()}
                      onChange={(e) => setOp({ ...op, fecha: e.target.value })}
                      required
                    />
                  </Campo>
                </div>

                <Campo etiqueta="Nota descriptiva (opcional)">
                  <Entrada
                    value={op.descripcion}
                    maxLength={200}
                    placeholder="Ej. Aporte de quincena o pago seguro"
                    onChange={(e) => setOp({ ...op, descripcion: e.target.value })}
                  />
                </Campo>

                <AlertaError mensaje={error} />

                <Boton type="submit" className="w-full" cargando={enviando}>
                  Registrar {op.operacion === 'APORTE' ? 'Aporte' : op.operacion === 'RETIRO' ? 'Retiro' : 'Rendimiento'}
                </Boton>
              </form>
            </Tarjeta>
          ) : (
            <div className="rounded-2xl border border-borde bg-superficie-2 p-4 text-center text-sm text-texto-suave">
              Esta cajita está desactivada. Actívala para registrar aportes, retiros o rendimientos.
            </div>
          )}
        </div>

        {/* Historial de movimientos */}
        <Seccion titulo={`Movimientos (${historial.length})`}>
          {movs.error ? (
            <ErrorCarga error={movs.error} reintentar={movs.recargar} />
          ) : !movs.datos ? (
            <Cargando />
          ) : historial.length === 0 ? (
            <Vacio>Esta cajita todavía no tiene movimientos registrados.</Vacio>
          ) : (
            <ListaMovimientos
              movimientos={historial}
              acciones={(m) =>
                m.eliminable ? (
                  <Boton
                    chico
                    variante="fantasma"
                    aria-label="Eliminar movimiento"
                    onClick={() => eliminar(m.id, tituloMovimiento(m))}
                  >
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
