import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { metas as api, type MetaForm } from '../api/cliente'
import type { Cajita, Meta } from '../api/tipos'
import { useAvisar, useConfirmar } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { SelectorCajita } from '../componentes/Selectores'
import { AlertaError, Barra, Boton, Campo, Cargando, Encabezado, Entrada, EntradaMonto, ErrorCarga, Insignia, Tarjeta, Vacio } from '../componentes/ui'
import { useCatalogos } from '../lib/catalogos'
import { useDatos, useEnvio } from '../lib/datos'
import { dinero, fechaLarga, hoy, montoEditable } from '../lib/formato'

function FormMeta({ meta, cajitas, alGuardar }: { meta: Meta | null; cajitas: Cajita[]; alGuardar: () => void }) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<MetaForm>({
    nombre: meta?.nombre ?? '',
    monto_objetivo: montoEditable(meta?.monto_objetivo),
    fecha_objetivo: meta?.fecha_objetivo ?? null,
    id_cajita: meta?.id_cajita ?? null,
  })
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => (meta ? api.actualizar(meta.id, f) : api.crear(f)))
    if (r) alGuardar()
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="¿Para qué ahorras?" error={errores.nombre}>
        <Entrada value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Llantas nuevas" required />
      </Campo>
      <Campo etiqueta="Monto objetivo" error={errores.monto_objetivo}>
        <EntradaMonto value={f.monto_objetivo} onChange={(e) => setF({ ...f, monto_objetivo: e.target.value })} required />
      </Campo>
      <Campo etiqueta="Fecha objetivo (opcional)" error={errores.fecha_objetivo} ayuda="Con fecha, Hicotea calcula cuánto aportar al mes.">
        <Entrada type="date" min={hoy()} value={f.fecha_objetivo ?? ''} onChange={(e) => setF({ ...f, fecha_objetivo: e.target.value || null })} />
      </Campo>
      <Campo etiqueta="Cajita donde se guarda" error={errores.id_cajita} ayuda="El progreso es el saldo de esa cajita.">
        <SelectorCajita cajitas={cajitas} valor={f.id_cajita} onCambio={(id_cajita) => setF({ ...f, id_cajita })} invalido={!!errores.id_cajita} />
      </Campo>
      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
        Guardar
      </Boton>
    </form>
  )
}

export default function Metas() {
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const lista = useDatos(api.listar)
  const cat = useCatalogos()
  const [editando, setEditando] = useState<Meta | null | 'nueva'>(null)
  const sinCajitas = cat.datos && !cat.datos.cajitas.some((c) => c.activa)

  async function accion(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      avisar(ok)
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  async function eliminar(m: Meta) {
    if (await confirmar({ titulo: 'Eliminar meta', mensaje: `Se eliminará "${m.nombre}". La plata de la cajita no se toca.`, aceptar: 'Eliminar', peligro: true }))
      void accion(() => api.eliminar(m.id), 'Meta eliminada.')
  }

  return (
    <>
      <Encabezado
        titulo="Metas"
        subtitulo="El ahorro de cada meta vive en una cajita."
        acciones={
          <Boton onClick={() => setEditando('nueva')} disabled={!!sinCajitas}>
            <Icono nombre="mas" /> Nueva meta
          </Boton>
        }
      />
      {sinCajitas && (
        <p className="mb-4 text-sm text-aviso">
          Para crear una meta primero necesitas una{' '}
          <Link to="/cajitas" className="underline">
            cajita
          </Link>
          .
        </p>
      )}
      {lista.error ? (
        <ErrorCarga error={lista.error} reintentar={lista.recargar} />
      ) : !lista.datos ? (
        <Cargando />
      ) : lista.datos.length === 0 ? (
        <Vacio>Ponle nombre y monto a lo que quieres lograr, y mira cuánto te falta.</Vacio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.datos.map((m) => (
            <Tarjeta key={m.id} className={m.activa ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{m.nombre}</h2>
                  <p className="text-xs text-texto-suave">en {m.nombre_cajita}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {m.cumplida && <Insignia tono="acento">Cumplida</Insignia>}
                  {m.vencida && !m.cumplida && <Insignia tono="gasto">Vencida</Insignia>}
                  {!m.activa && <Insignia>Pausada</Insignia>}
                </div>
              </div>
              <p className="cifra mt-3 text-sm">
                <span className="text-xl font-bold">{dinero(m.saldo_cajita)}</span> <span className="text-texto-suave">de {dinero(m.monto_objetivo)}</span>
              </p>
              <div className="mt-2">
                <Barra porcentaje={m.porcentaje} />
              </div>
              <p className="cifra mt-2 text-xs text-texto-suave">
                {m.porcentaje}% · faltan {dinero(m.faltante)}
                {m.fecha_objetivo && ` · para el ${fechaLarga(m.fecha_objetivo)}`}
                {m.aporte_mensual && !m.cumplida && ` · aporta ${dinero(m.aporte_mensual)} al mes`}
              </p>
              <div className="mt-3 flex flex-wrap gap-1 border-t border-borde pt-3">
                <Boton chico variante="fantasma" onClick={() => setEditando(m)}>
                  Editar
                </Boton>
                <Boton chico variante="fantasma" onClick={() => accion(() => api.estado(m.id, !m.activa), m.activa ? 'Meta pausada.' : 'Meta reactivada.')}>
                  {m.activa ? 'Pausar' : 'Reactivar'}
                </Boton>
                <Link to={`/cajitas/${m.id_cajita}`} className="inline-flex h-9 items-center rounded-xl px-3 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto">
                  Aportar
                </Link>
                <Boton chico variante="fantasma" className="ml-auto text-gasto" onClick={() => eliminar(m)}>
                  Eliminar
                </Boton>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
      <Modal abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === 'nueva' ? 'Nueva meta' : 'Editar meta'}>
        {editando !== null && cat.datos && (
          <FormMeta
            meta={editando === 'nueva' ? null : editando}
            cajitas={cat.datos.cajitas}
            alGuardar={() => {
              setEditando(null)
              avisar('Meta guardada.')
              void lista.recargar()
            }}
          />
        )}
      </Modal>
    </>
  )
}
