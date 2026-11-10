import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { cajitas as api, ErrorApi } from '../api/cliente'
import type { PropuestaReparto } from '../api/tipos'
import { useAvisar, useSaldo } from '../componentes/Globales'
import { AlertaError, Boton, Campo, Cargando, Cifra, Encabezado, EntradaMonto, ErrorCarga, Tarjeta, Vacio } from '../componentes/ui'
import { useEnvio } from '../lib/datos'
import { dinero, montoEditable } from '../lib/formato'

export default function Reparto() {
  const navegar = useNavigate()
  const avisar = useAvisar()
  const { avisarCambio } = useSaldo()
  const [monto, setMonto] = useState('')
  const [propuesta, setPropuesta] = useState<PropuestaReparto | null>(null)
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null)
  const [lineas, setLineas] = useState<Record<number, string>>({})
  const calcular = useEnvio()
  const confirmar = useEnvio()

  async function proponer(m?: string) {
    const p = await calcular.enviar(() => api.proponerReparto(m || undefined))
    if (p) {
      setPropuesta(p)
      setLineas(Object.fromEntries(p.lineas.map((l) => [l.id_cajita, montoEditable(l.monto)])))
    }
  }

  useEffect(() => {
    api.proponerReparto().then(
      (p) => {
        setPropuesta(p)
        setMonto(montoEditable(p.monto_a_repartir))
        setLineas(Object.fromEntries(p.lineas.map((l) => [l.id_cajita, montoEditable(l.monto)])))
      },
      (e) => setErrorCarga(e),
    )
  }, [])

  async function alConfirmar(e: FormEvent) {
    e.preventDefault()
    const r = await confirmar.enviar(() =>
      api.confirmarReparto(Object.entries(lineas).filter(([, m]) => m.trim() !== '').map(([id, m]) => ({ id_cajita: Number(id), monto: m }))),
    )
    if (r) {
      avisar(r.mensaje)
      avisarCambio()
      navegar('/cajitas')
    }
  }

  if (errorCarga) return <ErrorCarga error={errorCarga} reintentar={() => window.location.reload()} />
  if (!propuesta) return <Cargando />

  return (
    <>
      <Encabezado titulo="Repartir" subtitulo="Distribuye lo disponible entre tus cajitas según sus porcentajes." />
      <Tarjeta className="mb-4 max-w-lg">
        <Cifra etiqueta="Disponible para repartir" valor={propuesta.disponible} grande />
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void proponer(monto)
          }}
        >
          <Campo etiqueta="¿Cuánto quieres repartir?" error={calcular.errores.monto} className="flex-1">
            <EntradaMonto value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Todo lo disponible" />
          </Campo>
          <Boton type="submit" variante="secundario" cargando={calcular.enviando}>
            Calcular
          </Boton>
        </form>
        {!calcular.errores.monto && <AlertaError mensaje={calcular.error} />}
      </Tarjeta>

      {propuesta.lineas.length === 0 ? (
        <Vacio>No tienes cajitas activas para repartir.</Vacio>
      ) : (
        <Tarjeta className="max-w-lg">
          {propuesta.porcentajes_incompletos && !propuesta.hay_resto && (
            <p className="mb-3 rounded-xl border border-aviso/30 bg-aviso/10 px-3 py-2 text-sm text-aviso">
              Los porcentajes suman {Number(propuesta.suma_porcentajes)}% y ninguna cajita recibe el resto: sobran {dinero(propuesta.sobrante)}.
            </p>
          )}
          <form onSubmit={alConfirmar} className="space-y-3">
            {propuesta.lineas.map((l) => (
              <Campo key={l.id_cajita} etiqueta={l.nombre}>
                <EntradaMonto value={lineas[l.id_cajita] ?? ''} onChange={(e) => setLineas({ ...lineas, [l.id_cajita]: e.target.value })} />
              </Campo>
            ))}
            <p className="text-xs text-texto-suave">Puedes ajustar cada monto antes de confirmar.</p>
            <AlertaError mensaje={confirmar.error} />
            <Boton type="submit" className="w-full" cargando={confirmar.enviando}>
              Confirmar reparto
            </Boton>
          </form>
        </Tarjeta>
      )}
    </>
  )
}
