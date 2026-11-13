// Eliminar datos financieros guardados por versiones anteriores de Hicotea.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('hicotea-api'));
});
