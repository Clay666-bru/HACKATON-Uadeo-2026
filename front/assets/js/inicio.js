// Inicio: indicadores, últimos movimientos, alertas y vista previa del inventario
function itemBitacora(m) {
  const entrada = m.tipo === 'ENTRADA';
  const color = entrada ? 'mint' : 'orange';
  const persona = m.persona || m.proveedor || m.responsable;
  return `<article class="timeline-item"><span class="timeline-dot ${color}"></span>
    <div class="card-top"><span class="badge ${color}">${et(m.tipo)} · ${esc(et(m.motivo))}</span><small>${fechaCorta(m.fecha_hora, true)}</small></div>
    <h3>${esc(m.nombre)} <code>${esc(m.codigo)}</code></h3>
    <p>${esc(persona)} <strong class="${color === 'mint' ? 'mint-text' : 'orange-text'}">${entrada ? '+' : '−'} ${numero(m.cantidad)} ${esc(m.unidad)}</strong></p></article>`;
}

function filaAlerta(a) {
  const simbolo = { STOCK_BAJO: '↓', AGOTADO: '↓', CADUCADO: '!', POR_CADUCAR: '⏱' }[a.tipo] || '⚙';
  const color = a.tipo.includes('MANTENIMIENTO') ? 'violet' : 'orange';
  return `<a class="alert-row" href="inventario.html#ficha-${encodeURIComponent(a.codigo)}"><span class="alert-symbol ${color}">${simbolo}</span>
    <div><h3>${esc(a.nombre)}</h3><p>${esc(a.codigo)} · ${esc(a.mensaje)}</p><small>${esc(et(a.tipo).toUpperCase())}${a.prioridad === 'alta' ? ' · URGENTE' : ''}</small></div>↗</a>`;
}

(async () => {
  try {
    const peticiones = [api('/inventario/resumen'), api('/inventario/alertas'), cargarArticulos()];
    if (sesion.rol !== 'profesor') peticiones.push(api('/movimientos?limite=4'));
    const [r, alertas, articulos, movs] = await Promise.all(peticiones);

    const noOperativos = r.equipos.en_mantenimiento + r.equipos.fuera_de_servicio;
    const barras = () => Array.from({ length: 10 }, (_, i) => `<i style="--b:${i}"></i>`).join('');
    const cuenta = (n) => `<b class="cuenta" data-cuenta="${n}" data-ancho="2">00</b>`;
    // Figura grande (decorativa) que se dibuja y crece al pasar el mouse
    const figura = (icono) => `<span class="stat-figura" aria-hidden="true">${icono}</span>`;
    document.getElementById('stats').innerHTML = `
      <article class="stat">${figura(ICONOS.matraz)}<div><span>Materiales registrados</span>${ICONOS.matraz}</div>
        <strong>${cuenta(r.materiales.total)}<span>materiales</span></strong>
        <p><span class="mint-text">${r.materiales.reactivos} reactivos</span> · ${r.materiales.consumibles} consumibles</p>
        <div class="mini-bars" aria-hidden="true">${barras()}</div></article>
      <article class="stat">${figura(ICONOS.caja)}<div><span>Equipos</span>${ICONOS.caja}</div>
        <strong>${cuenta(r.equipos.total)}<span>tipos de equipo</span></strong>
        <p><span class="violet-text">${r.equipos.unidades} piezas</span> en almacén</p>
        <a class="stat-link" href="inventario.html">Ver equipos <span>↗</span></a></article>
      <article class="stat">${figura(ICONOS.qr)}<div><span>Movimientos hoy</span>${ICONOS.qr}</div>
        <strong>${cuenta(r.movimientos_hoy)}<span>registros</span></strong>
        <p>Entradas y salidas del día</p>
        ${esLab ? '<a class="stat-link" href="movimientos.html">Registrar movimiento <span>↗</span></a>' : ''}</article>
      <article class="stat">${figura(ICONOS.alerta)}<div><span>Alertas activas</span>${ICONOS.alerta}</div>
        <strong>${cuenta(alertas.length)}<span>requieren atención</span></strong>
        <p><span class="orange-text">${r.materiales.stock_bajo} de stock</span> · ${r.materiales.caducados} caducados · ${noOperativos} equipo(s)</p>
        <a class="stat-link" href="alertas.html">Ver prioridades <span>↗</span></a></article>`;
    const $stats = document.getElementById('stats');
    // La figura va al final de la tarjeta (el diseño usa el primer hijo como encabezado)
    // y cada trazo mide 100 para poder animar su "dibujo" con stroke-dashoffset
    $stats.querySelectorAll('.stat').forEach((card) => card.append(card.querySelector('.stat-figura')));
    $stats.querySelectorAll('.stat-figura svg *').forEach((el) => el.setAttribute('pathLength', '100'));
    animarHijos($stats);
    animarConteos($stats);

    const $ultimos = document.getElementById('ultimos');
    if (movs) {
      $ultimos.innerHTML = movs.length ? movs.map(itemBitacora).join('') : '<p class="muted">Aún no hay movimientos.</p>';
    } else {
      $ultimos.closest('.panel').remove(); // el profesor no ve la bitácora
      document.querySelector('.dashboard-grid')?.classList.add('una-columna');
    }

    document.getElementById('radar-n').textContent = String(alertas.length).padStart(2, '0');
    document.getElementById('radar').innerHTML = alertas.length
      ? alertas.slice(0, 4).map(filaAlerta).join('') + (alertas.length > 4 ? `<div class="panel-foot"><a class="text-link" href="alertas.html">Ver las ${alertas.length} alertas ↗</a></div>` : '')
      : '<p class="muted panel-body">Sin alertas. Todo en orden.</p>';

    document.getElementById('preview').innerHTML = articulos.slice(0, 6).map(filaArticulo).join('');
    ['ultimos', 'radar', 'preview'].forEach((id) => animarHijos(document.getElementById(id)));
  } catch (e) {
    document.getElementById('stats').innerHTML = `<div class="notice warning">${ICONOS.info}<p>No se pudieron cargar los datos: ${esc(e.message)}</p></div>`;
  }
})();
