import { useState, type FormEvent } from 'react'
import { movimientos, type ProducidoForm } from '../api/cliente'
import { categoriasPara, type Catalogos } from '../lib/catalogos'
import { useEnvio } from '../lib/datos'
import { fechaDia, hoy } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'
import { SelectorCategoria, SelectorFuente } from './Selectores'
import { AlertaError, AvisoFecha, Boton, Campo, Entrada, EntradaMonto } from './ui'

/** Registro rápido del producido del día (RN-01): ingreso de una fuente y, opcional, su costo. */
export function FormProducido({ catalogos, alTerminar, fecha }: { catalogos: Catalogos; alTerminar?: () => void; fecha?: string }) {
  const registrado = useRegistroRapido()
  const { enviando, error, errores, enviar } = useEnvio()
  const ingresos = categoriasPara(catalogos.categorias, ['INGRESO'])
  const costos = categoriasPara(catalogos.categorias, ['COSTO_OPERATIVO'])
  const activas = catalogos.fuentes.filter((x) => x.activa)
  const [f, setF] = useState<ProducidoForm>({
    id_fuente: activas[0]?.id ?? 0,
    fecha: fecha ?? hoy(),
    monto: '',
    id_categoria_ingreso: (ingresos.find((c) => c.nombre === 'Producido') ?? ingresos[0])?.id ?? null,
    costo: '',
    id_categoria_costo: costos[0]?.id ?? null,
  })
  const pon = (c: Partial<ProducidoForm>) => setF((x) => ({ ...x, ...c }))

  if (activas.length === 0) {
    return <p className="text-sm text-texto-suave">Primero crea una fuente de ingreso (por ejemplo, tu motocarro o tu tienda) en Fuentes de ingreso.</p>
  }

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => movimientos.producido(f))
    if (r) {
      registrado(r)
      setF((x) => ({ ...x, monto: '', costo: '' }))
      alTerminar?.()
    }
  }

  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="Fuente" error={errores.id_fuente}>
        <SelectorFuente fuentes={activas} valor={f.id_fuente} vacio="Elige una fuente" onCambio={(id) => pon({ id_fuente: id ?? 0 })} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Producido" error={errores.monto}>
          <EntradaMonto value={f.monto} onChange={(e) => pon({ monto: e.target.value })} aria-invalid={!!errores.monto || undefined} required />
        </Campo>
        <Campo etiqueta="Fecha" error={errores.fecha}>
          <Entrada type="date" value={f.fecha} max={hoy()} onChange={(e) => pon({ fecha: e.target.value })} aria-invalid={!!errores.fecha || undefined} required />
        </Campo>
      </div>
      <AvisoFecha fecha={f.fecha} hoy={hoy()} texto={fechaDia} />
      <Campo etiqueta="Categoría del ingreso" error={errores.id_categoria_ingreso}>
        <SelectorCategoria categorias={ingresos} valor={f.id_categoria_ingreso} onCambio={(id) => pon({ id_categoria_ingreso: id })} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Costo (opcional)" error={errores.costo} ayuda="Gasolina, repuestos…">
          <EntradaMonto value={f.costo ?? ''} onChange={(e) => pon({ costo: e.target.value })} aria-invalid={!!errores.costo || undefined} />
        </Campo>
        <Campo etiqueta="Categoría del costo" error={errores.id_categoria_costo}>
          <SelectorCategoria categorias={costos} valor={f.id_categoria_costo ?? null} onCambio={(id) => pon({ id_categoria_costo: id })} />
        </Campo>
      </div>
      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
        Registrar producido
      </Boton>
    </form>
  )
}
