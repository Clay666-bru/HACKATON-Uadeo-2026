// Manuales: por ahora solo se eligen; los archivos se suben después
(async () => {
  const $m = document.getElementById('manuales');
  try {
    const lista = await api('/manuales');
    $m.innerHTML = lista.length ? lista.map((m) => `<article class="panel manual">
      <span class="material-icon violet">${NAV_ICONOS.libro}</span>
      <h3>${esc(m.titulo)}</h3><p class="muted">${esc(m.descripcion || '')}</p>
      ${m.url ? `<a class="button primary" href="${esc(m.url)}" target="_blank" rel="noopener">Abrir manual ↗</a>`
        : '<button class="button" type="button" disabled>Próximamente</button>'}
    </article>`).join('') : vacio('Aún no hay manuales.');
    animarHijos($m);
  } catch (e) { $m.innerHTML = vacio(e.message); }
})();
