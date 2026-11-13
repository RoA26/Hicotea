import { cajitas as api } from '../api/cliente'
import { useSaldo } from '../componentes/Globales'
import { ListaMovimientos } from '../componentes/ListaMovimientos'
import { BotonEnlace, Cargando, Encabezado, ErrorCarga, Vacio } from '../componentes/ui'
import { useDatos } from '../lib/datos'

/** Historial del Caparazón: últimas operaciones de todas las cajitas, incluidas las archivadas. */
export default function HistorialAhorro() {
  const { version } = useSaldo()
  const h = useDatos(api.historial, [version])
  return (
    <>
      <Encabezado
        titulo="Historial de ahorro"
        subtitulo="Aportes, retiros y rendimientos de todas tus cajitas. No son ingresos ni gastos: es dinero que se mueve entre tu disponible y tu caparazón."
        acciones={<BotonEnlace to="/caparazon" variante="secundario">← Caparazón</BotonEnlace>}
      />
      {h.error ? (
        <ErrorCarga error={h.error} reintentar={h.recargar} />
      ) : !h.datos ? (
        <Cargando />
      ) : h.datos.length === 0 ? (
        <Vacio>Todavía no hay operaciones de ahorro.</Vacio>
      ) : (
        <ListaMovimientos movimientos={h.datos} />
      )}
    </>
  )
}
