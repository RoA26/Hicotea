import { useState, type FormEvent } from 'react'
import { categorias as api } from '../api/cliente'
import type { Categoria, TipoCategoria } from '../api/tipos'
import { useAvisar } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { AlertaError, Boton, Campo, Cargando, Encabezado, Entrada, ErrorCarga, Insignia, Seccion, Selector } from '../componentes/ui'
import { useDatos, useEnvio } from '../lib/datos'
import { NOMBRE_TIPO_CATEGORIA } from '../lib/formato'

const TIPOS: TipoCategoria[] = ['INGRESO', 'GASTO', 'COSTO_OPERATIVO']
const AYUDA: Record<TipoCategoria, string> = {
  INGRESO: 'Lo que entra.',
  GASTO: 'Tus gastos personales: comida, arriendo, servicios.',
  COSTO_OPERATIVO: 'Lo que cuesta producir con una fuente: gasolina, repuestos, SOAT.',
}

function FormCategoria({ categoria, tipo, alGuardar }: { categoria: Categoria | null; tipo: TipoCategoria; alGuardar: () => void }) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState({ nombre: categoria?.nombre ?? '', tipo: categoria?.tipo ?? tipo })
  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => (categoria ? api.cambiar(categoria.id, { nombre: f.nombre }) : api.crear(f)))
    if (r) alGuardar()
  }
  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Campo etiqueta="Nombre" error={errores.nombre}>
        <Entrada value={f.nombre} maxLength={50} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
      </Campo>
      {!categoria && (
        <Campo etiqueta="Tipo" error={errores.tipo} ayuda={AYUDA[f.tipo]}>
          <Selector value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoCategoria })}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO_CATEGORIA[t]}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
        Guardar
      </Boton>
    </form>
  )
}

export default function Categorias() {
  const avisar = useAvisar()
  const lista = useDatos(api.listar)
  const [editando, setEditando] = useState<{ categoria: Categoria | null; tipo: TipoCategoria } | null>(null)

  async function alternar(c: Categoria) {
    try {
      await api.cambiar(c.id, { activa: !c.activa })
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  return (
    <>
      <Encabezado titulo="Categorías" subtitulo="Desactiva las que no uses; las de movimientos pasados se conservan." />
      {lista.error ? (
        <ErrorCarga error={lista.error} reintentar={lista.recargar} />
      ) : !lista.datos ? (
        <Cargando />
      ) : (
        <div className="grid gap-x-6 lg:grid-cols-3">
          {TIPOS.map((t) => (
            <Seccion
              key={t}
              titulo={NOMBRE_TIPO_CATEGORIA[t]}
              acciones={
                <Boton chico variante="fantasma" onClick={() => setEditando({ categoria: null, tipo: t })}>
                  <Icono nombre="mas" className="size-4" /> Agregar
                </Boton>
              }
            >
              <ul className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
                {(lista.datos ?? [])
                  .filter((c) => c.tipo === t)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {c.nombre} {!c.activa && <Insignia>Inactiva</Insignia>}
                      </span>
                      <Boton chico variante="fantasma" onClick={() => alternar(c)}>
                        {c.activa ? 'Desactivar' : 'Activar'}
                      </Boton>
                      <Boton chico variante="fantasma" aria-label="Renombrar" onClick={() => setEditando({ categoria: c, tipo: t })}>
                        <Icono nombre="lapiz" className="size-4" />
                      </Boton>
                    </li>
                  ))}
              </ul>
            </Seccion>
          ))}
        </div>
      )}
      <Modal abierto={!!editando} onCerrar={() => setEditando(null)} titulo={editando?.categoria ? 'Renombrar categoría' : 'Nueva categoría'}>
        {editando && (
          <FormCategoria
            categoria={editando.categoria}
            tipo={editando.tipo}
            alGuardar={() => {
              setEditando(null)
              avisar('Categoría guardada.')
              void lista.recargar()
            }}
          />
        )}
      </Modal>
    </>
  )
}
