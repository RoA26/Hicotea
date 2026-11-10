import { Navigate } from 'react-router'
import { useSesion } from '../componentes/Globales'
import { Logo } from '../componentes/Iconos'
import { BotonEnlace } from '../componentes/ui'

const PUNTOS = [
  { titulo: 'Tu producido del día', texto: 'Registra lo que entró y lo que costó en un toque, fuente por fuente.' },
  { titulo: 'Cajitas de ahorro', texto: 'Reparte lo disponible según tus porcentajes: capital, emergencias, compras.' },
  { titulo: 'Metas y presupuestos', texto: 'Mira cuánto falta, cuánto aportar al mes y cuándo te estás pasando.' },
]

// Versión base (Fase 3). Las partículas y la entrada animada llegan en la Fase 4.
export default function Landing() {
  const { usuario } = useSesion()
  if (usuario) return <Navigate to="/inicio" replace />

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2">
          <Logo className="h-8 w-10" />
          <span className="text-lg font-bold tracking-tight">Hicotea</span>
        </span>
        <BotonEnlace to="/login" variante="fantasma" chico>
          Iniciar sesión
        </BotonEnlace>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <h1 className="max-w-3xl text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
            Lenta pero segura, <span className="texto-degradado">tu plata avanza.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-texto-suave">
            Hicotea lleva tus ingresos, gastos y ahorros como la tortuga lleva su casa: siempre encima y en orden.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BotonEnlace to="/registro">Crear cuenta</BotonEnlace>
            <BotonEnlace to="/login" variante="secundario">
              Ya tengo cuenta
            </BotonEnlace>
          </div>
        </section>
        <section className="grid gap-4 pb-20 sm:grid-cols-3">
          {PUNTOS.map((p) => (
            <div key={p.titulo} className="rounded-2xl border border-borde bg-superficie p-5">
              <h2 className="font-semibold">{p.titulo}</h2>
              <p className="mt-2 text-sm text-texto-suave">{p.texto}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
