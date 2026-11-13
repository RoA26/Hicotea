import { useState, type FormEvent } from 'react'
import { atajos as api, categorias as apiCat, type AtajoForm } from '../api/cliente'
import type { Atajo, Categoria, Fuente, TipoCategoria, TipoIngresoGasto } from '../api/tipos'
import { useAvisar, useConfirmar } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { SelectorCategoria, SelectorFuente } from '../componentes/Selectores'
import {
  AlertaError,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Entrada,
  EntradaMonto,
  ErrorCarga,
  Insignia,
  Seccion,
  Segmentos,
  Selector,
  Tarjeta,
  Vacio,
} from '../componentes/ui'
import { categoriasPara, useCatalogos } from '../lib/catalogos'
import { useDatos, useEnvio } from '../lib/datos'
import { dinero, NOMBRE_TIPO_CATEGORIA } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'

/* ── constantes ── */

const MAXIMO = 12
const VACIO: AtajoForm = { nombre: '', tipo: 'GASTO', monto: '', id_categoria: null, id_fuente: null }

type Pestana = 'atajos' | 'categorias'

/* ══════════════════════════════════════════════════════════════════
   Pestaña: Mis atajos
   ══════════════════════════════════════════════════════════════════ */

function FormAtajo({
  categorias,
  fuentes,
  alGuardar,
  alRecargarCatalogos,
}: {
  categorias: Categoria[]
  fuentes: Fuente[]
  alGuardar: () => void
  alRecargarCatalogos: () => Promise<unknown>
}) {
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<AtajoForm>(VACIO)
  const pon = (c: Partial<AtajoForm>) => setF((x) => ({ ...x, ...c }))

  // Categoría contextual rápida
  const [creandoCat, setCreandoCat] = useState(false)
  const [nombreNuevaCat, setNombreNuevaCat] = useState('')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [errorCat, setErrorCat] = useState<string | null>(null)

  const opciones = categoriasPara(categorias, f.tipo === 'INGRESO' ? ['INGRESO'] : ['GASTO', 'COSTO_OPERATIVO'])
  const categoria = categorias.find((c) => c.id === f.id_categoria)
  const pideFuente = f.tipo === 'INGRESO' || categoria?.tipo === 'COSTO_OPERATIVO'

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => api.crear({ ...f, id_fuente: pideFuente ? f.id_fuente : null }))
    if (r) {
      alGuardar()
      setF({ ...VACIO, tipo: f.tipo })
    }
  }

  async function crearCategoriaContextual() {
    if (!nombreNuevaCat.trim()) return
    setGuardandoCat(true)
    setErrorCat(null)
    try {
      const nueva = await apiCat.crear({
        nombre: nombreNuevaCat.trim(),
        tipo: f.tipo === 'INGRESO' ? 'INGRESO' : 'GASTO',
      })
      await alRecargarCatalogos()
      pon({ id_categoria: nueva.id })
      setNombreNuevaCat('')
      setCreandoCat(false)
    } catch (err) {
      setErrorCat((err as Error).message)
    } finally {
      setGuardandoCat(false)
    }
  }

  return (
    <form onSubmit={alEnviar} className="space-y-4">
      <Segmentos<TipoIngresoGasto>
        valor={f.tipo}
        onCambio={(tipo) => pon({ tipo, id_categoria: null })}
        opciones={[
          { valor: 'GASTO', etiqueta: 'Gasto', tono: 'gasto' },
          { valor: 'INGRESO', etiqueta: 'Ingreso' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nombre del atajo" error={errores.nombre}>
          <Entrada value={f.nombre} maxLength={30} onChange={(e) => pon({ nombre: e.target.value })} placeholder="Almuerzo" required />
        </Campo>
        <Campo etiqueta="Monto" error={errores.monto}>
          <EntradaMonto value={f.monto} onChange={(e) => pon({ monto: e.target.value })} required />
        </Campo>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-texto-suave">Categoría</span>
          {!creandoCat && (
            <button
              type="button"
              onClick={() => setCreandoCat(true)}
              className="inline-flex items-center gap-1 text-xs text-acento hover:underline"
            >
              <Icono nombre="mas" className="size-3" /> Nueva categoría
            </button>
          )}
        </div>

        {creandoCat ? (
          <div className="mb-3 rounded-xl border border-borde bg-superficie-2 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-texto">
                Nueva categoría de {f.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCreandoCat(false)
                  setErrorCat(null)
                }}
                className="text-xs text-texto-suave hover:text-texto"
              >
                Cancelar
              </button>
            </div>
            <div className="flex gap-2">
              <Entrada
                value={nombreNuevaCat}
                onChange={(e) => setNombreNuevaCat(e.target.value)}
                placeholder="Nombre de categoría"
                maxLength={50}
                className="h-9 text-sm"
              />
              <Boton
                chico
                type="button"
                cargando={guardandoCat}
                onClick={crearCategoriaContextual}
              >
                Crear
              </Boton>
            </div>
            {errorCat && <p className="text-xs text-gasto">{errorCat}</p>}
          </div>
        ) : (
          <SelectorCategoria categorias={opciones} valor={f.id_categoria} onCambio={(id_categoria) => pon({ id_categoria })} invalido={!!errores.id_categoria} />
        )}
        {errores.id_categoria && <span className="mt-1 block text-sm text-gasto">{errores.id_categoria}</span>}
      </div>

      {pideFuente && (
        <Campo etiqueta={categoria?.tipo === 'COSTO_OPERATIVO' ? 'Fuente' : 'Fuente (opcional)'} error={errores.id_fuente}>
          <SelectorFuente fuentes={fuentes} valor={f.id_fuente} onCambio={(id_fuente) => pon({ id_fuente })} />
        </Campo>
      )}
      <AlertaError mensaje={error} />
      <Boton type="submit" className="w-full" cargando={enviando}>
        <Icono nombre="mas" /> Crear atajo
      </Boton>
    </form>
  )
}

function PanelAtajos() {
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const registrado = useRegistroRapido()
  const lista = useDatos(api.listar)
  const cat = useCatalogos()
  const [modalCrear, setModalCrear] = useState(false)
  const [usando, setUsando] = useState<number | null>(null)

  async function usar(a: Atajo) {
    setUsando(a.id)
    try {
      registrado(await api.usar(a.id))
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    } finally {
      setUsando(null)
    }
  }

  async function eliminar(a: Atajo) {
    if (
      !(await confirmar({
        titulo: 'Eliminar atajo',
        mensaje: `Se quitará "${a.nombre}". Los movimientos que registró se conservan.`,
        aceptar: 'Eliminar',
        peligro: true,
      }))
    )
      return
    try {
      await api.eliminar(a.id)
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  const llenos = (lista.datos?.length ?? 0) >= MAXIMO

  if (lista.error) return <ErrorCarga error={lista.error} reintentar={lista.recargar} />
  if (!lista.datos) return <Cargando />

  return (
    <>
      {lista.datos.length === 0 ? (
        <Vacio
          accion={
            <Boton onClick={() => setModalCrear(true)}>
              <Icono nombre="mas" /> Crear tu primer atajo
            </Boton>
          }
        >
          <span className="block text-base font-medium text-texto">Sin atajos todavía</span>
          Un atajo registra un movimiento con un solo toque.
          <br />
          <span className="text-texto-suave/70">
            Ejemplos: <em>Almuerzo · Gasto · $ 12.000</em> — <em>Pasaje · Gasto · $ 3.200</em>
          </span>
        </Vacio>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-texto-suave">
              {lista.datos.length} de {MAXIMO} atajos
            </p>
            {!llenos && (
              <Boton chico onClick={() => setModalCrear(true)}>
                <Icono nombre="mas" className="size-4" /> Nuevo atajo
              </Boton>
            )}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lista.datos.map((a) => (
              <li key={a.id}>
                <Tarjeta className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.nombre}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-texto-suave">
                      <Insignia tono={a.tipo === 'INGRESO' ? 'acento' : 'gasto'}>
                        {a.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'}
                      </Insignia>
                      <span>·</span>
                      <span>{a.nombre_categoria}</span>
                    </p>
                  </div>
                  <span className={a.tipo === 'INGRESO' ? 'cifra text-ingreso' : 'cifra text-gasto'}>
                    {a.tipo === 'INGRESO' ? '+ ' : '− '}
                    {dinero(a.monto)}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Boton
                      chico
                      variante="secundario"
                      disabled={usando !== null}
                      cargando={usando === a.id}
                      onClick={() => usar(a)}
                    >
                      Usar
                    </Boton>
                    <Boton chico variante="fantasma" aria-label="Eliminar" onClick={() => eliminar(a)}>
                      <Icono nombre="basura" className="size-4" />
                    </Boton>
                  </div>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal abierto={modalCrear} onCerrar={() => setModalCrear(false)} titulo="Nuevo atajo">
        {cat.error ? (
          <ErrorCarga error={cat.error} reintentar={cat.recargar} />
        ) : !cat.datos ? (
          <Cargando />
        ) : (
          <FormAtajo
            categorias={cat.datos.categorias}
            fuentes={cat.datos.fuentes}
            alRecargarCatalogos={cat.recargar}
            alGuardar={() => {
              setModalCrear(false)
              avisar('Atajo creado. Lo verás en Inicio.')
              void lista.recargar()
            }}
          />
        )}
      </Modal>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════
   Pestaña: Categorías
   ══════════════════════════════════════════════════════════════════ */

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
    const r = await enviar(() => (categoria ? apiCat.cambiar(categoria.id, { nombre: f.nombre }) : apiCat.crear(f)))
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

function PanelCategorias() {
  const avisar = useAvisar()
  const lista = useDatos(apiCat.listar)
  const [editando, setEditando] = useState<{ categoria: Categoria | null; tipo: TipoCategoria } | null>(null)

  async function alternar(c: Categoria) {
    try {
      await apiCat.cambiar(c.id, { activa: !c.activa })
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  if (lista.error) return <ErrorCarga error={lista.error} reintentar={lista.recargar} />
  if (!lista.datos) return <Cargando />

  return (
    <>
      <p className="mb-4 text-sm text-texto-suave">Desactiva las que no uses; las de movimientos pasados se conservan.</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

/* ══════════════════════════════════════════════════════════════════
   Página principal: Atajos (con pestañas)
   ══════════════════════════════════════════════════════════════════ */

export default function Atajos() {
  const [pestana, setPestana] = useState<Pestana>('atajos')

  return (
    <>
      <Encabezado titulo="Atajos" subtitulo="Operaciones frecuentes de un toque y gestión de categorías." />

      {/* Selector de pestaña */}
      <div role="tablist" className="mb-6 flex gap-1 rounded-xl border border-borde bg-superficie-2 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'atajos'}
          onClick={() => setPestana('atajos')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            pestana === 'atajos' ? 'bg-acento text-sobre-acento' : 'text-texto-suave hover:text-texto'
          }`}
        >
          Mis atajos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestana === 'categorias'}
          onClick={() => setPestana('categorias')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            pestana === 'categorias' ? 'bg-acento text-sobre-acento' : 'text-texto-suave hover:text-texto'
          }`}
        >
          Categorías
        </button>
      </div>

      {/* Contenido */}
      <div role="tabpanel">
        {pestana === 'atajos' ? <PanelAtajos /> : <PanelCategorias />}
      </div>
    </>
  )
}
