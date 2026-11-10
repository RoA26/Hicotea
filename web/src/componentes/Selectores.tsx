import type { Cajita, Categoria, Fuente } from '../api/tipos'
import { dinero, NOMBRE_TIPO_CATEGORIA } from '../lib/formato'
import { Selector } from './ui'

const aId = (v: string) => (v === '' ? null : Number(v))

export function SelectorCategoria({
  categorias,
  valor,
  onCambio,
  invalido,
}: {
  categorias: Categoria[]
  valor: number | null
  onCambio: (id: number | null) => void
  invalido?: boolean
}) {
  const tipos = [...new Set(categorias.map((c) => c.tipo))]
  const opcion = (c: Categoria) => (
    <option key={c.id} value={c.id}>
      {c.nombre}
      {c.activa ? '' : ' (desactivada)'}
    </option>
  )
  return (
    <Selector value={valor ?? ''} onChange={(e) => onCambio(aId(e.target.value))} aria-invalid={invalido || undefined}>
      <option value="">Elige una categoría</option>
      {tipos.length > 1
        ? tipos.map((t) => (
            <optgroup key={t} label={NOMBRE_TIPO_CATEGORIA[t]}>
              {categorias.filter((c) => c.tipo === t).map(opcion)}
            </optgroup>
          ))
        : categorias.map(opcion)}
    </Selector>
  )
}

export function SelectorFuente({
  fuentes,
  valor,
  onCambio,
  vacio = 'Sin fuente',
  invalido,
}: {
  fuentes: Fuente[]
  valor: number | null
  onCambio: (id: number | null) => void
  vacio?: string
  invalido?: boolean
}) {
  return (
    <Selector value={valor ?? ''} onChange={(e) => onCambio(aId(e.target.value))} aria-invalid={invalido || undefined}>
      <option value="">{vacio}</option>
      {fuentes
        .filter((f) => f.activa || f.id === valor)
        .map((f) => (
          <option key={f.id} value={f.id}>
            {f.nombre}
          </option>
        ))}
    </Selector>
  )
}

export function SelectorCajita({
  cajitas,
  valor,
  onCambio,
  vacio = 'Elige una cajita',
  invalido,
}: {
  cajitas: Cajita[]
  valor: number | null
  onCambio: (id: number | null) => void
  vacio?: string
  invalido?: boolean
}) {
  return (
    <Selector value={valor ?? ''} onChange={(e) => onCambio(aId(e.target.value))} aria-invalid={invalido || undefined}>
      <option value="">{vacio}</option>
      {cajitas
        .filter((c) => c.activa || c.id === valor)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre} · {dinero(c.saldo)}
          </option>
        ))}
    </Selector>
  )
}
