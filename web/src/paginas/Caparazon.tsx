import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { cajitas as apiCajitas, metas as apiMetas } from '../api/cliente'
import { armarCaparazon, placasDe, type CajitaCaparazon } from '../componentes/caparazon/datos'
import { FormCajita } from '../componentes/caparazon/FormCajita'
import { MetricasCajita } from '../componentes/caparazon/Metricas'
import { MuestraSerie, ProporcionAhorro } from '../componentes/caparazon/ProporcionAhorro'
import { PLACAS, Tortuga } from '../componentes/caparazon/Tortuga'
import { useAvisar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { Boton, BotonEnlace, Cargando, Cifra, Encabezado, ErrorCarga, Insignia, Seccion, Tarjeta, Vacio } from '../componentes/ui'
import { useDatos } from '../lib/datos'
import { dinero, fechaLarga, formatoPorcentaje } from '../lib/formato'

/**
 * Caparazón: la experiencia unificada del ahorro (cajitas, metas, reparto,
 * proporción del dinero protegido, historial y archivo). Todas las cifras
 * salen de la API (`/cajitas`, `/metas`); aquí no se recalcula ninguna regla.
 * La cajita seleccionada vive en la URL (`?cajita=`) para volver al mismo punto.
 */
export default function Caparazon() {
  const { version } = useSaldo()
  const avisar = useAvisar()
  const cajitas = useDatos(apiCajitas.listar, [version])
  const metas = useDatos(apiMetas.listar, [version])
  const [q, setQ] = useSearchParams()
  const [nueva, setNueva] = useState(false)

  if (cajitas.error) return <ErrorCarga error={cajitas.error} reintentar={cajitas.recargar} />
  if (metas.error) return <ErrorCarga error={metas.error} reintentar={metas.recargar} />
  if (!cajitas.datos || !metas.datos) return <Cargando />

  const c = armarCaparazon(cajitas.datos, metas.datos)
  const seleccion = q.get('cajita')
  const elegida = c.items.find((x) => String(x.cajita.id) === seleccion) ?? null
  const elegir = (clave: string) => setQ(clave === seleccion ? {} : { cajita: clave }, { replace: true })
  const hayLibres = c.items.length < PLACAS

  return (
    <>
      <Encabezado
        titulo="Caparazón"
        subtitulo="Tu dinero protegido: cajitas, metas y reparto en un solo lugar."
        acciones={
          <>
            <BotonEnlace to="/cajitas/reparto">Repartir</BotonEnlace>
            <Boton variante="secundario" onClick={() => setNueva(true)}>
              <Icono nombre="mas" /> Nueva cajita
            </Boton>
          </>
        }
      />

      <Tarjeta className="mb-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <div className="col-span-2">
          <Cifra etiqueta="Dinero protegido" valor={String(c.total)} grande />
          {c.total !== c.totalActivas && (
            <p className="mt-1 text-xs text-aviso">Incluye {dinero(c.total - c.totalActivas)} en cajitas archivadas.</p>
          )}
        </div>
        <div>
          <p className="text-xs text-texto-suave">Cajitas activas</p>
          <p className="cifra text-2xl font-semibold">{c.items.length}</p>
        </div>
        <div>
          <p className="text-xs text-texto-suave">Metas activas</p>
          <p className="cifra text-2xl font-semibold">{c.metasActivas}</p>
        </div>
      </Tarjeta>

      {c.items.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Tortuga placas={[]} seleccion={null} alSeleccionar={() => {}} alLibre={() => setNueva(true)} />
          <Vacio accion={<Boton onClick={() => setNueva(true)}>Crear la primera cajita</Boton>}>
            Cada cajita es una placa de tu caparazón: plata apartada con un propósito. Al repartir, Hicotea la distribuye
            según tus porcentajes.
          </Vacio>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Tarjeta>
              <Tortuga
                placas={placasDe(c.items)}
                seleccion={elegida && c.items.indexOf(elegida) >= PLACAS - 1 && c.items.length > PLACAS ? 'grupo' : seleccion}
                alSeleccionar={(clave) => (clave === 'grupo' ? setQ({ cajita: 'grupo' }, { replace: true }) : elegir(clave))}
                alLibre={hayLibres ? () => setNueva(true) : undefined}
              />
              <p className="mt-2 text-center text-xs text-texto-suave">
                Las placas tienen el mismo tamaño. Elige una para ver su cajita; la proporción del ahorro está abajo.
              </p>
            </Tarjeta>
            <Tarjeta>
              <h2 className="mb-3 text-sm font-semibold">Proporción del ahorro</h2>
              <ProporcionAhorro items={c.items} />
            </Tarjeta>
          </div>

          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            {seleccion === 'grupo' ? (
              <Grupo items={c.items.slice(PLACAS - 1)} alElegir={elegir} />
            ) : elegida ? (
              <PanelCajita x={elegida} alCerrar={() => setQ({}, { replace: true })} />
            ) : (
              <p className="rounded-tarjeta border border-dashed border-borde p-6 text-center text-sm text-texto-suave">
                Elige una placa o una cajita de la lista para ver su detalle.
              </p>
            )}
          </div>
        </div>
      )}

      {c.items.length > 0 && (
        <Seccion titulo="Tus cajitas" acciones={<BotonEnlace to="/caparazon/historial" variante="fantasma" chico>Historial de ahorro</BotonEnlace>}>
          <ListaCaparazon items={c.items} seleccion={seleccion} alElegir={elegir} />
        </Seccion>
      )}

      <Archivo archivadas={c.archivadas} logros={c.logros} metasArchivadas={c.metasArchivadas} />

      <Modal abierto={nueva} onCerrar={() => setNueva(false)} titulo="Nueva cajita">
        {nueva && (
          <FormCajita
            cajita={null}
            cajitasOtras={cajitas.datos}
            alGuardar={(n) => {
              setNueva(false)
              avisar('Cajita creada.')
              void cajitas.recargar()
              void metas.recargar()
              setQ({ cajita: String(n.id) }, { replace: true })
            }}
          />
        )}
      </Modal>
    </>
  )
}

