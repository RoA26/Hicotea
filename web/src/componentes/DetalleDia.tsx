import { useState } from 'react'
import { atajos as apiAtajos, cajitas as apiCajitas, diasSinActividad, movimientos } from '../api/cliente'
import type { DiaCalendario } from '../api/tipos'
import { useDatos } from '../lib/datos'
import { dinero, fechaDia, numero } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'
import { useAvisar, useConfirmar, useSaldo } from './Globales'
import { ListaMovimientos } from './ListaMovimientos'
import { Boton, BotonEnlace, Cifra, Insignia, Seccion, Tarjeta } from './ui'

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * Detalle de un día del calendario vivo (C-02) y punto de partida del registro
 * retrospectivo (C-03). No calcula nada por su cuenta: usa los totales del
 * calendario y la lista de movimientos de la API, y registra con los mismos
 * formularios y endpoints de siempre, con la fecha del día seleccionado.
 */
export function DetalleDia({ dia, volver }: { dia: DiaCalendario; volver: string }) {
  const { version } = useSaldo()
  const lista = useDatos(() => movimientos.listar({ desde: dia.fecha, hasta: dia.fecha }), [dia.fecha, version])
  const titulo = capital(fechaDia(dia.fecha))
  const q = (extra: string) => `${extra}fecha=${dia.fecha}&volver=${encodeURIComponent(volver)}`
  const ahorro = numero(dia.aportes) > 0 || numero(dia.retiros) > 0 || numero(dia.rendimientos) > 0
  const movs = lista.datos?.movimientos ?? []

  return (
    <Tarjeta key={dia.fecha} className="anim-escalonado space-y-4" aria-labelledby="titulo-dia">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="titulo-dia" className="text-lg font-semibold">
          {titulo}
        </h2>
        {dia.hoy && <Insignia tono="acento">Hoy</Insignia>}
        {dia.futuro && <Insignia>Día futuro</Insignia>}
        {dia.sin_registros && <Insignia>Sin registros</Insignia>}
        {dia.sin_actividad && <Insignia>Sin actividad</Insignia>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cifra etiqueta="Ingresos" valor={dia.ingresos} tono="ingreso" />
        <Cifra etiqueta="Gastos" valor={dia.gastos} tono="gasto" />
      </div>

      {ahorro && (
        <div className="rounded-control border border-borde bg-superficie-2 p-3 text-sm">
          <p className="mb-1.5 text-xs text-texto-suave">
            Ahorro del día: dinero que se movió entre tu disponible y tus cajitas. No es un ingreso ni un gasto.
          </p>
          <dl className="grid grid-cols-3 gap-2">
            <div>
              <dt className="text-xs text-texto-suave">A cajitas</dt>
              <dd className="cifra font-semibold">{dinero(dia.aportes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave">Desde cajitas</dt>
              <dd className="cifra font-semibold">{dinero(dia.retiros)}</dd>
            </div>
            <div>
              <dt className="text-xs text-texto-suave">Rendimientos</dt>
              <dd className="cifra font-semibold">{dinero(dia.rendimientos)}</dd>
            </div>
          </dl>
        </div>
      )}

      {dia.compromisos.length > 0 && (
        <Seccion titulo="Compromisos previstos" acciones={<BotonEnlace to="/recurrentes" variante="fantasma" chico>Ver</BotonEnlace>}>
          <ul className="space-y-1 text-sm">
            {dia.compromisos.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span className="truncate">◷ {c.nombre}</span>
                <span className={c.tipo === 'INGRESO' ? 'cifra text-ingreso' : 'cifra text-gasto'}>
                  {c.tipo === 'INGRESO' ? '+ ' : '− '}
                  {dinero(c.monto)}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {dia.futuro ? (
        <p className="text-sm text-texto-suave">
          Es un día futuro: los movimientos reales se registran cuando ocurren. Aquí verás lo que tengas previsto.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm text-texto-suave">
              Registrar para el <strong className="text-texto">{fechaDia(dia.fecha)}</strong>:
            </p>
            <div className="flex flex-wrap gap-2">
              <BotonEnlace chico to={`/movimientos/nuevo?${q('tipo=INGRESO&')}`}>+ Ingreso</BotonEnlace>
              <BotonEnlace chico variante="secundario" to={`/movimientos/nuevo?${q('tipo=GASTO&')}`}>− Gasto</BotonEnlace>
              <BotonEnlace chico variante="secundario" to={`/producido?${q('')}`}>Producido</BotonEnlace>
            </div>
          </div>
          <AhorroDelDia fecha={dia.fecha} volver={volver} />
          <AtajosDelDia fecha={dia.fecha} esHoy={dia.hoy} />
          <SinActividad dia={dia} />
        </>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Movimientos</h3>
        {lista.error && !lista.datos ? (
          <p className="text-sm text-gasto">No se pudieron cargar los movimientos de este día.</p>
        ) : !lista.datos ? (
          <p className="text-sm text-texto-suave">Cargando…</p>
        ) : movs.length === 0 ? (
          <p className="text-sm text-texto-suave">{dia.futuro ? 'Todavía no hay movimientos.' : 'No hay registros este día.'}</p>
        ) : (
          <>
            <ListaMovimientos movimientos={movs} />
            {lista.datos.hay_siguiente && (
              <BotonEnlace to={`/movimientos?desde=${dia.fecha}&hasta=${dia.fecha}`} variante="fantasma" chico className="mt-2">
                Ver todos los de este día
              </BotonEnlace>
            )}
          </>
        )}
      </div>
    </Tarjeta>
  )
}

/** Atajos existentes usados en la fecha seleccionada (misma API, con `fecha`). */
export function AtajosDelDia({ fecha, esHoy }: { fecha: string; esHoy: boolean }) {
  const lista = useDatos(() => apiAtajos.listar(), [])
  const confirmar = useConfirmar()
  const avisar = useAvisar()
  const registrado = useRegistroRapido()
  const [usando, setUsando] = useState<number | null>(null)
  const atajos = lista.datos ?? []
  if (atajos.length === 0) return null

  async function usar(id: number, nombre: string, monto: string) {
    if (usando !== null) return
    if (
      !esHoy &&
      !(await confirmar({
        titulo: `Usar «${nombre}»`,
        mensaje: `Se registrará ${dinero(monto)} con fecha del ${fechaDia(fecha)}, no de hoy.`,
        aceptar: 'Registrar en esa fecha',
      }))
    )
      return
    setUsando(id)
    try {
      registrado(await apiAtajos.usar(id, fecha))
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    } finally {
      setUsando(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-texto-suave">O usa un atajo en esta fecha:</p>
      <div className="flex flex-wrap gap-2">
        {atajos.map((a) => (
          <Boton
            key={a.id}
            chico
            variante="secundario"
            cargando={usando === a.id}
            disabled={usando !== null}
            onClick={() => void usar(a.id, a.nombre, a.monto)}
          >
            {a.nombre} · <span className={a.tipo === 'INGRESO' ? 'cifra text-ingreso' : 'cifra text-gasto'}>{dinero(a.monto)}</span>
          </Boton>
        ))}
      </div>
    </div>
  )
}

/**
 * C-03b: operación de ahorro con la fecha del día. Abre el formulario de
 * siempre (detalle de la cajita) con `?operacion=&fecha=&volver=`; las
 * validaciones de fondos y de fecha las hace la API como en cualquier otro caso.
 */
function AhorroDelDia({ fecha, volver }: { fecha: string; volver: string }) {
  const lista = useDatos(() => apiCajitas.listar(), [])
  const activas = (lista.datos ?? []).filter((c) => c.activa)
  const [id, setId] = useState<number | null>(null)
  if (activas.length === 0) return null
  const elegida = id ?? activas[0].id
  const ir = (operacion: string) => `/cajitas/${elegida}?operacion=${operacion}&fecha=${fecha}&volver=${encodeURIComponent(volver)}`
  return (
    <div className="space-y-2">
      <p className="text-sm text-texto-suave">O mueve ahorro en esta fecha:</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-control border border-borde bg-superficie-2 px-2 text-sm"
          value={elegida}
          onChange={(e) => setId(Number(e.target.value))}
          aria-label="Cajita"
        >
          {activas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <BotonEnlace chico variante="secundario" to={ir('APORTE')}>Aporte</BotonEnlace>
        <BotonEnlace chico variante="secundario" to={ir('RETIRO')}>Retiro</BotonEnlace>
      </div>
    </div>
  )
}

/** C-04: confirmar (o deshacer) que el día no tuvo actividad. No crea movimientos ni cambia saldos. */
function SinActividad({ dia }: { dia: DiaCalendario }) {
  const { avisarCambio } = useSaldo()
  const avisar = useAvisar()
  const [enviando, setEnviando] = useState(false)
  if (!dia.sin_registros && !dia.sin_actividad) return null

  async function cambiar(marcar: boolean) {
    setEnviando(true)
    try {
      await (marcar ? diasSinActividad.marcar(dia.fecha) : diasSinActividad.quitar(dia.fecha))
      avisarCambio()
      avisar(marcar ? 'Listo: día marcado sin actividad.' : 'Se quitó la marca de este día.')
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    } finally {
      setEnviando(false)
    }
  }

  return dia.sin_actividad ? (
    <p className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
      Marcaste este día sin actividad financiera.
      <Boton chico variante="fantasma" cargando={enviando} onClick={() => void cambiar(false)}>
        Deshacer
      </Boton>
    </p>
  ) : (
    <Boton chico variante="fantasma" cargando={enviando} onClick={() => void cambiar(true)}>
      Marcar como día sin actividad
    </Boton>
  )
}
