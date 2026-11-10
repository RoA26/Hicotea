import { useState, type FormEvent } from 'react'
import { recurrentes } from '../api/cliente'
import type { Recurrente } from '../api/tipos'
import { useEnvio } from '../lib/datos'
import { dinero, hoy, montoEditable } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'
import { Modal } from './Modal'
import { AlertaError, Boton, Campo, Entrada, EntradaMonto } from './ui'

/** Confirma un recurrente (registra el movimiento del periodo y avanza la fecha). */
export function ConfirmarRecurrente({ recurrente, onCerrar, alTerminar }: { recurrente: Recurrente | null; onCerrar: () => void; alTerminar: () => void }) {
  return (
    <Modal abierto={!!recurrente} onCerrar={onCerrar} titulo={recurrente ? `Confirmar ${recurrente.nombre}` : ''}>
      {recurrente && <Formulario key={recurrente.id} recurrente={recurrente} onCerrar={onCerrar} alTerminar={alTerminar} />}
    </Modal>
  )
}

function Formulario({ recurrente, onCerrar, alTerminar }: { recurrente: Recurrente; onCerrar: () => void; alTerminar: () => void }) {
  const registrado = useRegistroRapido()
  const { enviando, error, errores, enviar } = useEnvio()
  // Si ya pasó la fecha se propone esa; si no, hoy (la api no acepta fechas futuras).
  const [f, setF] = useState(() => ({
    fecha: recurrente.proxima_fecha < hoy() ? recurrente.proxima_fecha : hoy(),
    monto: montoEditable(recurrente.monto),
  }))

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => recurrentes.confirmar(recurrente.id, f))
    if (r) {
      registrado(r)
      alTerminar()
    }
  }

  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <p className="text-sm text-texto-suave">
        {recurrente.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'} de {dinero(recurrente.monto)} en {recurrente.nombre_categoria}
        {recurrente.nombre_cajita_origen ? `, pagado desde ${recurrente.nombre_cajita_origen}` : ''}. Ajusta el monto si esta vez fue distinto.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Monto" error={errores.monto}>
          <EntradaMonto value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} required />
        </Campo>
        <Campo etiqueta="Fecha" error={errores.fecha}>
          <Entrada type="date" value={f.fecha} max={hoy()} onChange={(e) => setF({ ...f, fecha: e.target.value })} required />
        </Campo>
      </div>
      <AlertaError mensaje={error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={enviando}>
          Registrar
        </Boton>
      </div>
    </form>
  )
}
