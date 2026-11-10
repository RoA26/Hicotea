import { useSearchParams } from 'react-router'
import { tablero } from '../api/cliente'
import { useSaldo } from '../componentes/Globales'
import { VistaCalendario } from '../componentes/VistaCalendario'
import { Cargando, Encabezado, ErrorCarga } from '../componentes/ui'
import { useDatos } from '../lib/datos'

export default function Calendario() {
  const [q, setQ] = useSearchParams()
  const mes = q.get('mes') ?? undefined
  const { version } = useSaldo()
  const c = useDatos(() => tablero.calendario(mes), [mes, version])
  return (
    <>
      <Encabezado titulo="Calendario" />
      {c.error && !c.datos ? (
        <ErrorCarga error={c.error} reintentar={c.recargar} />
      ) : !c.datos ? (
        <Cargando />
      ) : (
        <VistaCalendario c={c.datos} alCambiarMes={(m) => setQ({ mes: m }, { replace: true })} />
      )}
    </>
  )
}