function PanelCajita({ x, alCerrar }: { x: CajitaCaparazon; alCerrar: () => void }) {
  const id = x.cajita.id
  return (
    <Tarjeta key={id} className="anim-escalonado space-y-4" aria-labelledby="panel-cajita">
      <div className="flex items-start gap-3">
        <MuestraSerie serie={x.serie} className="mt-1 size-5" />
        <div className="min-w-0 flex-1">
          <h2 id="panel-cajita" className="truncate text-lg font-semibold">
            {x.numero}. {x.cajita.nombre}
          </h2>
          {x.cajita.descripcion && <p className="text-sm text-texto-suave">{x.cajita.descripcion}</p>}
        </div>
        <Boton chico variante="fantasma" onClick={alCerrar} aria-label="Cerrar detalle">
          ✕
        </Boton>
      </div>
      <Cifra etiqueta="Saldo real" valor={x.cajita.saldo} grande />
      <MetricasCajita cajita={x.cajita} proporcion={x.proporcion} meta={x.meta} />
      <div className="flex flex-wrap gap-2 border-t border-borde pt-3">
        <BotonEnlace chico to={`/cajitas/${id}?operacion=APORTE`}>Aportar</BotonEnlace>
        <BotonEnlace chico variante="secundario" to={`/cajitas/${id}?operacion=RETIRO`}>Retirar</BotonEnlace>
        <BotonEnlace chico variante="fantasma" to={`/cajitas/${id}`}>Ver detalle</BotonEnlace>
      </div>
    </Tarjeta>
  )
}

