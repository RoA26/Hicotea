import { useNavigate, useSearchParams } from 'react-router'
import { FormProducido } from '../componentes/FormProducido'
import { Cargando, Encabezado, ErrorCarga, Tarjeta } from '../componentes/ui'
import { useCatalogos } from '../lib/catalogos'
import { fechaPrecargada, rutaVolver } from '../lib/formato'

export default function Producido() {
  const navegar = useNavigate()
  const cat = useCatalogos()
  const [q] = useSearchParams()
  const volver = rutaVolver(q.get('volver')) ?? '/inicio'
  return (
    <>
      <Encabezado titulo="Producido del día" subtitulo="Lo que hizo una fuente ese día y, si hubo, lo que costó." />
      <Tarjeta className="max-w-lg">
        {cat.error ? (
          <ErrorCarga error={cat.error} reintentar={cat.recargar} />
        ) : !cat.datos ? (
          <Cargando />
        ) : (
          <FormProducido catalogos={cat.datos} fecha={fechaPrecargada(q.get('fecha'))} alTerminar={() => navegar(volver)} />
        )}
      </Tarjeta>
    </>
  )
}
