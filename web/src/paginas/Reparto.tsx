import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { cajitas as api, ErrorApi } from '../api/cliente'
import type { Cajita, PropuestaReparto } from '../api/tipos'
import { useAvisar, useSaldo } from '../componentes/Globales'
import {
  AlertaError,
  Boton,
  Campo,
  Cargando,
  Cifra,
  cx,
  Encabezado,
  EntradaMonto,
  ErrorCarga,
  Insignia,
  Tarjeta,
  Vacio,
} from '../componentes/ui'
import { useEnvio } from '../lib/datos'
import { dinero, formatoPorcentaje, montoEditable, numero, parsearMonto } from '../lib/formato'

/**
 * Repartir lo disponible entre las cajitas. Las reglas (redondeo a pesos,
 * cajita resto, tope del disponible, todo-o-nada) viven en la API
 * (servicios/cajitas.py). Esta pantalla solo guía: muestra el porcentaje de
 * cada cajita, lo sugerido, cuánto queda en el disponible y avisa en vivo
 * de montos mal escritos, con las mismas reglas de lectura que la API.
 */
export default function Reparto() {
  const navegar = useNavigate()
  const avisar = useAvisar()
  const { avisarCambio } = useSaldo()
  const [monto, setMonto] = useState('')
  const [propuesta, setPropuesta] = useState<PropuestaReparto | null>(null)
  const [cajitas, setCajitas] = useState<Record<number, Cajita>>({})
  const [errorCarga, setErrorCarga] = useState<ErrorApi | null>(null)
  const [lineas, setLineas] = useState<Record<number, string>>({})
  const calcular = useEnvio()
  const confirmar = useEnvio()

  function aplicar(p: PropuestaReparto) {
    setPropuesta(p)
    setLineas(Object.fromEntries(p.lineas.map((l) => [l.id_cajita, montoEditable(l.monto)])))
  }

  async function proponer(m?: string) {
    const p = await calcular.enviar(() => api.proponerReparto(m || undefined))
    if (p) aplicar(p)
  }

  useEffect(() => {
    api.proponerReparto().then(
      (p) => {
        aplicar(p)
        setMonto(montoEditable(p.monto_a_repartir))
      },
      (e) => setErrorCarga(e),
    )
    // Solo para mostrar porcentaje y "Resto" en cada línea; si falla, el reparto sigue funcionando.
    api.listar().then(
      (cs) => setCajitas(Object.fromEntries(cs.map((c) => [c.id, c]))),
      () => {},
    )
  }, [])

  if (errorCarga) return <ErrorCarga error={errorCarga} reintentar={() => window.location.reload()} />
  if (!propuesta) return <Cargando />

  const sugerido = Object.fromEntries(propuesta.lineas.map((l) => [l.id_cajita, numero(l.monto)]))
  const leidos = propuesta.lineas.map((l) => ({ id: l.id_cajita, valor: parsearMonto(lineas[l.id_cajita]) }))
  const invalidos = new Set(leidos.filter((l) => Number.isNaN(l.valor)).map((l) => l.id))
  const sumaLineas = leidos.reduce((s, l) => s + (l.valor && !Number.isNaN(l.valor) ? l.valor : 0), 0)
  const disponible = numero(propuesta.disponible)
  const queda = Math.round((disponible - sumaLineas) * 100) / 100
  const excedeDisponible = queda < 0
  const editado = propuesta.lineas.some((l) => (parsearMonto(lineas[l.id_cajita]) ?? 0) !== sugerido[l.id_cajita])
  const puedeConfirmar = sumaLineas > 0 && !excedeDisponible && invalidos.size === 0

  async function alConfirmar(e: FormEvent) {
    e.preventDefault()
    if (!puedeConfirmar) return
    const r = await confirmar.enviar(() =>
      api.confirmarReparto(
        Object.entries(lineas)
          .filter(([, m]) => m.trim() !== '')
          .map(([id, m]) => ({ id_cajita: Number(id), monto: m })),
      ),
    )
    if (r) {
      avisar(r.mensaje)
      avisarCambio()
      navegar('/caparazon')
    }
  }

  return (
    <>
      <Encabezado
        titulo="Repartir"
        subtitulo={
          <span className="flex flex-col gap-1">
            <Link to="/caparazon" className="-my-3 inline-flex min-h-11 items-center self-start text-sm text-acento hover:underline">
              ← Caparazón
            </Link>
            <span>Distribuye lo disponible entre las cajitas de tu caparazón según sus porcentajes.</span>
          </span>
        }
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Tarjeta className="h-fit space-y-4">
          <Cifra etiqueta="Disponible para repartir" valor={propuesta.disponible} grande />
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void proponer(monto)
            }}
          >
            <Campo etiqueta="¿Cuánto quieres repartir?" error={calcular.errores.monto} className="flex-1">
              <EntradaMonto
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Todo lo disponible"
              />
            </Campo>
            <Boton type="submit" variante="secundario" cargando={calcular.enviando}>
              Calcular
            </Boton>
          </form>
          {!calcular.errores.monto && <AlertaError mensaje={calcular.error} />}
          <p className="text-xs text-texto-suave">
            Cada cajita recibe su porcentaje redondeado a pesos enteros
            {propuesta.hay_resto ? '; la cajita resto recibe lo que sobra.' : '.'}
          </p>

          {propuesta.porcentajes_incompletos && !propuesta.hay_resto && (
            <p className="rounded-control border border-aviso/30 bg-aviso/10 px-3 py-2 text-xs text-aviso">
              Los porcentajes de tus cajitas suman {formatoPorcentaje(propuesta.suma_porcentajes)} y ninguna cajita recibe el resto: sobran {dinero(propuesta.sobrante)}, que se quedan en el disponible.
            </p>
          )}
        </Tarjeta>

        {propuesta.lineas.length === 0 ? (
          <Vacio>No tienes cajitas activas para repartir.</Vacio>
        ) : (
          <Tarjeta className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-borde pb-3">
              <h2 className="text-sm font-semibold tracking-wide text-texto uppercase">
                Distribución propuesta
              </h2>
              {editado && (
                <Boton
                  type="button"
                  variante="fantasma"
                  chico
                  onClick={() => aplicar(propuesta)}
                >
                  Volver a lo sugerido
                </Boton>
              )}
            </div>

            <form onSubmit={alConfirmar} className="space-y-3" noValidate>
              {propuesta.lineas.map((l) => {
                const c = cajitas[l.id_cajita]
                const valor = parsearMonto(lineas[l.id_cajita])
                const cambiado = (valor ?? 0) !== sugerido[l.id_cajita] && !Number.isNaN(valor)
                return (
                  <Campo
                    key={l.id_cajita}
                    etiqueta={
                      <span className="flex items-center gap-2">
                        <span className="truncate">{l.nombre}</span>
                        {c && <Insignia tono={c.es_resto ? 'acento' : 'suave'}>{c.es_resto ? 'Resto' : formatoPorcentaje(c.porcentaje)}</Insignia>}
                      </span>
                    }
                    error={invalidos.has(l.id_cajita) ? 'Escribe el monto solo con números, por ejemplo 85000 o 85.000.' : undefined}
                    ayuda={cambiado ? <>Sugerido: <span className="cifra">{dinero(l.monto)}</span></> : undefined}
                  >
                    <EntradaMonto
                      value={lineas[l.id_cajita] ?? ''}
                      aria-invalid={invalidos.has(l.id_cajita) || undefined}
                      onChange={(e) => setLineas({ ...lineas, [l.id_cajita]: e.target.value })}
                    />
                  </Campo>
                )
              })}

              <dl className="space-y-1.5 rounded-control border border-borde bg-superficie-2 px-3 py-2.5 text-sm" aria-live="polite">
                <div className="flex justify-between gap-3">
                  <dt className="text-texto-suave">Asignado</dt>
                  <dd className={cx('cifra font-semibold', excedeDisponible && 'text-gasto')}>{dinero(sumaLineas)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texto-suave">Queda en el disponible</dt>
                  <dd className={cx('cifra font-semibold', excedeDisponible && 'text-gasto')}>{dinero(queda)}</dd>
                </div>
              </dl>

              {excedeDisponible && (
                <p className="rounded-control border border-gasto/30 bg-gasto/10 px-3 py-2 text-xs text-gasto" role="alert">
                  La suma del reparto ({dinero(sumaLineas)}) supera lo disponible ({dinero(propuesta.disponible)}). Reduce los montos antes de continuar.
                </p>
              )}

              <AlertaError mensaje={confirmar.error} />
              <Boton
                type="submit"
                className="w-full"
                cargando={confirmar.enviando}
                disabled={!puedeConfirmar}
              >
                {sumaLineas > 0 ? `Confirmar reparto de ${dinero(sumaLineas)}` : 'Asigna un monto para repartir'}
              </Boton>
            </form>
          </Tarjeta>
        )}
      </div>
    </>
  )
}