function Grupo({ items, alElegir }: { items: CajitaCaparazon[]; alElegir: (clave: string) => void }) {
  return (
    <Tarjeta className="anim-escalonado space-y-3">
      <h2 className="text-lg font-semibold">Otras {items.length} cajitas</h2>
      <p className="text-sm text-texto-suave">No caben en la tortuga, pero están todas aquí y en la lista de abajo.</p>
      <ul className="space-y-1">
        {items.map((x) => (
          <li key={x.cajita.id}>
            <button
              type="button"
              onClick={() => alElegir(String(x.cajita.id))}
              className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-left text-sm hover:bg-superficie-2"
            >
              <MuestraSerie serie={x.serie} className="size-3" />
              <span className="min-w-0 flex-1 truncate">
                {x.numero}. {x.cajita.nombre}
              </span>
              <span className="cifra text-texto-suave">{dinero(x.saldo)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

/** Lista accesible con las mismas acciones que la tortuga. */
function ListaCaparazon({ items, seleccion, alElegir }: { items: CajitaCaparazon[]; seleccion: string | null; alElegir: (clave: string) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((x) => {
        const id = String(x.cajita.id)
        return (
          <li key={id} className={`rounded-tarjeta border bg-superficie p-4 shadow-tarjeta ${seleccion === id ? 'border-acento' : 'border-borde'}`}>
            <div className="flex items-start gap-2">
              <MuestraSerie serie={x.serie} className="mt-1 size-4" />
              <button type="button" onClick={() => alElegir(id)} aria-pressed={seleccion === id} className="min-w-0 flex-1 text-left">
                <span className="block truncate font-semibold hover:text-acento">
                  {x.numero}. {x.cajita.nombre}
                </span>
                {x.cajita.descripcion && <span className="block truncate text-xs text-texto-suave">{x.cajita.descripcion}</span>}
              </button>
              <Insignia tono={x.cajita.es_resto ? 'acento' : 'suave'}>{x.cajita.es_resto ? 'Resto' : formatoPorcentaje(x.cajita.porcentaje)}</Insignia>
            </div>
            <p className="cifra mt-3 text-2xl font-bold">{dinero(x.saldo)}</p>
            <p className="text-xs text-texto-suave">
              {x.meta ? `Meta «${x.meta.nombre}»: ${x.meta.porcentaje} %` : 'Sin meta'}
              {x.saldo === 0 && ' · sin saldo'}
            </p>
            <div className="mt-3 flex flex-wrap gap-1 border-t border-borde pt-3">
              <BotonEnlace chico variante="fantasma" to={`/cajitas/${id}?operacion=APORTE`}>Aportar</BotonEnlace>
              <BotonEnlace chico variante="fantasma" to={`/cajitas/${id}?operacion=RETIRO`}>Retirar</BotonEnlace>
              <BotonEnlace chico variante="fantasma" to={`/cajitas/${id}`}>Detalle</BotonEnlace>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Archivo({ archivadas, logros, metasArchivadas }: { archivadas: { id: number; nombre: string; saldo: string }[]; logros: import('../api/tipos').Meta[]; metasArchivadas: import('../api/tipos').Meta[] }) {
  if (archivadas.length + logros.length + metasArchivadas.length === 0) return null
  return (
    <details className="mt-6 rounded-tarjeta border border-borde bg-superficie p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Archivo · {logros.length} {logros.length === 1 ? 'logro' : 'logros'}, {archivadas.length}{' '}
        {archivadas.length === 1 ? 'cajita archivada' : 'cajitas archivadas'}
      </summary>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {logros.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-texto-suave uppercase">Metas logradas</h3>
            <ul className="space-y-2 text-sm">
              {logros.map((m) => (
                <li key={m.id} className="rounded-control border border-borde p-2">
                  <Link to={`/cajitas/${m.id_cajita}`} className="font-medium hover:text-acento">
                    ✓ {m.nombre}
                  </Link>
                  <p className="cifra text-xs text-texto-suave">
                    {dinero(m.monto_logrado ?? m.monto_objetivo)} en {m.nombre_cajita} · reconocida el {fechaLarga(m.cumplida_en ?? '')}
                    {m.alcanzada_en && ` · alcanzada el ${fechaLarga(m.alcanzada_en)}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(archivadas.length > 0 || metasArchivadas.length > 0) && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-texto-suave uppercase">Archivadas</h3>
            <ul className="space-y-1 text-sm">
              {archivadas.map((a) => (
                <li key={`c${a.id}`} className="flex justify-between gap-2">
                  <Link to={`/cajitas/${a.id}`} className="truncate hover:text-acento">
                    Cajita · {a.nombre}
                  </Link>
                  <span className="cifra text-texto-suave">{dinero(a.saldo)}</span>
                </li>
              ))}
              {metasArchivadas.map((m) => (
                <li key={`m${m.id}`}>
                  <Link to={`/cajitas/${m.id_cajita}`} className="hover:text-acento">
                    Meta pausada · {m.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}
