// Resúmenes y mantenimiento: semestre con cuenta regresiva (laboratorio y coordinación) y reportes (coordinación)
const $sem = document.getElementById('semestre');
let reloj = null;

function cuenta(segundos) {
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return [[d, 'días'], [h, 'horas'], [m, 'minutos'], [s, 'segundos']]
    .map(([n, t]) => `<div><b>${String(n).padStart(2, '0')}</b><span>${t}</span></div>`).join('');
}

function pintarActivo(s) {
  let restantes = s.segundos_restantes;
  const inicio = new Date(s.inicio.replace(' ', 'T'));
  const fin = new Date(s.fin.replace(' ', 'T'));
  const avance = Math.min(100, Math.max(0, ((Date.now() - inicio) / (fin - inicio)) * 100));
  $sem.innerHTML = `<div class="card-top"><p class="eyebrow">SEMESTRE EN CURSO</p>${badgeEstado('ACTIVO')}</div>
    <h2>${esc(s.nombre)}</h2>
    <p class="muted">Del ${fechaCorta(s.inicio)} al ${fechaCorta(s.fin)} · lo inició ${esc(s.iniciado_por)} · inventario inicial guardado (${s.articulos_inicio} artículos)</p>
    <p class="eyebrow cuenta-titulo">FALTA PARA LIMPIEZA Y MANTENIMIENTO</p>
    <div class="cuenta-regresiva" id="cuenta" aria-live="off">${cuenta(restantes)}</div>
    <div class="conducta-barra" role="progressbar" aria-valuenow="${Math.round(avance)}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance del semestre"><i style="--avance:${avance}%"></i></div>
    <p class="nota">Al terminar se guarda el inventario final y llega un aviso a coordinación y laboratorio.</p>
    <div class="semestre-acciones">
      <button class="button primary" type="button" data-finalizar="${s.id}">Finalizar ahora</button>
      <button class="button peligro" type="button" data-cancelar-semestre="${s.id}">Cancelar semestre</button>
    </div>`;
  clearInterval(reloj);
  reloj = setInterval(() => {
    restantes = Math.max(0, restantes - 1);
    document.getElementById('cuenta').innerHTML = cuenta(restantes);
    if (!restantes) { clearInterval(reloj); setTimeout(cargarSemestre, 65000); } // el servidor lo cierra en menos de un minuto
  }, 1000);
}

function pintarInicio(ultimo) {
  const min = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  $sem.innerHTML = `<p class="eyebrow">INICIO DE SEMESTRE</p><h2>Iniciar semestre</h2>
    <p class="muted">Al iniciar se guarda una foto del inventario actual y empieza la cuenta regresiva hasta la fecha de fin. Al terminar se avisará que es momento de limpieza y mantenimiento.</p>
    ${ultimo ? `<p class="nota">Último semestre: ${esc(ultimo.nombre)} (${esc(et(ultimo.estado))} el ${fechaCorta(ultimo.finalizado || ultimo.fin)}).</p>` : ''}
    <form id="form-semestre" novalidate><div class="form-grid">
      <label>Nombre (opcional)<input name="nombre" maxlength="60" placeholder="Ej. Agosto–Diciembre 2026"></label>
      <label>Fin del semestre<input type="date" name="fin" required min="${min}"></label>
    </div><p class="form-error" role="alert" hidden></p>
    <button class="button primary" type="submit">${NAV_ICONOS.reloj} Iniciar semestre</button></form>`;
  document.getElementById('form-semestre').addEventListener('submit', async (e) => {
    e.preventDefault();
    const $f = e.target;
    const $err = $f.querySelector('.form-error');
    if (!$f.fin.value) { $err.textContent = 'Selecciona la fecha de fin del semestre.'; $err.hidden = false; return; }
    const r = await preguntar({ titulo: 'Iniciar semestre', texto: `Se guardará el inventario actual y la cuenta regresiva terminará el ${fechaCorta($f.fin.value)}.`, boton: 'Iniciar' });
    if (!r.ok) return;
    try {
      await api('/semestres/iniciar', { method: 'POST', body: { nombre: $f.nombre.value, fin: $f.fin.value } });
      toast('Semestre iniciado; inventario inicial guardado');
      await cargarSemestre();
    } catch (er) { $err.textContent = er.message; $err.hidden = false; }
  });
}

async function cargarSemestre() {
  const [actual, todos] = await Promise.all([fetch('/api/semestres/actual', { headers: { Authorization: `Bearer ${sesion.token}` } }).then((r) => r.json()), api('/semestres')]);
  if (actual.data) pintarActivo(actual.data); else pintarInicio(actual.ultimo);
  document.getElementById('historial').innerHTML = todos.length
    ? `<table><thead><tr><th>Semestre</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Inventario inicial / final</th></tr></thead><tbody>
      ${todos.map((s) => `<tr><td><strong>${esc(s.nombre)}</strong><br><small class="muted">${esc(s.iniciado_por)}</small></td><td>${fechaCorta(s.inicio)}</td><td>${fechaCorta(s.fin)}</td><td>${badgeEstado(s.estado)}</td><td>${s.articulos_inicio} / ${s.articulos_fin || '—'}</td></tr>`).join('')}</tbody></table>`
    : vacio('Aún no se ha iniciado ningún semestre.');
  // Selectores de semestre de los reportes
  // Selectores de semestre de los reportes (los cancelados no tienen reporte)
  const validos = todos.filter((s) => s.estado !== 'CANCELADO');
  document.querySelectorAll('.sel-semestre').forEach((sel) => {
    sel.innerHTML = validos.length ? validos.map((s) => `<option value="${s.id}">${esc(s.nombre)}</option>`).join('') : '<option value="">Sin semestres</option>';
  });
}

