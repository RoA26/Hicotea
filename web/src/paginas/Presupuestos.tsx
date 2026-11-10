import { useState, type FormEvent } from 'react'
import { presupuestos as api } from '../api/cliente'
import type { Presupuesto } from '../api/tipos'
import { useAvisar, useConfirmar } from '../componentes/Globales'
import { Icono } from '../componentes/Iconos'
import { Modal } from '../componentes/Modal'
import { SelectorCategoria } from '../componentes/Selectores'
import { AlertaError, Barra, Boton, Campo, Cargando, Cifra, Encabezado, EntradaMonto, ErrorCarga, Tarjeta, Vacio } from '../componentes/ui'
import { categoriasPara, useCatalogos } from '../lib/catalogos'
import { useDatos, useEnvio } from '../lib/datos'
import { dinero, mesActual, montoEditable, nombreMes, numero, sumarMes } from '../lib/formato'

export default function Presupuestos() {
  const avisar = useAvisar()
  const confirmar = useConfirmar()
  const [mes, setMes] = useState(mesActual())
  const datos = useDatos(() => api.listar(mes), [mes])
  const cat = useCatalogos()
  const [editando, setEditando] = useState<Presupuesto | null | 'nuevo'>(null)
  const [f, setF] = useState<{ id_categoria: number | null; monto: string }>({ id_categoria: null, monto: '' })
  const envio = useEnvio()

  function abrir(p: Presupuesto | 'nuevo') {
    envio.limpiar()
    setF(p === 'nuevo' ? { id_categoria: null, monto: '' } : { id_categoria: p.id_categoria, monto: montoEditable(p.presupuestado) })
    setEditando(p)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (f.id_categoria === null) return
    const r = await envio.enviar(() => api.guardar(f.id_categoria!, f.monto))
    if (r) {
      setEditando(null)
      avisar('Presupuesto guardado.')
      if (mes === r.mes) datos.poner(r)
      else void datos.recargar()
    }
  }

  async function eliminar(p: Presupuesto) {
    if (!(await confirmar({ titulo: 'Quitar presupuesto', mensaje: `Dejarás de controlar el gasto en ${p.categoria}.`, aceptar: 'Quitar', peligro: true }))) return
    try {
      await api.eliminar(p.id)
      void datos.recargar()
    } catch (e) {
      avisar((e as Error).message, { tono: 'error' })
    }
  }

  const d = datos.datos
  const usadas = new Set(d?.presupuestos.map((p) => p.id_categoria))
  const opciones = categoriasPara(cat.datos?.categorias ?? [], ['GASTO', 'COSTO_OPERATIVO']).filter((c) => editando !== 'nuevo' || !usadas.has(c.id))

  return (
    <>
      <Encabezado
        titulo="Presupuestos"
        subtitulo="Un tope mensual por categoría. Te avisamos al pasar el 80%."
        acciones={
          <Boton onClick={() => abrir('nuevo')}>
            <Icono nombre="mas" /> Nuevo
          </Boton>
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Boton chico variante="secundario" aria-label="Mes anterior" onClick={() => setMes(sumarMes(mes, -1))}>
          <Icono nombre="izquierda" className="size-4" />
        </Boton>
        <span className="min-w-40 text-center font-medium">{nombreMes(mes)}</span>
        <Boton chico variante="secundario" aria-label="Mes siguiente" onClick={() => setMes(sumarMes(mes, 1))}>
          <Icono nombre="derecha" className="size-4" />
        </Boton>
      </div>
      {datos.error ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !d ? (
        <Cargando />
      ) : d.presupuestos.length === 0 ? (
        <Vacio>No tienes presupuestos. Crea uno para cuidar lo que gastas en comida, arriendo o gasolina.</Vacio>
      ) : (
        <>
          <Tarjeta className="mb-4 grid grid-cols-2 gap-3">
            <Cifra etiqueta="Presupuestado" valor={d.total_presupuestado} />
            <Cifra etiqueta="Gastado" valor={d.total_gastado} tono="gasto" />
          </Tarjeta>
          <div className="space-y-2">
            {d.presupuestos.map((p) => (
              <Tarjeta key={p.id}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{p.categoria}</span>
                  <span className="cifra text-sm text-texto-suave">
                    {dinero(p.gastado)} / {dinero(p.presupuestado)}
                  </span>
                </div>
                <Barra porcentaje={p.porcentaje_barra} tono={p.excedido ? 'gasto' : p.en_alerta ? 'aviso' : 'acento'} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className={p.excedido ? 'text-xs text-gasto' : p.en_alerta ? 'text-xs text-aviso' : 'text-xs text-texto-suave'}>
                    {p.excedido ? `Excedido por ${dinero(-numero(p.restante))}` : `${p.porcentaje}% · quedan ${dinero(p.restante)}`}
                  </p>
                  <div className="flex gap-1">
                    <Boton chico variante="fantasma" aria-label="Editar" onClick={() => abrir(p)}>
                      <Icono nombre="lapiz" className="size-4" />
                    </Boton>
                    <Boton chico variante="fantasma" aria-label="Quitar" onClick={() => eliminar(p)}>
                      <Icono nombre="basura" className="size-4" />
                    </Boton>
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>
        </>
      )}
      <Modal abierto={editando !== null} onCerrar={() => setEditando(null)} titulo={editando === 'nuevo' ? 'Nuevo presupuesto' : 'Editar presupuesto'}>
        <form onSubmit={guardar} className="space-y-4">
          {editando === 'nuevo' && (
            <Campo etiqueta="Categoría" error={envio.errores.id_categoria}>
              <SelectorCategoria categorias={opciones} valor={f.id_categoria} onCambio={(id_categoria) => setF({ ...f, id_categoria })} />
            </Campo>
          )}
          <Campo etiqueta="Tope mensual" error={envio.errores.monto}>
            <EntradaMonto value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} required />
          </Campo>
          <AlertaError mensaje={envio.error} />
          <Boton type="submit" className="w-full" cargando={envio.enviando} disabled={f.id_categoria === null}>
            Guardar
          </Boton>
        </form>
      </Modal>
    </>
  )
}
