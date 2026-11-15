import { useState } from 'react'
import { Link } from 'react-router'
import { atajos as apiAtajos } from '../api/cliente'
import type { Atajo } from '../api/tipos'
import { useDatos } from '../lib/datos'
import { dinero } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'
import { useAvisar } from './Globales'
import { Icono } from './Iconos'
import { Modal } from './Modal'
import { cx } from './ui'

/** Contenido de la hoja: se monta solo mientras está abierta (los atajos se piden al abrir). */
function Opciones({ alElegir }: { alElegir: () => void }) {
  const lista = useDatos(apiAtajos.listar)
  const registrado = useRegistroRapido()
  const avisar = useAvisar()
  const [usando, setUsando] = useState<number | null>(null)

  async function usar(a: Atajo) {
    setUsando(a.id)
    try {
      registrado(await apiAtajos.usar(a.id))
      alElegir()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    } finally {
      setUsando(null)
    }
  }

  const opcion = 'flex min-h-14 items-center gap-3 rounded-control border border-borde bg-superficie-2 px-4 font-medium transition-colors hover:border-acento/60'
  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Link to="/movimientos/nuevo?tipo=GASTO" onClick={alElegir} className={opcion}>
          <span aria-hidden className="cifra grid size-8 place-items-center rounded-full bg-gasto/15 text-lg text-gasto">−</span>
          Gasto
        </Link>
        <Link to="/movimientos/nuevo?tipo=INGRESO" onClick={alElegir} className={opcion}>
          <span aria-hidden className="cifra grid size-8 place-items-center rounded-full bg-ingreso/15 text-lg text-ingreso">+</span>
          Ingreso
        </Link>
        <Link to="/producido" onClick={alElegir} className={opcion}>
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-acento/15 text-acento">
            <Icono nombre="fuentes" className="size-4" />
          </span>
          <span>
            Producido del día
            <span className="block text-xs font-normal text-texto-suave">Lo que hizo una fuente y lo que costó</span>
          </span>
        </Link>
      </div>

      {lista.datos && lista.datos.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-texto-suave">Atajos (un toque)</p>
          <div className="flex flex-wrap gap-2">
            {lista.datos.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={usando !== null}
                aria-busy={usando === a.id || undefined}
                onClick={() => usar(a)}
                className={cx(
                  'cifra min-h-11 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-50',
                  a.tipo === 'INGRESO' ? 'border-ingreso/30 hover:bg-ingreso/10' : 'border-gasto/30 hover:bg-gasto/10',
                )}
              >
                {a.nombre} · {a.tipo === 'INGRESO' ? '+ ' : '− '}
                {dinero(a.monto)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Hoja "Registrar": gasto, ingreso, producido y atajos a un toque desde cualquier pantalla. */
export function HojaRegistrar({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  return (
    <Modal abierto={abierta} onCerrar={onCerrar} titulo="Registrar">
      {abierta && <Opciones alElegir={onCerrar} />}
    </Modal>
  )
}
