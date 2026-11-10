import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { cajitas as api, type CajitaForm } from '../api/cliente'
import type { Cajita, PropositoCajita } from '../api/tipos'
import { useAvisar, useSaldo } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { AlertaError, Boton, BotonEnlace, Campo, Cargando, Cifra, Encabezado, Entrada, EntradaMonto, ErrorCarga, Insignia, Interruptor, Selector, Tarjeta, Vacio } from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import { dinero, DESCRIPCION_PROPOSITO, NOMBRE_PROPOSITO, numero } from '../lib/formato'

const PROPOSITOS = Object.keys(NOMBRE_PROPOSITO) as PropositoCajita[]

export function FormCajita({ cajita, alGuardar }: { cajita: Cajita | null; alGuardar: (c: Cajita) => void }) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<CajitaForm>({
    nombre: cajita?.nombre ?? '',
    proposito: cajita?.proposito ?? 'LIBRE',
    porcentaje: cajita ? String(numero(cajita.porcentaje)) : '0',
    es_resto: cajita?.es_resto ?? false,
    saldo_inicial: '',
  })
  const pon = (c: Partial<CajitaForm>) => setF((x) => ({ ...x, ...c }))
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const datos = { ...f, porcentaje: f.es_resto ? '0' : f.porcentaje || '0', saldo_inicial: f.saldo_inicial || null }
    const r = await enviar(() => (cajita ? api.actualizar(cajita.id, datos) : api.crear(datos)))
    if (r) alGuardar(r)
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="Nombre" error={errores.nombre}>
        <Entrada value={f.nombre} maxLength={40} onChange={(e) => pon({ nombre: e.target.value })} required />
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
      <Interruptor etiqueta="Recibe el resto del reparto" marcado={f.es_resto} onCambio={(es_resto) => pon({ es_resto })} />
      {!f.es_resto && (
        <Campo etiqueta="Porcentaje del reparto" error={errores.porcentaje} ayuda="Qué parte de lo disponible va a esta cajita al repartir.">
          <Entrada type="number" min={0} max={100} step="0.01" inputMode="decimal" value={f.porcentaje} onChange={(e) => pon({ porcentaje: e.target.value })} />
        </Campo>
      )}
      {!cajita && (
        <Campo etiqueta="Saldo que ya tenía (opcional)" error={errores.saldo_inicial} ayuda="Si ya tenías esta plata guardada antes de usar Hicotea.">
          <EntradaMonto value={f.saldo_inicial ?? ''} onChange={(e) => pon({ saldo_inicial: e.target.value })} />
        </Campo>
      )}
      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
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
  const suma = activas.reduce((s, c) => s + numero(c.porcentaje), 0)

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
              <Icono nombre="mas" /> Nueva
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
        <>
          <Tarjeta className="mb-4 grid grid-cols-2 gap-3">
            <Cifra etiqueta="Total en cajitas" valor={String(total)} grande />
            <div>
              <p className="text-xs text-texto-suave">Porcentajes asignados</p>
              <p className="cifra text-lg font-semibold">{suma}%</p>
              {suma < 100 && !activas.some((c) => c.es_resto) && <p className="text-xs text-aviso">Falta asignar {100 - suma}% o marcar una cajita como resto.</p>}
            </div>
          </Tarjeta>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.datos.map((c) => (
              <Link key={c.id} to={`/cajitas/${c.id}`} className="block rounded-2xl border border-borde bg-superficie p-4 transition-colors hover:border-acento/50">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-semibold">{c.nombre}</h2>
                  {!c.activa ? <Insignia>Inactiva</Insignia> : <Insignia tono="acento">{c.es_resto ? 'Resto' : `${numero(c.porcentaje)}%`}</Insignia>}
                </div>
                <p className="text-xs text-texto-suave">{NOMBRE_PROPOSITO[c.proposito]}</p>
                <p className="cifra mt-3 text-2xl font-bold">{dinero(c.saldo)}</p>
              </Link>
            ))}
          </div>
        </>
      )}
      <Modal abierto={nueva} onCerrar={() => setNueva(false)} titulo="Nueva cajita">
        {nueva && (
          <FormCajita
            cajita={null}
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
