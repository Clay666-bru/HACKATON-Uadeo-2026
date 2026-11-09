// Etiquetas QR imprimibles de todo el inventario
(async () => {
  const $e = document.getElementById('etiquetas');
  try {
    const articulos = await cargarArticulos();
    $e.innerHTML = articulos.map((a) => `
      <figure class="etiqueta">
        <img src="/api/inventario/qr/${encodeURIComponent(a.codigo)}" alt="QR ${esc(a.codigo)}" loading="lazy" width="150" height="150">
        <figcaption><strong>${esc(a.codigo)}</strong><span>${esc(a.nombre)}</span></figcaption>
      </figure>`).join('') || '<p class="muted">No hay artículos registrados.</p>';
    animarHijos($e, 20);
  } catch (e) {
    $e.innerHTML = `<p class="muted">No se pudieron cargar las etiquetas: ${esc(e.message)}</p>`;
  }
})();
