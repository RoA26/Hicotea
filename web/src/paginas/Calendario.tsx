import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { tablero } from '../api/cliente'
import { DetalleDia } from '../componentes/DetalleDia'
import { useSaldo } from '../componentes/Globales'
import { VistaCalendario } from '../componentes/VistaCalendario'
import { Boton, Cargando, cx, Encabezado, ErrorCarga } from '../componentes/ui'
import { useDatos } from '../lib/datos'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const CLAVE_PLEGADO = 'hicotea:calendario-detalle-plegado'

function leerPlegado() {
  try {
    return localStorage.getItem(CLAVE_PLEGADO) === '1'
  } catch {
    return false
  }
}

/**
 * Calendario vivo: navegación histórica (mes y año), detalle del día y
 * registro retrospectivo. El mes y el día viven en la URL (`?mes=&dia=`) para
 * volver al mismo punto después de registrar. Se recarga con `version`, que
 * sube tras cualquier registro, edición o eliminación (useSaldo.avisarCambio).
 */
export default function Calendario() {
  const [q, setQ] = useSearchParams()
  const diaUrl = q.get('dia')
  const dia = diaUrl && FECHA.test(diaUrl) ? diaUrl : null
  const mes = q.get('mes') ?? dia?.slice(0, 7) ?? undefined
  const { version } = useSaldo()
  // Preferencia de vista por dispositivo (no es un dato financiero).
  const [plegado, setPlegadoEstado] = useState(leerPlegado)
  const setPlegado = (v: boolean) => {
    setPlegadoEstado(v)
    try {
      localStorage.setItem(CLAVE_PLEGADO, v ? '1' : '0')
    } catch {
      /* sin almacenamiento */
    }
  }
  const c = useDatos(() => tablero.calendario(mes), [mes, version])

  const datos = c.datos
  const seleccionado = dia ?? (datos && datos.hoy.startsWith(datos.mes) ? datos.hoy : null)
  const diaSeleccionado = datos?.semanas.flat().find((d) => d.fecha === seleccionado)
  const volver = `/calendario?mes=${datos?.mes ?? mes ?? ''}${seleccionado ? `&dia=${seleccionado}` : ''}`

  return (
    <>
      <Encabezado titulo="Calendario" subtitulo="Elige un día para ver sus movimientos o registrar algo que faltó." />
      {c.error && !datos ? (
        <ErrorCarga error={c.error} reintentar={c.recargar} />
      ) : !datos ? (
        <Cargando />
      ) : (
        <div className={cx('grid gap-6', plegado ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : 'lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)]')}>
          <div className="min-w-0">
            <VistaCalendario
              c={datos}
              seleccionado={seleccionado}
              alSeleccionar={(f) => setQ({ mes: f.slice(0, 7), dia: f }, { replace: true })}
              alCambiarMes={(m, d) => setQ(d ? { mes: m, dia: d } : { mes: m }, { replace: true })}
            />
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start">
            {/* Plegar solo tiene sentido al lado del calendario (desde lg); en móvil el detalle va debajo. */}
            <div className="mb-2 hidden justify-end lg:flex">
              <Boton
                chico
                variante="fantasma"
                aria-expanded={!plegado}
                aria-controls="detalle-dia"
                onClick={() => setPlegado(!plegado)}
                aria-label={plegado ? 'Mostrar el detalle del día' : 'Plegar el detalle del día'}
              >
                {plegado ? '« Detalle' : 'Plegar »'}
              </Boton>
            </div>
            <div id="detalle-dia" className={cx(plegado && 'lg:hidden')}>
            {diaSeleccionado ? (
              <DetalleDia dia={diaSeleccionado} volver={volver} />
            ) : (
              <p className="rounded-tarjeta border border-dashed border-borde p-6 text-center text-sm text-texto-suave">
                Elige un día del calendario para ver su detalle.
              </p>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
