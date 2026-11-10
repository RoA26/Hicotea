import { useState, type FormEvent } from 'react'
import { atajos as api, type AtajoForm } from '../api/cliente'
import type { Atajo, TipoIngresoGasto } from '../api/tipos'
import { useAvisar, useConfirmar } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { SelectorCategoria, SelectorFuente } from '../componentes/Selectores'
import { AlertaError, Boton, Campo, Cargando, Encabezado, Entrada, EntradaMonto, ErrorCarga, Seccion, Segmentos, Tarjeta, Vacio } from '../componentes/ui'
import { categoriasPara, useCatalogos } from '../lib/catalogos'
import { useDatos, useEnvio } from '../lib/datos'
import { dinero } from '../lib/formato'
import { useRegistroRapido } from '../lib/registro'

const MAXIMO = 12
const VACIO: AtajoForm = { nombre: '', tipo: 'GASTO', monto: '', id_categoria: null, id_fuente: null }

export default function Atajos() {
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const registrado = useRegistroRapido()
  const lista = useDatos(api.listar)
  const cat = useCatalogos()
  const { enviando, error, errores, enviar } = useEnvio()
  const [f, setF] = useState<AtajoForm>(VACIO)
  const pon = (c: Partial<AtajoForm>) => setF((x) => ({ ...x, ...c }))

  const categorias = cat.datos?.categorias ?? []
  const opciones = categoriasPara(categorias, f.tipo === 'INGRESO' ? ['INGRESO'] : ['GASTO', 'COSTO_OPERATIVO'])
  const categoria = categorias.find((c) => c.id === f.id_categoria)
  const pideFuente = f.tipo === 'INGRESO' || categoria?.tipo === 'COSTO_OPERATIVO'

  async function alEnviar(e: FormEvent) {
    e.preventDefault()
    const r = await enviar(() => api.crear({ ...f, id_fuente: pideFuente ? f.id_fuente : null }))
    if (r) {
      avisar('Botón creado. Lo verás en Inicio.')
      setF({ ...VACIO, tipo: f.tipo })
      void lista.recargar()
    }
  }

  async function usar(a: Atajo) {
    try {
      registrado(await api.usar(a.id))
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  async function eliminar(a: Atajo) {
    if (!(await confirmar({ titulo: 'Eliminar botón', mensaje: `Se quitará "${a.nombre}". Los movimientos que registró se conservan.`, aceptar: 'Eliminar', peligro: true }))) return
    try {
      await api.eliminar(a.id)
      void lista.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  const llenos = (lista.datos?.length ?? 0) >= MAXIMO
  return (
    <>
      <Encabezado titulo="Botones rápidos" subtitulo={`Un toque registra un gasto o ingreso de hoy. Hasta ${MAXIMO} botones.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          {cat.error ? (
            <ErrorCarga error={cat.error} reintentar={cat.recargar} />
          ) : llenos ? (
            <p className="text-sm text-texto-suave">Ya tienes {MAXIMO} botones. Elimina uno para crear otro.</p>
          ) : (
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
                <Campo etiqueta="Nombre del botón" error={errores.nombre}>
                  <Entrada value={f.nombre} maxLength={30} onChange={(e) => pon({ nombre: e.target.value })} placeholder="Almuerzo" required />
                </Campo>
                <Campo etiqueta="Monto" error={errores.monto}>
                  <EntradaMonto value={f.monto} onChange={(e) => pon({ monto: e.target.value })} required />
                </Campo>
              </div>
              <Campo etiqueta="Categoría" error={errores.id_categoria}>
                <SelectorCategoria categorias={opciones} valor={f.id_categoria} onCambio={(id_categoria) => pon({ id_categoria })} />
              </Campo>
              {pideFuente && (
                <Campo etiqueta={categoria?.tipo === 'COSTO_OPERATIVO' ? 'Fuente' : 'Fuente (opcional)'} error={errores.id_fuente}>
                  <SelectorFuente fuentes={cat.datos?.fuentes ?? []} valor={f.id_fuente} onCambio={(id_fuente) => pon({ id_fuente })} />
                </Campo>
              )}
              <AlertaError mensaje={error} />
              <Boton type="submit" className="w-full" cargando={enviando}>
                <Icono nombre="mas" /> Crear botón
              </Boton>
            </form>
          )}
        </Tarjeta>
        <Seccion titulo="Tus botones">
          {lista.error ? (
            <ErrorCarga error={lista.error} reintentar={lista.recargar} />
          ) : !lista.datos ? (
            <Cargando />
          ) : lista.datos.length === 0 ? (
            <Vacio>Crea botones para lo que registras seguido: el almuerzo, la gasolina, el pasaje.</Vacio>
          ) : (
            <ul className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
              {lista.datos.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.nombre}</p>
                    <p className="text-xs text-texto-suave">{a.nombre_categoria}</p>
                  </div>
                  <span className={a.tipo === 'INGRESO' ? 'cifra text-ingreso' : 'cifra text-gasto'}>
                    {a.tipo === 'INGRESO' ? '+ ' : '− '}
                    {dinero(a.monto)}
                  </span>
                  <Boton chico variante="secundario" onClick={() => usar(a)}>
                    Usar
                  </Boton>
                  <Boton chico variante="fantasma" aria-label="Eliminar" onClick={() => eliminar(a)}>
                    <Icono nombre="basura" className="size-4" />
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </div>
    </>
  )
}
