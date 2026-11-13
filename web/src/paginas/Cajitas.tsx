import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { cajitas as api, type CajitaForm } from '../api/cliente'
import type { Cajita, PropositoCajita } from '../api/tipos'
import { useAvisar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import {
  AlertaError,
  Boton,
  BotonEnlace,
  Campo,
  Cargando,
  Cifra,
  Encabezado,
  Entrada,
  EntradaMonto,
  ErrorCarga,
  Insignia,
  Interruptor,
  Selector,
  Tarjeta,
  Vacio,
} from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import {
  DESCRIPCION_PROPOSITO,
  dinero,
  formatoPorcentaje,
  NOMBRE_PROPOSITO,
  numero,
  porcentajeNumero,
} from '../lib/formato'

const PROPOSITOS = Object.keys(NOMBRE_PROPOSITO) as PropositoCajita[]

const PRESETS = [5, 10, 15, 20, 25, 30, 40, 50]

/* Colores visuales accesibles para las cajitas en el visualizador del caparazón */
const COLORES_CAPARAZON = [
  'bg-acento',
  'bg-acento-vivo',
  'bg-sky-400 dark:bg-sky-500',
  'bg-amber-400 dark:bg-amber-500',
  'bg-purple-400 dark:bg-purple-500',
  'bg-emerald-400 dark:bg-emerald-500',
  'bg-teal-400 dark:bg-teal-500',
]

/** Visualizador segmentado del 100% del reparto (el caparazón de Hicotea) */
function VisualizadorCaparazon({ cajitas }: { cajitas: Cajita[] }) {
  const activas = cajitas.filter((c) => c.activa)
  const sumaFija = activas
    .filter((c) => !c.es_resto)
    .reduce((s, c) => s + porcentajeNumero(c.porcentaje), 0)
  const cajitaResto = activas.find((c) => c.es_resto)
  const porcentajeResto = Math.max(0, 100 - sumaFija)

  return (
    <div className="space-y-2">
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-superficie-2 border border-borde p-0.5">
        {activas
          .filter((c) => !c.es_resto && porcentajeNumero(c.porcentaje) > 0)
          .map((c, idx) => {
            const pct = porcentajeNumero(c.porcentaje)
            const color = COLORES_CAPARAZON[idx % COLORES_CAPARAZON.length]
            return (
              <div
                key={c.id}
                title={`${c.nombre}: ${formatoPorcentaje(c.porcentaje)}`}
                className={`h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 ${color}`}
                style={{ width: `${pct}%` }}
              />
            )
          })}
        {cajitaResto && porcentajeResto > 0 && (
          <div
            title={`${cajitaResto.nombre} (Resto): ${formatoPorcentaje(porcentajeResto)}`}
            className="h-full rounded-r-full bg-acento/40 border-l border-acento/60 transition-all duration-300"
            style={{ width: `${porcentajeResto}%` }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
        {activas
          .filter((c) => !c.es_resto && porcentajeNumero(c.porcentaje) > 0)
          .map((c, idx) => {
            const color = COLORES_CAPARAZON[idx % COLORES_CAPARAZON.length]
            return (
              <span key={c.id} className="inline-flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${color}`} />
                <span className="font-medium text-texto">{c.nombre}</span>
                <span>{formatoPorcentaje(c.porcentaje)}</span>
              </span>
            )
          })}
        {cajitaResto && (
          <span className="inline-flex items-center gap-1.5 text-acento">
            <span className="size-2 rounded-full bg-acento/60" />
            <span className="font-medium">{cajitaResto.nombre}</span>
            <span>(Resto: {formatoPorcentaje(porcentajeResto)})</span>
          </span>
        )}
        {!cajitaResto && sumaFija < 100 && (
          <span className="inline-flex items-center gap-1.5 text-aviso">
            <span className="size-2 rounded-full bg-aviso/60" />
            <span>Sin asignar ({formatoPorcentaje(100 - sumaFija)})</span>
          </span>
        )}
      </div>
    </div>
  )
}

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
    proposito: cajita?.proposito ?? 'LIBRE',
    porcentaje: cajita ? String(porcentajeNumero(cajita.porcentaje)) : '10',
    es_resto: cajita?.es_resto ?? false,
    saldo_inicial: '',
  })
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
      saldo_inicial: f.saldo_inicial || null,
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

      <Campo etiqueta="Propósito" error={errores.proposito} ayuda={DESCRIPCION_PROPOSITO[f.proposito]}>
        <Selector value={f.proposito} onChange={(e) => pon({ proposito: e.target.value as PropositoCajita })}>
          {PROPOSITOS.map((p) => (
            <option key={p} value={p}>
              {NOMBRE_PROPOSITO[p]}
            </option>
          ))}
        </Selector>
      </Campo>

      <div className="rounded-2xl border border-borde bg-superficie-2 p-3 space-y-2">
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
              <div className="flex items-center justify-between rounded-2xl border border-borde bg-superficie-2 p-2">
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
                      className={`h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
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
            className={`rounded-xl px-3 py-2 text-xs border ${
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

      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando} disabled={!f.es_resto && excedeCien}>
        Guardar
      </Boton>
    </form>
  )
}

export default function Cajitas() {
  const avisar = useAvisar()
  const { version } = useSaldo()
  const lista = useDatos(api.listar, [version])
  const [nueva, setNueva] = useState(false)

  const activas = lista.datos?.filter((c) => c.activa) ?? []
  const total = activas.reduce((s, c) => s + numero(c.saldo), 0)
  const suma = activas
    .filter((c) => !c.es_resto)
    .reduce((s, c) => s + porcentajeNumero(c.porcentaje), 0)
  const hayResto = activas.some((c) => c.es_resto)

  return (
    <>
      <Encabezado
        titulo="Cajitas"
        subtitulo="Cada cajita es una placa del caparazón: plata apartada con un propósito."
        acciones={
          <>
            <BotonEnlace to="/cajitas/reparto" variante="secundario">
              Repartir
            </BotonEnlace>
            <Boton onClick={() => setNueva(true)}>
              <Icono nombre="mas" /> Nueva cajita
            </Boton>
          </>
        }
      />

      {lista.error ? (
        <ErrorCarga error={lista.error} reintentar={lista.recargar} />
      ) : !lista.datos ? (
        <Cargando />
      ) : lista.datos.length === 0 ? (
        <Vacio accion={<Boton onClick={() => setNueva(true)}>Crear la primera cajita</Boton>}>
          Aparta plata para capital, emergencias o compras. Al repartir, Hicotea la distribuye según tus porcentajes.
        </Vacio>
      ) : (
        <div className="space-y-6">
          {/* Tarjeta de métricas y visualizador del Caparazón */}
          <Tarjeta className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Cifra etiqueta="Total guardado en cajitas" valor={String(total)} grande />
              <div>
                <p className="text-xs text-texto-suave">Distribución del reparto</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="cifra text-2xl font-bold">{formatoPorcentaje(suma)}</p>
                  {hayResto ? (
                    <Insignia tono="acento">+ Cajita de resto</Insignia>
                  ) : suma === 100 ? (
                    <Insignia tono="acento">100% Asignado</Insignia>
                  ) : (
                    <Insignia tono="aviso">Falta {formatoPorcentaje(100 - suma)}</Insignia>
                  )}
                </div>
                {!hayResto && suma < 100 && (
                  <p className="mt-1 text-xs text-aviso">
                    Al repartir sobrará dinero a menos que asignes el {formatoPorcentaje(100 - suma)} faltante o marques una cajita como resto.
                  </p>
                )}
              </div>
            </div>

            {/* Barra gráfica del caparazón */}
            <div className="border-t border-borde pt-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-texto-suave uppercase">
                Caparazón de ahorro
              </p>
              <VisualizadorCaparazon cajitas={lista.datos} />
            </div>
          </Tarjeta>

          {/* Cuadrícula de cajitas */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.datos.map((c) => (
              <Link
                key={c.id}
                to={`/cajitas/${c.id}`}
                className="group relative block rounded-2xl border border-borde bg-superficie p-4 transition-all hover:border-acento/60 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-semibold text-texto group-hover:text-acento transition-colors">
                    {c.nombre}
                  </h2>
                  {!c.activa ? (
                    <Insignia>Inactiva</Insignia>
                  ) : (
                    <Insignia tono={c.es_resto ? 'acento' : 'suave'}>
                      {c.es_resto ? 'Resto' : formatoPorcentaje(c.porcentaje)}
                    </Insignia>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-texto-suave">{NOMBRE_PROPOSITO[c.proposito]}</p>
                <div className="mt-4 flex items-baseline justify-between border-t border-borde pt-3">
                  <span className="text-xs text-texto-suave">Saldo</span>
                  <p className="cifra text-2xl font-bold">{dinero(c.saldo)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Modal abierto={nueva} onCerrar={() => setNueva(false)} titulo="Nueva cajita">
        {nueva && (
          <FormCajita
            cajita={null}
            cajitasOtras={lista.datos ?? []}
            alGuardar={() => {
              setNueva(false)
              avisar('Cajita creada.')
              void lista.recargar()
            }}
          />
        )}
      </Modal>
    </>
  )
}
