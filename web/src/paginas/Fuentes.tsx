import { useState, type FormEvent } from 'react'
import { fuentes as api } from '../api/cliente'
import type { Frecuencia, Fuente } from '../api/tipos'
import { useAvisar } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { AlertaError, Boton, Campo, Cargando, Cifra, Encabezado, Entrada, ErrorCarga, Insignia, Seccion, Selector, Tarjeta, Vacio } from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import { dinero, mesActual, NOMBRE_FRECUENCIA, primerDiaMes, ultimoDiaMes } from '../lib/formato'

const FRECUENCIAS = Object.keys(NOMBRE_FRECUENCIA) as Frecuencia[]

function FormFuente({ fuente, alGuardar }: { fuente: Fuente | null; alGuardar: () => void }) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState({ nombre: fuente?.nombre ?? '', frecuencia: fuente?.frecuencia ?? ('DIARIA' as Frecuencia) })
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => (fuente ? api.actualizar(fuente.id, f) : api.crear(f)))
    if (r) alGuardar()
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="Nombre" error={errores.nombre} ayuda="Por ejemplo: Motocarro, Tienda, Sueldo.">
        <Entrada value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
      </Campo>
      <Campo etiqueta="¿Cada cuánto produce?" error={errores.frecuencia}>
        <Selector value={f.frecuencia} onChange={(e) => setF({ ...f, frecuencia: e.target.value as Frecuencia })}>
          {FRECUENCIAS.map((x) => (
            <option key={x} value={x}>
              {NOMBRE_FRECUENCIA[x]}
            </option>
          ))}
        </Selector>
      </Campo>
      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
        Guardar
      </Boton>
    </form>
  )
}

export default function Fuentes() {
  const avisar = useAvisar()
  const [rango, setRango] = useState({ desde: primerDiaMes(mesActual()), hasta: ultimoDiaMes(mesActual()) })
  const lista = useDatos(api.listar)
  const resumen = useDatos(() => api.resumen(rango.desde, rango.hasta), [rango.desde, rango.hasta])
  const [editando, setEditando] = useState<Fuente | null | 'nueva'>(null)

  async function alternar(f: Fuente) {
    try {
      await api.estado(f.id, !f.activa)
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <>
      <Encabezado
        titulo="Fuentes de ingreso"
        subtitulo="Lo que entra menos lo que cuesta producirlo."
        acciones={
          <Boton onClick={() => setEditando('nueva')}>
            <Icono nombre="mas" /> Nueva fuente
          </Boton>
        }
      />

      <Tarjeta className="mb-4 grid grid-cols-2 gap-3">
        <Campo etiqueta="Desde">
          <Entrada type="date" value={rango.desde} onChange={(e) => e.target.value && setRango({ ...rango, desde: e.target.value })} />
        </Campo>
        <Campo etiqueta="Hasta">
          <Entrada type="date" value={rango.hasta} onChange={(e) => e.target.value && setRango({ ...rango, hasta: e.target.value })} />
        </Campo>
      </Tarjeta>

      {resumen.error ? (
        <ErrorCarga error={resumen.error} reintentar={resumen.recargar} />
      ) : !resumen.datos ? (
        <Cargando />
      ) : resumen.datos.length === 0 ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          {resumen.datos.map((r) => (
            <Tarjeta key={r.id_fuente}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{r.nombre}</h2>
                {r.margen !== null && <Insignia tono={r.margen >= 0 ? 'acento' : 'gasto'}>margen {r.margen}%</Insignia>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Cifra etiqueta="Bruto" valor={r.bruto} tono="ingreso" />
                <Cifra etiqueta="Costos" valor={r.costos} tono="gasto" />
                <Cifra etiqueta="Utilidad" valor={r.utilidad} />
              </div>
              <p className="cifra mt-2 text-xs text-texto-suave">
                {r.dias_trabajados} días trabajados · promedio {dinero(r.promedio_diario)} por día
              </p>
            </Tarjeta>
          ))}
        </div>
      )}

      <Seccion titulo="Todas las fuentes">
        {lista.error ? (
          <ErrorCarga error={lista.error} reintentar={lista.recargar} />
        ) : !lista.datos ? (
          <Cargando />
        ) : lista.datos.length === 0 ? (
          <Vacio accion={<Boton onClick={() => setEditando('nueva')}>Crear la primera</Boton>}>
            Una fuente es lo que te genera ingresos: un vehículo, un negocio, tu sueldo.
          </Vacio>
        ) : (
          <ul className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
            {lista.datos.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {f.nombre} {!f.activa && <Insignia>Inactiva</Insignia>}
                  </p>
                  <p className="text-xs text-texto-suave">{NOMBRE_FRECUENCIA[f.frecuencia]}</p>
                </div>
                <Boton chico variante="fantasma" onClick={() => alternar(f)}>
                  {f.activa ? 'Desactivar' : 'Activar'}
                </Boton>
                <Boton chico variante="fantasma" aria-label="Editar" onClick={() => setEditando(f)}>
                  <Icono nombre="lapiz" className="size-4" />
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Modal abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === 'nueva' ? 'Nueva fuente' : 'Editar fuente'}>
        {editando !== null && (
          <FormFuente
            fuente={editando === 'nueva' ? null : editando}
            alGuardar={() => {
              setEditando(null)
              avisar('Fuente guardada.')
              void lista.recargar()
              void resumen.recargar()
            }}
          />
        )}
      </Modal>
    </>
  )
}
