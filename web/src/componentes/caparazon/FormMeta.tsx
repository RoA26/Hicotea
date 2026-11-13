import { useState, type FormEvent } from 'react'
import { metas as api, type MetaForm } from '../../api/cliente'
import type { Meta } from '../../api/tipos'
import { useEnvio } from '../../lib/datos'
import { hoy, montoEditable } from '../../lib/formato'
import { AlertaError, Boton, Campo, Entrada, EntradaMonto } from '../ui'

/** Meta de una cajita concreta (crear o editar). La cajita no se elige aquí: es la del detalle. */
export function FormMeta({ meta, idCajita, nombreCajita, alGuardar }: { meta: Meta | null; idCajita: number; nombreCajita: string; alGuardar: () => void }) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<MetaForm>({
    nombre: meta?.nombre ?? nombreCajita,
    monto_objetivo: montoEditable(meta?.monto_objetivo),
    fecha_objetivo: meta?.fecha_objetivo ?? null,
    id_cajita: idCajita,
  })
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => (meta ? api.actualizar(meta.id, f) : api.crear(f)))
    if (r) alGuardar()
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="¿Para qué ahorras?" error={errores.nombre}>
        <Entrada value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
      </Campo>
      <Campo etiqueta="Monto objetivo" error={errores.monto_objetivo}>
        <EntradaMonto value={f.monto_objetivo} onChange={(e) => setF({ ...f, monto_objetivo: e.target.value })} required />
      </Campo>
      <Campo etiqueta="Fecha objetivo (opcional)" error={errores.fecha_objetivo} ayuda="Con fecha, Hicotea calcula cuánto aportar al mes.">
        <Entrada type="date" min={meta ? undefined : hoy()} value={f.fecha_objetivo ?? ''} onChange={(e) => setF({ ...f, fecha_objetivo: e.target.value || null })} />
      </Campo>
      <p className="text-xs text-texto-suave">El progreso es el saldo de esta cajita. Una cajita tiene como máximo una meta activa.</p>
      {errores.id_cajita && <AlertaError mensaje={errores.id_cajita} />}
      <AlertaError mensaje={errores.id_cajita ? null : error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
        Guardar meta
      </Boton>
    </form>
  )
}
