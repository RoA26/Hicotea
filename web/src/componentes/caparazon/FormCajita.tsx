import { useState, type FormEvent } from 'react'
import { cajitas as api, type CajitaForm } from '../../api/cliente'
import type { Cajita, PropositoCajita } from '../../api/tipos'
import { useEnvio } from '../../lib/datos'
import { DESCRIPCION_PROPOSITO, formatoPorcentaje, hoy, NOMBRE_PROPOSITO, porcentajeNumero } from '../../lib/formato'
import { AlertaError, Boton, Campo, Entrada, EntradaMonto, Interruptor, Selector } from '../ui'

const PROPOSITOS = Object.keys(NOMBRE_PROPOSITO) as PropositoCajita[]

const PRESETS = [5, 10, 15, 20, 25, 30, 40, 50]

/**
 * Formulario de cajita del Caparazón (crear y editar). Al crear permite una
 * meta opcional: la API crea ambas en una transacción (POST /cajitas con
 * `meta`), así que si la meta falla no queda una cajita a medias.
 */
export function FormCajita({
  cajita,
  cajitasOtras = [],
  alGuardar,
}: {
  cajita: Cajita | null
  cajitasOtras?: Cajita[]
  alGuardar: (c: Cajita) => void
}) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<CajitaForm>({
    nombre: cajita?.nombre ?? '',
    descripcion: cajita?.descripcion ?? '',
    proposito: cajita?.proposito ?? 'LIBRE',
    porcentaje: cajita ? String(porcentajeNumero(cajita.porcentaje)) : '10',
    es_resto: cajita?.es_resto ?? false,
    saldo_inicial: '',
  })
  const [conMeta, setConMeta] = useState(false)
  const [meta, setMeta] = useState({ nombre: '', monto_objetivo: '', fecha_objetivo: '' })
  const [modoManual, setModoManual] = useState(
    cajita ? porcentajeNumero(cajita.porcentaje) % 5 !== 0 : false,
  )

  const pon = (c: Partial<CajitaForm>) => setF((x) => ({ ...x, ...c }))

  /* Suma de porcentajes de las demás cajitas activas */
  const sumaOtras = cajitasOtras
    .filter((c) => c.activa && c.id !== cajita?.id && !c.es_resto)
    .reduce((s, c) => s + porcentajeNumero(c.porcentaje), 0)

  const valorActual = Number(f.porcentaje || 0)
  const sumaConEsta = f.es_resto ? sumaOtras : sumaOtras + valorActual
  const excedeCien = sumaConEsta > 100

  function ajustarCinco(delta: number) {
    const actual = Math.round(Number(f.porcentaje || 0) / 5) * 5
    const nuevo = Math.min(100, Math.max(0, actual + delta))
    pon({ porcentaje: String(nuevo) })
  }

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const datos = {
      ...f,
      porcentaje: f.es_resto ? '0' : String(Number(f.porcentaje || 0)),
      descripcion: f.descripcion?.trim() || null,
      saldo_inicial: f.saldo_inicial || null,
      meta:
        !cajita && conMeta
          ? { nombre: meta.nombre.trim() || null, monto_objetivo: meta.monto_objetivo, fecha_objetivo: meta.fecha_objetivo || null }
          : null,
    }
    const r = await enviar(() => (cajita ? api.actualizar(cajita.id, datos) : api.crear(datos)))
    if (r) alGuardar(r)
  }

  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="Nombre" error={errores.nombre}>
        <Entrada
          value={f.nombre}
          maxLength={40}
          onChange={(e) => pon({ nombre: e.target.value })}
          placeholder="Ej. Fondo de emergencia"
          required
        />
      </Campo>

      <Campo etiqueta="Descripción (opcional)" error={errores.descripcion} ayuda="Para qué es esta plata, en tus palabras.">
        <Entrada
          value={f.descripcion ?? ''}
          maxLength={200}
          onChange={(e) => pon({ descripcion: e.target.value })}
          placeholder="Ej. Tres meses de gastos por si algo pasa"
        />
      </Campo>

      <Campo etiqueta="Propósito" error={errores.proposito} ayuda={DESCRIPCION_PROPOSITO[f.proposito]}>
        <Selector value={f.proposito} onChange={(e) => pon({ proposito: e.target.value as PropositoCajita })}>
          {PROPOSITOS.map((p) => (
            <option key={p} value={p}>
              {NOMBRE_PROPOSITO[p]}
            </option>
          ))}
        </Selector>
      </Campo>

      <div className="rounded-tarjeta border border-borde bg-superficie-2 p-3 space-y-2">
        <Interruptor
          etiqueta="Recibe el resto del reparto"
          marcado={f.es_resto}
          onCambio={(es_resto) => pon({ es_resto })}
        />
        <p className="text-xs text-texto-suave">
          {f.es_resto
            ? 'Esta cajita absorberá automáticamente todo lo que sobre al repartir (incluyendo redondeos).'
            : 'Asigna un porcentaje específico de lo que esté disponible al hacer un reparto.'}
        </p>
      </div>

      {!f.es_resto && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-texto-suave">Porcentaje del reparto</span>
            <button
              type="button"
              onClick={() => setModoManual(!modoManual)}
              className="text-xs text-acento hover:underline"
            >
              {modoManual ? 'Usar incrementos de 5%' : 'Porcentaje personalizado'}
            </button>
          </div>

          {!modoManual ? (
            <div className="space-y-3">
              {/* Stepper de incrementos de 5 puntos porcentuales */}
              <div className="flex items-center justify-between rounded-tarjeta border border-borde bg-superficie-2 p-2">
                <Boton
                  type="button"
                  variante="secundario"
                  chico
                  onClick={() => ajustarCinco(-5)}
                  disabled={valorActual <= 0}
                >
                  − 5%
                </Boton>
                <div className="text-center">
                  <span className="cifra text-2xl font-bold tracking-tight text-acento">
                    {formatoPorcentaje(f.porcentaje)}
                  </span>
                </div>
                <Boton
                  type="button"
                  variante="secundario"
                  chico
                  onClick={() => ajustarCinco(5)}
                  disabled={valorActual >= 100}
                >
                  + 5%
                </Boton>
              </div>

              {/* Presets rápidos */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const activo = valorActual === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => pon({ porcentaje: String(p) })}
                      className={`h-9 rounded-interno px-2.5 text-xs font-semibold transition-colors ${
                        activo
                          ? 'bg-acento text-sobre-acento'
                          : 'bg-superficie border border-borde text-texto-suave hover:border-acento/50 hover:text-texto'
                      }`}
                    >
                      {p}%
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <Campo
              etiqueta="Porcentaje exacto"
              error={errores.porcentaje}
              ayuda="Puedes ingresar valores decimales (ej. 12.5 o 33.33)."
            >
              <Entrada
                type="number"
                min={0}
                max={100}
                step="0.01"
                inputMode="decimal"
                value={f.porcentaje}
                onChange={(e) => pon({ porcentaje: e.target.value })}
                required
              />
            </Campo>
          )}

          {/* Feedback de suma total */}
          <div
            className={`rounded-control px-3 py-2 text-xs border ${
              excedeCien
                ? 'border-gasto/30 bg-gasto/10 text-gasto'
                : 'border-borde bg-superficie text-texto-suave'
            }`}
          >
            Suma de tus cajitas:{' '}
            <strong className={excedeCien ? 'text-gasto font-bold' : 'text-texto'}>
              {formatoPorcentaje(sumaConEsta)}
            </strong>{' '}
            de 100% {excedeCien ? '(supera el máximo permitido)' : `(disponible para otras: ${formatoPorcentaje(Math.max(0, 100 - sumaConEsta))})`}
          </div>
        </div>
      )}

      {!cajita && (
        <Campo
          etiqueta="Saldo que ya tenía (opcional)"
          error={errores.saldo_inicial}
          ayuda="Si ya tenías esta plata guardada antes de usar Hicotea."
        >
          <EntradaMonto
            value={f.saldo_inicial ?? ''}
            onChange={(e) => pon({ saldo_inicial: e.target.value })}
          />
        </Campo>
      )}

      {!cajita && (
        <fieldset className="space-y-3 rounded-tarjeta border border-borde p-3">
          <legend className="px-1 text-sm font-medium text-texto-suave">Meta de ahorro</legend>
          <Interruptor etiqueta="Esta cajita tiene una meta" marcado={conMeta} onCambio={setConMeta} />
          {conMeta && (
            <>
              <Campo etiqueta="Monto objetivo" error={errores.meta_monto_objetivo}>
                <EntradaMonto
                  value={meta.monto_objetivo}
                  onChange={(e) => setMeta({ ...meta, monto_objetivo: e.target.value })}
                  aria-invalid={!!errores.meta_monto_objetivo || undefined}
                  required
                />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre de la meta (opcional)" error={errores.meta_nombre} ayuda="Si lo dejas vacío, se llama como la cajita.">
                  <Entrada value={meta.nombre} maxLength={60} onChange={(e) => setMeta({ ...meta, nombre: e.target.value })} />
                </Campo>
                <Campo etiqueta="Fecha objetivo (opcional)" error={errores.meta_fecha_objetivo}>
                  <Entrada
                    type="date"
                    min={hoy()}
                    value={meta.fecha_objetivo}
                    onChange={(e) => setMeta({ ...meta, fecha_objetivo: e.target.value })}
                  />
                </Campo>
              </div>
              <p className="text-xs text-texto-suave">
                La cajita y su meta se crean juntas: si algo de la meta no es válido, no se crea ninguna de las dos.
              </p>
            </>
          )}
        </fieldset>
      )}

      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando} disabled={!f.es_resto && excedeCien}>
        Guardar
      </Boton>
    </form>
  )
}
