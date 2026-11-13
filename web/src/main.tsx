import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { ProveedorAvisos, ProveedorConfirmar, ProveedorSaldo, ProveedorSesion, useSesion } from './componentes/Globales'
import { Simbolo } from './componentes/Marca'
import { Marco } from './componentes/Marco'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import './index.css'
import Atajos from './paginas/Atajos'
import CajitaDetalle from './paginas/CajitaDetalle'
import Caparazon from './paginas/Caparazon'
import Calendario from './paginas/Calendario'
import Compartido from './paginas/Compartido'
import Compartir from './paginas/Compartir'
import Fuentes from './paginas/Fuentes'
import HistorialAhorro from './paginas/HistorialAhorro'
import Inicio from './paginas/Inicio'
import Landing from './paginas/Landing'
import Login from './paginas/Login'
import MovimientoForm from './paginas/MovimientoForm'
import Movimientos from './paginas/Movimientos'
import Presupuestos from './paginas/Presupuestos'
import Producido from './paginas/Producido'
import Recuperar from './paginas/Recuperar'
import RecurrenteForm from './paginas/RecurrenteForm'
import Recurrentes from './paginas/Recurrentes'
import Registro from './paginas/Registro'
import Reparto from './paginas/Reparto'
import Restablecer from './paginas/Restablecer'
import { aplicarPreferenciasGuardadas } from './tema/tema'

aplicarPreferenciasGuardadas()

function Espera() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <Simbolo className="size-16 animate-pulse" titulo="Cargando Hicotea" />
    </div>
  )
}

/** Solo con sesión; si no, a /login recordando a dónde iba. */
function Privada() {
  const { usuario } = useSesion()
  const { pathname, search } = useLocation()
  if (usuario === undefined) return <Espera />
  if (usuario === null) return <Navigate to="/login" replace state={{ desde: pathname + search }} />
  return <Marco />
}

/** Login/registro: quien ya tiene sesión va a /inicio. */
function Publica({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()
  if (usuario === undefined) return <Espera />
  if (usuario) return <Navigate to="/inicio" replace />
  return children
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <ProveedorSaldo>
          <ProveedorAvisos>
            <ProveedorConfirmar>
              <Routes>
                <Route path="/" element={<Publica><Landing /></Publica>} />
                <Route path="/login" element={<Publica><Login /></Publica>} />
                <Route path="/registro" element={<Publica><Registro /></Publica>} />
                <Route path="/recuperar" element={<Publica><Recuperar /></Publica>} />
                <Route path="/restablecer" element={<Publica><Restablecer /></Publica>} />
                <Route element={<Privada />}>
                  <Route path="/inicio" element={<Inicio />} />
                  <Route path="/movimientos" element={<Movimientos />} />
                  <Route path="/movimientos/nuevo" element={<MovimientoForm />} />
                  <Route path="/movimientos/:id" element={<MovimientoForm />} />
                  <Route path="/producido" element={<Producido />} />
                  <Route path="/calendario" element={<Calendario />} />
                  <Route path="/fuentes" element={<Fuentes />} />
                  {/* Caparazón reúne cajitas y metas; /cajitas y /metas redirigen para no romper enlaces viejos. */}
                  <Route path="/caparazon" element={<Caparazon />} />
                  <Route path="/caparazon/historial" element={<HistorialAhorro />} />
                  <Route path="/cajitas" element={<Navigate to="/caparazon" replace />} />
                  <Route path="/cajitas/reparto" element={<Reparto />} />
                  <Route path="/cajitas/:id" element={<CajitaDetalle />} />
                  <Route path="/metas" element={<Navigate to="/caparazon" replace />} />
                  <Route path="/presupuestos" element={<Presupuestos />} />
                  <Route path="/recurrentes" element={<Recurrentes />} />
                  <Route path="/recurrentes/nuevo" element={<RecurrenteForm />} />
                  <Route path="/recurrentes/:id" element={<RecurrenteForm />} />
                  <Route path="/atajos" element={<Atajos />} />
                  <Route path="/categorias" element={<Navigate to="/atajos" replace />} />
                  <Route path="/compartir" element={<Compartir />} />
                  <Route path="/compartido/:titular" element={<Compartido />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ProveedorConfirmar>
          </ProveedorAvisos>
        </ProveedorSaldo>
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
)
