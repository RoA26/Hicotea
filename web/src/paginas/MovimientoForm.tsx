import { useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { movimientos, type MovimientoForm as Form } from '../api/cliente'
import type { TipoIngresoGasto } from '../api/tipos'
import { useAvisar, useConfirmar } from '../componentes/Globales'
import { SelectorCajita, SelectorCategoria, SelectorFuente } from '../componentes/Selectores'
import { AlertaError, AvisoFecha, Boton, Campo, Cargando, Encabezado, Entrada, EntradaMonto, ErrorCarga, Segmentos, Tarjeta } from '../componentes/ui'
import { categoriasPara, useCatalogos, type Catalogos } from '../lib/catalogos'
import { useDatos, useEnvio } from '../lib/datos'
import { fechaDia, fechaPrecargada, hoy, montoEditable, rutaVolver } from '../lib/formato'
import { conConfirmacionNegativo } from '../lib/correcciones'
import { useRegistroRapido } from '../lib/registro'

export default function MovimientoForm() {
  const { id } = useParams()
  const [q] = useSearchParams()
  const cat = useCatalogos()
  const existente = useDatos(() => (id !== undefined ? movimientos.obtener(Number(id)) : Promise.resolve(null)), [id])

  if (cat.error) return <ErrorCarga error={cat.error} reintentar={cat.recargar} />
  if (existente.error) return <ErrorCarga error={existente.error} reintentar={existente.recargar} />
  if (!cat.datos || (id !== undefined && !existente.datos)) return <Cargando />

  const m = existente.datos
  const inicial: Form = m
    ? {
        tipo: m.tipo as TipoIngresoGasto,
        fecha: m.fecha,
        monto: montoEditable(m.monto),
        id_categoria: m.id_categoria,
        id_fuente: m.id_fuente,
        descripcion: m.descripcion ?? '',
      }
    : {
        tipo: q.get('tipo') === 'GASTO' ? 'GASTO' : 'INGRESO',
        fecha: fechaPrecargada(q.get('fecha')), // C-03: registro retrospectivo desde el calendario
        monto: '',
        id_categoria: null,
        id_fuente: null,
        id_cajita_origen: null,
        descripcion: '',
      }
  return <Formulario key={id ?? 'nuevo'} id={m?.id} inicial={inicial} catalogos={cat.datos} volver={rutaVolver(q.get('volver'))} />
}

function Formulario({ id, inicial, catalogos, volver }: { id?: number; inicial: Form; catalogos: Catalogos; volver: string | null }) {
  const editando = id !== undefined
  const navegar = useNavigate()
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const registrado = useRegistroRapido()
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<Form>(inicial)
  const [desdeCajita, setDesdeCajita] = useState(false)

  const { categorias, fuentes, cajitas } = catalogos
  const opciones = categoriasPara(categorias, f.tipo === 'INGRESO' ? ['INGRESO'] : ['GASTO', 'COSTO_OPERATIVO'], editando ? inicial.id_categoria : null)
  const categoria = categorias.find((c) => c.id === f.id_categoria)
  const pideFuente = f.tipo === 'INGRESO' || categoria?.tipo === 'COSTO_OPERATIVO'
  const fuenteObligatoria = categoria?.tipo === 'COSTO_OPERATIVO'
  const pon = (c: Partial<Form>) => setF((x) => ({ ...x, ...c }))

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const datos: Form = {
      ...f,
      id_fuente: pideFuente ? f.id_fuente : null,
      id_cajita_origen: !editando && f.tipo === 'GASTO' && desdeCajita ? f.id_cajita_origen : null,
    }
    if (editando) {
      const r = await enviar(() => conConfirmacionNegativo(confirmar, (ok) => movimientos.actualizar(id, datos, ok)))
      if (r) {
        avisar('Movimiento actualizado.')
        navegar(-1)
      }
    } else {
      const r = await enviar(() => movimientos.crear(datos))
      if (r) {
        registrado(r)
        navegar(volver ?? '/movimientos')
      }
    }
  }

  return (
    <>
      <Encabezado titulo={editando ? 'Editar movimiento' : 'Nuevo movimiento'} />
      <Tarjeta className="max-w-lg">
        <form onSubmit={alEnviar} className="space-y-4">
          {!editando && (
            <Segmentos<TipoIngresoGasto>
              valor={f.tipo}
              onCambio={(tipo) => pon({ tipo, id_categoria: null })}
              opciones={[
                { valor: 'INGRESO', etiqueta: 'Ingreso' },
                { valor: 'GASTO', etiqueta: 'Gasto', tono: 'gasto' },
              ]}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Monto" error={errores.monto}>
              <EntradaMonto value={f.monto} onChange={(e) => pon({ monto: e.target.value })} aria-invalid={!!errores.monto || undefined} required />
            </Campo>
            <Campo etiqueta="Fecha" error={errores.fecha}>
              <Entrada type="date" value={f.fecha} max={hoy()} onChange={(e) => pon({ fecha: e.target.value })} aria-invalid={!!errores.fecha || undefined} required />
            </Campo>
          </div>
          <AvisoFecha fecha={f.fecha} hoy={hoy()} texto={fechaDia} />
          <Campo etiqueta="Categoría" error={errores.id_categoria}>
            <SelectorCategoria categorias={opciones} valor={f.id_categoria} onCambio={(id_categoria) => pon({ id_categoria })} invalido={!!errores.id_categoria} />
          </Campo>
          {pideFuente && (
            <Campo
              etiqueta={fuenteObligatoria ? 'Fuente' : 'Fuente (opcional)'}
              error={errores.id_fuente}
              ayuda={fuenteObligatoria ? 'Los costos operativos pertenecen a una fuente.' : undefined}
            >
              <SelectorFuente
                fuentes={fuentes}
                valor={f.id_fuente}
                vacio={fuenteObligatoria ? 'Elige una fuente' : 'Sin fuente'}
                onCambio={(id_fuente) => pon({ id_fuente })}
                invalido={!!errores.id_fuente}
              />
            </Campo>
          )}
          {!editando && f.tipo === 'GASTO' && cajitas.some((c) => c.activa) && (
            <div className="rounded-control border border-borde p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={desdeCajita} onChange={(e) => setDesdeCajita(e.target.checked)} className="size-4 accent-[var(--acento)]" />
                Pagar con plata de una cajita
              </label>
              {desdeCajita && (
                <Campo etiqueta="Cajita" error={errores.id_cajita_origen} className="mt-3">
                  <SelectorCajita cajitas={cajitas} valor={f.id_cajita_origen ?? null} onCambio={(id_cajita_origen) => pon({ id_cajita_origen })} invalido={!!errores.id_cajita_origen} />
                </Campo>
              )}
            </div>
          )}
          <Campo etiqueta="Descripción (opcional)" error={errores.descripcion}>
            <Entrada value={f.descripcion ?? ''} maxLength={200} onChange={(e) => pon({ descripcion: e.target.value })} />
          </Campo>
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
