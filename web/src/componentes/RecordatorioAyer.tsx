import { useState } from 'react'
import { diasSinActividad } from '../api/cliente'
import { fechaDia } from '../lib/formato'
import { AtajosDelDia } from './DetalleDia'
import { useAvisar, useSaldo } from './Globales'
import { Boton, BotonEnlace } from './ui'

const CLAVE = 'hicotea:recordatorio-descartado'

function descartadoPara(fecha: string) {
  try {
    return localStorage.getItem(CLAVE) === fecha
  } catch {
    return false
  }
}

/**
 * C-05: aviso discreto cuando ayer no tiene registros (la API ya excluye
 * fechas futuras, días anteriores al historial y días confirmados sin
 * actividad). Tono informativo, sin juicio. "Descartar" es por dispositivo
 * (localStorage): no es un dato financiero y no marca nada en la cuenta.
 */
export function RecordatorioAyer({ hoy }: { hoy: string }) {
  const ayer = new Date(Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10) - 1)).toISOString().slice(0, 10)
  const [oculto, setOculto] = useState(() => descartadoPara(ayer))
  const [atajos, setAtajos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const { avisarCambio } = useSaldo()
  const avisar = useAvisar()
  if (oculto) return null

  function descartar() {
    try {
      localStorage.setItem(CLAVE, ayer)
    } catch {
      /* sin almacenamiento: se oculta solo en esta visita */
    }
    setOculto(true)
  }

  async function sinActividad() {
    setEnviando(true)
    try {
      await diasSinActividad.marcar(ayer)
      avisar('Listo: ayer quedó marcado sin actividad.')
      avisarCambio()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    } finally {
      setEnviando(false)
    }
  }

  const volver = encodeURIComponent('/inicio')
  return (
    <section aria-label="Recordatorio de ayer" className="rounded-tarjeta border border-borde bg-superficie p-4 text-sm shadow-tarjeta">
      <p>
        El día de ayer (<span className="text-texto-suave">{fechaDia(ayer)}</span>) no tiene movimientos registrados.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <BotonEnlace chico variante="secundario" to={`/movimientos/nuevo?tipo=GASTO&fecha=${ayer}&volver=${volver}`}>
          Registrar movimiento de ayer
        </BotonEnlace>
        <Boton chico variante="fantasma" aria-expanded={atajos} onClick={() => setAtajos(!atajos)}>
          Usar un atajo
        </Boton>
        <Boton chico variante="fantasma" cargando={enviando} onClick={() => void sinActividad()}>
          No hubo actividad
        </Boton>
        <Boton chico variante="fantasma" onClick={descartar} className="ml-auto">
          Descartar
        </Boton>
      </div>
      {atajos && (
        <div className="mt-3 border-t border-borde pt-3">
          <AtajosDelDia fecha={ayer} esHoy={false} />
        </div>
      )}
    </section>
  )
}
