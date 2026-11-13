// Verifica WCAG AA (4.5:1 texto normal) de los pares críticos de cada combinación estilo × apariencia × paleta.
const L = (hex) => { const c = hex.replace('#','').match(/../g).map(h => parseInt(h,16)/255).map(v => v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2] }
const R = (a,b) => { const [x,y] = [L(a),L(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05) }
// Uso: node web/scripts/contraste.mjs [archivo.json]  (por defecto, web/scripts/contraste-paletas.json)
import { readFileSync } from "node:fs"
const ruta = process.argv[2] ?? new URL("./contraste-paletas.json", import.meta.url)
const combos = JSON.parse(readFileSync(ruta, "utf8"))
let fallos = 0
for (const [nombre, t] of Object.entries(combos)) {
  const pares = [
    ['texto/fondo', t.texto, t.fondo], ['texto/superficie', t.texto, t.superficie], ['texto/superficie-2', t.texto, t['superficie-2']],
    ['texto-suave/superficie', t['texto-suave'], t.superficie], ['texto-suave/fondo', t['texto-suave'], t.fondo],
    ['acento/superficie', t.acento, t.superficie], ['sobre-acento/acento', t['texto-sobre-acento'], t.acento],
    ['ingreso/superficie', t.ingreso, t.superficie], ['gasto/superficie', t.gasto, t.superficie], ['aviso/superficie', t.aviso, t.superficie],
    ...(t.series ?? []).map((s,i) => [`sobre-serie/serie-${i+1}`, t['texto-sobre-serie'], s]),
  ]
  const malos = pares.filter(([,a,b]) => R(a,b) < 4.5)
  fallos += malos.length
  console.log(`${malos.length ? '✗' : '✓'} ${nombre}` + (malos.length ? ': ' + malos.map(([n,a,b]) => `${n} ${R(a,b).toFixed(2)}`).join(', ') : `  (mín ${Math.min(...pares.map(([,a,b])=>R(a,b))).toFixed(2)})`))
}
process.exit(fallos ? 1 : 0)
