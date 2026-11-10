import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { recurrentes as api, type RecurrenteForm as Form } from '../api/cliente'
import type { Periodicidad, TipoIngresoGasto } from '../api/tipos'
import { useAvisar } from '../componentes/Globales'
import { SelectorCajita, SelectorCategoria, SelectorFuente } from '../componentes/Selectores'
import { AlertaError, Boton, Campo, Cargando, Encabezado, Entrada, EntradaMonto, ErrorCarga, Segmentos, Selector, Tarjeta } from '../componentes/ui'
import { categoriasPara, useCatalogos, type Catalogos } from '../lib/catalogos'
import { useDatos, useEnvio } from '../lib/datos'
import { hoy, montoEditable, NOMBRE_PERIODICIDAD } from '../lib/formato'

const PERIODICIDADES = Object.keys(NOMBRE_PERIODICIDAD) as Periodicidad[]

export default function RecurrenteForm() {
  const { id } = useParams()
  const cat = useCatalogos()
  const existente = useDatos(() => (id !== undefined ? api.obtener(Number(id)) : Promise.resolve(null)), [id])

  if (cat.error) return <ErrorCarga error={cat.error} reintentar={cat.recargar} />
  if (existente.error) return <ErrorCarga error={existente.error} reintentar={existente.recargar} />
  if (!cat.datos || (id !== undefined && !existente.datos)) return <Cargando />

  const r = existente.datos
  const inicial: Form = r
    ? {
        nombre: r.nombre,
        tipo: r.tipo as TipoIngresoGasto,
        monto: montoEditable(r.monto),
        id_categoria: r.id_categoria,
        id_fuente: r.id_fuente,
        id_cajita_origen: r.id_cajita_origen,
        periodicidad: r.periodicidad,
        proxima_fecha: r.proxima_fecha,
        dias_aviso: r.dias_aviso,
      }
    : {
        nombre: '',
        tipo: 'GASTO',
        monto: '',
        id_categoria: null,
        id_fuente: null,
        id_cajita_origen: null,
        periodicidad: 'MENSUAL',
        proxima_fecha: hoy(),
        dias_aviso: 3,
      }
  return <Formulario key={id ?? 'nuevo'} id={r?.id} inicial={inicial} catalogos={cat.datos} />
}

function Formulario({ id, inicial, catalogos }: { id?: number; inicial: Form; catalogos: Catalogos }) {
  const editando = id !== undefined
  const navegar = useNavigate()
  const avisar = useAvisar()
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<Form>(inicial)
  const pon = (c: Partial<Form>) => setF((x) => ({ ...x, ...c }))

  const { categorias, fuentes, cajitas } = catalogos
  const opciones = categoriasPara(categorias, f.tipo === 'INGRESO' ? ['INGRESO'] : ['GASTO', 'COSTO_OPERATIVO'], editando ? inicial.id_categoria : null)
  const categoria = categorias.find((c) => c.id === f.id_categoria)
  const pideFuente = f.tipo === 'INGRESO' || categoria?.tipo === 'COSTO_OPERATIVO'

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const datos: Form = { ...f, id_fuente: pideFuente ? f.id_fuente : null, id_cajita_origen: f.tipo === 'GASTO' ? f.id_cajita_origen : null }
    const r = await enviar(() => (editando ? api.actualizar(id, datos) : api.crear(datos)))
    if (r) {
      avisar('Recurrente guardado.')
      navegar('/recurrentes')
    }
  }

  return (
    <>
      <Encabezado titulo={editando ? 'Editar recurrente' : 'Nuevo recurrente'} />
      <Tarjeta className="max-w-lg">
        <form onSubmit={alEnviar} className="space-y-4">
          <Segmentos<TipoIngresoGasto>
            valor={f.tipo}
            onCambio={(tipo) => pon({ tipo, id_categoria: null })}
            opciones={[
              { valor: 'GASTO', etiqueta: 'Gasto', tono: 'gasto' },
              { valor: 'INGRESO', etiqueta: 'Ingreso' },
            ]}
          />
          <Campo etiqueta="Nombre" error={errores.nombre}>
            <Entrada value={f.nombre} maxLength={60} onChange={(e) => pon({ nombre: e.target.value })} placeholder="Arriendo" required />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Monto" error={errores.monto}>
              <EntradaMonto value={f.monto} onChange={(e) => pon({ monto: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Se repite" error={errores.periodicidad}>
              <Selector value={f.periodicidad} onChange={(e) => pon({ periodicidad: e.target.value as Periodicidad })}>
                {PERIODICIDADES.map((p) => (
                  <option key={p} value={p}>
                    {NOMBRE_PERIODICIDAD[p]}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>
          <Campo etiqueta="Categoría" error={errores.id_categoria}>
            <SelectorCategoria categorias={opciones} valor={f.id_categoria} onCambio={(id_categoria) => pon({ id_categoria })} invalido={!!errores.id_categoria} />
          </Campo>
          {pideFuente && (
            <Campo etiqueta={categoria?.tipo === 'COSTO_OPERATIVO' ? 'Fuente' : 'Fuente (opcional)'} error={errores.id_fuente}>
              <SelectorFuente fuentes={fuentes} valor={f.id_fuente} onCambio={(id_fuente) => pon({ id_fuente })} invalido={!!errores.id_fuente} />
            </Campo>
          )}
          {f.tipo === 'GASTO' && cajitas.some((c) => c.activa) && (
            <Campo etiqueta="Pagar desde una cajita (opcional)" error={errores.id_cajita_origen}>
              <SelectorCajita cajitas={cajitas} valor={f.id_cajita_origen} vacio="No, de lo disponible" onCambio={(id_cajita_origen) => pon({ id_cajita_origen })} />
            </Campo>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Próxima fecha" error={errores.proxima_fecha} ayuda="Los mensuales se repiten ese mismo día.">
              <Entrada type="date" value={f.proxima_fecha} onChange={(e) => pon({ proxima_fecha: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Avisar días antes" error={errores.dias_aviso}>
              <Entrada type="number" min={0} max={30} value={f.dias_aviso} onChange={(e) => pon({ dias_aviso: Number(e.target.value) })} />
            </Campo>
          </div>
          <AlertaError mensaje={error} />
          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => navegar(-1)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={enviando}>
              Guardar
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </>
  )
}
