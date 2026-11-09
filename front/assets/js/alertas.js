// Alertas en vivo: stock, caducidad y equipos
const GRUPO = {
  AGOTADO: 'STOCK', STOCK_BAJO: 'STOCK', CADUCADO: 'CADUCIDAD', POR_CADUCAR: 'CADUCIDAD',
  EN_MANTENIMIENTO: 'EQUIPOS', FUERA_DE_SERVICIO: 'EQUIPOS', SIN_DISPONIBLES: 'EQUIPOS',
  MANTENIMIENTO_VENCIDO: 'EQUIPOS', MANTENIMIENTO_PROXIMO: 'EQUIPOS',
};

(async () => {
  const $res = document.getElementById('resumen-alertas');
  try {
    const alertas = await api('/inventario/alertas');
    const altas = alertas.filter((a) => a.prioridad === 'alta').length;
    $res.textContent = alertas.length
      ? `${alertas.length} alerta(s) activa(s), ${altas} urgente(s). Se calculan con el inventario actual cada vez que abres esta página.`
      : 'Sin alertas activas. El inventario está en orden.';
    document.getElementById('alertas').innerHTML = alertas.map((a, i) => {
      const grupo = GRUPO[a.tipo] || 'INVENTARIO';
      const color = grupo === 'EQUIPOS' ? 'violet-text' : 'orange-text';
      return `<article class="panel alert-card${a.prioridad === 'alta' ? ' urgente' : ''}">
        <div class="card-top"><span class="overline ${color}">${String(i + 1).padStart(2, '0')} / ${grupo}</span>${a.prioridad === 'alta' ? '<span class="badge orange">Urgente</span>' : '<span class="badge violet">Atender</span>'}</div>
        <h2>${esc(a.nombre)}</h2>
        <p><code>${esc(a.codigo)}</code> · ${esc(et(a.tipo))}. ${esc(a.mensaje)}.</p>
        <a class="text-link" href="inventario.html#ficha-${encodeURIComponent(a.codigo)}">Consultar material ↗</a>
      </article>`;
    }).join('');
    animarHijos(document.getElementById('alertas'));
  } catch (e) {
    $res.textContent = 'No se pudieron cargar las alertas: ' + e.message;
  }
})();
