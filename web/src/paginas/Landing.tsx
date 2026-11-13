import { Navigate } from 'react-router'
import { ParticulasLanding } from '../animacion/ParticulasLanding'
import { useSesion } from '../componentes/Globales'
import { Wordmark } from '../componentes/Marca'
import { BotonEnlace } from '../componentes/ui'

const PUNTOS = [
  { titulo: 'Tu producido del día', texto: 'Registra lo que entró y lo que costó en un toque, fuente por fuente.' },
  { titulo: 'Cajitas de ahorro', texto: 'Reparte lo disponible según tus porcentajes: capital, emergencias, compras.' },
  { titulo: 'Metas y presupuestos', texto: 'Mira cuánto falta, cuánto aportar al mes y cuándo te estás pasando.' },
]

export default function Landing() {
  const { usuario } = useSesion()
  if (usuario) return <Navigate to="/inicio" replace />

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ParticulasLanding />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark />
        <BotonEnlace to="/login" variante="fantasma" chico>
          Iniciar sesión
        </BotonEnlace>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <h1 className="anim-escalonado max-w-3xl text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
            Lenta pero segura, <span className="texto-degradado">tu plata avanza.</span>
          </h1>
          <p
            className="anim-escalonado mt-5 max-w-xl text-lg text-texto-suave"
            style={{ animationDelay: '100ms' }}
          >
            Hicotea lleva tus ingresos, gastos y ahorros como la tortuga lleva su casa: siempre encima y en orden.
          </p>
          <div
            className="anim-escalonado mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: '180ms' }}
          >
            <BotonEnlace to="/registro">Crear cuenta</BotonEnlace>
            <BotonEnlace to="/login" variante="secundario">
              Ya tengo cuenta
            </BotonEnlace>
          </div>
        </section>
        <section className="grid gap-4 pb-20 sm:grid-cols-3">
          {PUNTOS.map((p, i) => (
            <div
              key={p.titulo}
              className="anim-escalonado rounded-tarjeta border border-borde bg-superficie/80 p-5 backdrop-blur-xs"
              style={{ animationDelay: `${240 + i * 80}ms` }}
            >
              <h2 className="font-semibold">{p.titulo}</h2>
              <p className="mt-2 text-sm text-texto-suave">{p.texto}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
