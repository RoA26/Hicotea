import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from './Iconos'

export function MarcoAuth({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo?: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <Logo className="h-10 w-12" />
        <span className="text-2xl font-bold tracking-tight">Hicotea</span>
      </Link>
      <div className="w-full max-w-sm rounded-3xl border border-borde bg-superficie p-6">
        <h1 className="text-xl font-bold">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-texto-suave">{subtitulo}</p>}
        <div className="mt-5">{children}</div>
      </div>
      {pie && <div className="mt-6 text-center text-sm text-texto-suave">{pie}</div>}
    </main>
  )
}