// ---------- Reportes (solo coordinación) ----------
function rutaReporte(card) {
  const tipo = card.dataset.reporte;
  const sem = card.querySelector('.sel-semestre')?.value;
  if (tipo === 'inventario') return '/reportes/inventario';
  if (tipo === 'batas') {
    const porSemestre = card.querySelector('[name=tipo-periodo]').value === 'semestre';
    if (porSemestre) { if (!sem) throw new Error('Primero inicia un semestre'); return `/reportes/batas?semestre_id=${sem}`; }
    const mes = card.querySelector('[name=mes]').value;
    if (!mes) throw new Error('Elige el mes');
    return `/reportes/batas?mes=${mes}`;
  }
  if (!sem) throw new Error('Primero inicia un semestre');
  if (tipo === 'comparacion') return `/reportes/comparacion?semestre_id=${sem}`;
  return `/reportes/movimientos?tipo=${tipo === 'salidas' ? 'SALIDA' : 'ENTRADA'}&semestre_id=${sem}`;
}

function pintarReporte(r, ruta) {
  const $v = document.getElementById('vista-reporte');
  $v.hidden = false;
  $v.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">${esc(r.periodo)}</p><h2>${esc(r.titulo)}</h2></div>
      <button class="button primary" type="button" data-pdf-ruta="${esc(ruta)}">Imprimir / PDF</button></div>
    <div class="panel-cuerpo">
    <ul class="chips-resumen">${r.resumen.map((x) => `<li>${esc(x.etiqueta)}<b>${numero(x.valor)}</b></li>`).join('')}</ul>
    ${r.tablas.map((t) => `<h3>${esc(t.titulo)}</h3>${t.filas.length ? `<div class="table-scroll"><table class="tabla-compacta"><thead><tr>${t.columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join('')}</tr></thead>
      <tbody>${t.filas.slice(0, 100).map((f) => `<tr>${t.columnas.map((c) => `<td>${esc(typeof f[c.campo] === 'number' ? numero(f[c.campo]) : f[c.campo] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${t.filas.length > 100 ? `<p class="nota">Se muestran 100 de ${t.filas.length} filas; el PDF las incluye todas.</p>` : ''}` : vacio('Sin registros en este periodo.')}`).join('')}
    ${r.nota ? `<p class="nota">${esc(r.nota)}</p>` : ''}</div>`;
  $v.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('contenido').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.finalizar) {
      const r = await preguntar({ titulo: 'Finalizar semestre ahora', texto: 'Se detiene la cuenta regresiva, se guarda el inventario final para la comparación y se avisa que es momento de limpieza y mantenimiento.', boton: 'Finalizar semestre' });
      if (!r.ok) return;
      await api(`/semestres/${b.dataset.finalizar}/finalizar`, { method: 'POST' });
      clearInterval(reloj);
      toast('Semestre finalizado; inventario final guardado');
      return await cargarSemestre();
    }
    if (b.dataset.cancelarSemestre) {
      const r = await preguntar({ titulo: 'Cancelar semestre', texto: 'Se detiene la cuenta regresiva sin guardar inventario final ni avisar mantenimiento. Quedará como cancelado en el historial y podrás iniciar otro.', boton: 'Cancelar semestre', peligro: true });
      if (!r.ok) return;
      await api(`/semestres/${b.dataset.cancelarSemestre}/cancelar`, { method: 'POST' });
      clearInterval(reloj);
      toast('Semestre cancelado');
      return await cargarSemestre();
    }
    if (b.dataset.pdfRuta) return await abrirConSesion(`${b.dataset.pdfRuta}${b.dataset.pdfRuta.includes('?') ? '&' : '?'}formato=html`);
    const card = b.closest('[data-reporte]');
    if (!card) return;
    const ruta = rutaReporte(card);
    if (b.hasAttribute('data-pdf')) await abrirConSesion(`${ruta}${ruta.includes('?') ? '&' : '?'}formato=html`);
    else if (b.hasAttribute('data-ver')) pintarReporte(await api(ruta), ruta);
  } catch (er) { toast(er.message, 'error'); }
});
document.querySelectorAll('[name=tipo-periodo]').forEach((s) => s.addEventListener('change', () => {
  const card = s.closest('[data-reporte]');
  card.querySelectorAll('[data-periodo]').forEach((l) => { l.hidden = l.dataset.periodo !== s.value; });
}));
const $mes = document.querySelector('[name=mes]');
if ($mes) $mes.value = hoyISO().slice(0, 7);

cargarSemestre().catch((e) => { $sem.innerHTML = vacio('No se pudo cargar el semestre: ' + e.message); });
