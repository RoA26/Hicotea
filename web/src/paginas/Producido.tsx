import { useNavigate } from 'react-router'
import { FormProducido } from '../componentes/FormProducido'
import { Cargando, Encabezado, ErrorCarga, Tarjeta } from '../componentes/ui'
import { useCatalogos } from '../lib/catalogos'

export default function Producido() {
  const navegar = useNavigate()
  const cat = useCatalogos()
  return (
    <>
      <Encabezado titulo="Producido del día" subtitulo="Lo que hizo una fuente hoy y, si hubo, lo que costó." />
      <Tarjeta className="max-w-lg">
        {cat.error ? (
          <ErrorCarga error={cat.error} reintentar={cat.recargar} />
        ) : !cat.datos ? (
          <Cargando />
        ) : (
          <FormProducido catalogos={cat.datos} alTerminar={() => navegar('/inicio')} />
        )}
      </Tarjeta>
    </>
  )
}
