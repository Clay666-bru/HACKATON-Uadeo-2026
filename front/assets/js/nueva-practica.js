// Solicitud de laboratorio del profesor: clase, horario libre, materiales por equipo y reglamento
const $f = document.getElementById('form-practica');
const $err = $f.querySelector('.form-error');
let clases = [];
let articulos = [];
const items = []; // { clase, id, codigo, nombre, unidad, disponible, cantidad }

const sumarDias = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let fechaMinima = sumarDias(hoyISO(), 7);
$f.fecha.min = fechaMinima;
document.getElementById('nota-fecha').textContent = `Se solicita con una semana de anticipación: a partir del ${fechaCorta(fechaMinima)}, de lunes a viernes.`;

// ---------- Grupo y materia (de las clases del profesor) ----------
function pintarMaterias() {
  const g = Number($f.grupo_id.value);
  const mats = clases.filter((c) => c.grupo_id === g);
  $f.materia_id.innerHTML = mats.map((c) => `<option value="${c.materia_id}">${esc(c.materia)}</option>`).join('');
}
$f.grupo_id.addEventListener('change', pintarMaterias);

// ---------- Horario ----------
async function pintarBloques() {
  const $b = document.getElementById('bloques');
  const f = $f.fecha.value;
  if (!f) { $b.innerHTML = ''; return; }
  const dia = new Date(`${f}T00:00:00`).getDay();
  if (dia === 0 || dia === 6) { $b.innerHTML = '<p class="nota orange-text">El laboratorio solo se agenda de lunes a viernes.</p>'; return; }
  if (f < fechaMinima) { $b.innerHTML = `<p class="nota orange-text">Necesitas al menos una semana de anticipación (desde el ${fechaCorta(fechaMinima)}).</p>`; return; }
  $b.innerHTML = '<p class="muted">Revisando disponibilidad…</p>';
  try {
    const r = await api(`/practicas/disponibilidad?desde=${f}&dias=1`);
    const d = r.dias[0];
    $b.innerHTML = `<p class="bloques-titulo">Horarios habituales · toca uno para usarlo</p>
      <div class="bloques-lista">${d.bloques.map((x) => `<button type="button" class="bloque ${x.libre ? 'libre' : 'ocupado'}" ${x.libre ? '' : 'disabled'} data-ini="${x.hora_inicio}" data-fin="${x.hora_fin}">${x.hora_inicio}–${x.hora_fin}<small>${x.libre ? 'Libre' : 'Ocupado'}</small></button>`).join('')}</div>
      ${d.ocupado.length ? `<p class="nota">Apartado ese día: ${d.ocupado.map((o) => `${o.hora_inicio}–${o.hora_fin} (${esc(o.grupo)})`).join(', ')}. También puedes escribir otro horario libre.</p>` : '<p class="nota">El laboratorio está libre todo el día; también puedes escribir otro horario.</p>'}`;
    marcarBloque();
  } catch (e) { $b.innerHTML = `<p class="nota orange-text">${esc(e.message)}</p>`; }
}
function marcarBloque() {
  document.querySelectorAll('.bloques-lista .bloque').forEach((b) => b.classList.toggle('elegido', b.dataset.ini === $f.hora_inicio.value && b.dataset.fin === $f.hora_fin.value));
}
$f.fecha.addEventListener('change', pintarBloques);
$f.hora_inicio.addEventListener('change', marcarBloque);
$f.hora_fin.addEventListener('change', marcarBloque);
document.getElementById('bloques').addEventListener('click', (e) => {
  const b = e.target.closest('.bloque.libre');
  if (!b) return;
  $f.hora_inicio.value = b.dataset.ini;
  $f.hora_fin.value = b.dataset.fin;
  marcarBloque();
});

// ---------- Materiales ----------
function pintarItems() {
  const n = Math.max(1, Number($f.num_equipos.value) || 1);
  const $t = document.getElementById('items');
  $t.innerHTML = items.length ? items.map((it, i) => {
    const total = it.cantidad * n;
    const falta = total > it.disponible;
    return `<tr><td><strong>${esc(it.nombre)}</strong> <code>${esc(it.codigo)}</code></td>
      <td><input class="cantidad-item" type="number" min="0.01" step="any" value="${it.cantidad}" data-i="${i}" aria-label="Cantidad por equipo de ${esc(it.nombre)}"> ${esc(it.unidad)}</td>
      <td class="${falta ? 'orange-text' : ''}">${numero(total)} ${esc(it.unidad)}${falta ? ' · no alcanza hoy' : ''}</td>
      <td>${numero(it.disponible)}</td>
      <td><button type="button" class="text-link" data-quitar="${i}">Quitar</button></td></tr>`;
  }).join('') : '<tr><td colspan="5" class="muted">Aún no agregas materiales.</td></tr>';
}
$f.num_equipos.addEventListener('input', pintarItems);
document.getElementById('btn-agregar').addEventListener('click', () => {
  const [clase, id] = document.getElementById('articulo').value.split(':');
  const cantidad = Number(document.getElementById('cantidad').value);
  if (!id) return;
  if (!(cantidad > 0)) { toast('Escribe una cantidad mayor a 0', 'error'); return; }
  const a = articulos.find((x) => x.clase === clase && x.id === Number(id));
  if ((clase === 'equipo' || a.unidad === 'pza') && !Number.isInteger(cantidad)) { toast('Las piezas y equipos van en números enteros', 'error'); return; }
  const ya = items.find((x) => x.clase === clase && x.id === a.id);
  if (ya) ya.cantidad = cantidad; else items.push({ ...a, cantidad });
  pintarItems();
});
document.getElementById('items').addEventListener('click', (e) => {
  const q = e.target.closest('[data-quitar]');
  if (q) { items.splice(Number(q.dataset.quitar), 1); pintarItems(); }
});
document.getElementById('items').addEventListener('change', (e) => {
  const c = e.target.closest('.cantidad-item');
  if (c && Number(c.value) > 0) { items[Number(c.dataset.i)].cantidad = Number(c.value); pintarItems(); }
});

// ---------- Carga inicial ----------
(async () => {
  try {
    const [cl, mats, eqs] = await Promise.all([api('/escolar/clases'), api('/inventario/materiales'), api('/inventario/equipos')]);
    clases = cl;
    const grupos = [...new Map(clases.map((c) => [c.grupo_id, c])).values()];
    $f.grupo_id.innerHTML = grupos.map((c) => `<option value="${c.grupo_id}">${esc(c.grupo)} · ${esc(et(c.turno))}</option>`).join('');
    document.getElementById('sin-clases').hidden = grupos.length > 0;
    pintarMaterias();
    articulos = [
      ...mats.map((m) => ({ clase: 'material', id: m.id, codigo: m.codigo, nombre: m.nombre, unidad: m.unidad, disponible: m.stock, tipo: m.tipo })),
      ...eqs.map((e) => ({ clase: 'equipo', id: e.id, codigo: e.codigo, nombre: e.nombre, unidad: 'pza', disponible: e.cantidad, tipo: 'EQUIPO' })),
    ];
    const grupo = (tipo, titulo) => `<optgroup label="${titulo}">${articulos.filter((a) => a.tipo === tipo).map((a) => `<option value="${a.clase}:${a.id}">${esc(a.nombre)} · ${esc(a.codigo)} (${numero(a.disponible)} ${esc(a.unidad)})</option>`).join('')}</optgroup>`;
    document.getElementById('articulo').innerHTML = grupo('REACTIVO', 'Reactivos') + grupo('CONSUMIBLE', 'Consumibles') + grupo('EQUIPO', 'Equipos');
    // Viene del calendario con un horario elegido
    const q = new URLSearchParams(location.search);
    if (q.get('fecha')) { $f.fecha.value = q.get('fecha'); $f.hora_inicio.value = q.get('ini') || ''; $f.hora_fin.value = q.get('fin') || ''; pintarBloques(); }
  } catch (e) { toast(e.message, 'error'); }
})();

// ---------- Enviar: primero la ventana del reglamento ----------
$f.addEventListener('submit', async (e) => {
  e.preventDefault();
  $err.hidden = true;
  const falta = (m, el) => { $err.textContent = m; $err.hidden = false; el?.focus(); };
  if (!$f.grupo_id.value || !$f.materia_id.value) return falta('Elige grupo y materia.');
  if (!$f.titulo.value.trim()) return falta('Escribe el nombre de la práctica.', $f.titulo);
  if (!$f.descripcion.value.trim()) return falta('Describe la práctica.', $f.descripcion);
  if (!$f.fecha.value) return falta('Elige la fecha.', $f.fecha);
  if (!$f.hora_inicio.value || !$f.hora_fin.value) return falta('Elige la hora de inicio y de término.', $f.hora_inicio);
  if ($f.hora_inicio.value >= $f.hora_fin.value) return falta('La hora de inicio debe ser antes de la de término.', $f.hora_inicio);
  const datos = {
    grupo_id: Number($f.grupo_id.value), materia_id: Number($f.materia_id.value), titulo: $f.titulo.value.trim(), descripcion: $f.descripcion.value.trim(),
    fecha: $f.fecha.value, hora_inicio: $f.hora_inicio.value, hora_fin: $f.hora_fin.value, num_equipos: Number($f.num_equipos.value),
    items: items.map((i) => (i.clase === 'material' ? { material_id: i.id, cantidad_por_equipo: i.cantidad } : { equipo_id: i.id, cantidad_por_equipo: i.cantidad })),
  };
  let reglamento;
  try { reglamento = await api('/practicas/reglamento'); } catch (er) { return falta(er.message); }
  const dlg = abrirDialogo(`<form novalidate>
    <p class="eyebrow">ANTES DE ENVIAR</p><h2>Reglamento del laboratorio</h2>
    <p>Para enviar la solicitud debes estar consciente y aceptar el <strong>reglamento del laboratorio</strong> de ${esc(reglamento.programa)}.</p>
    <button class="button" type="button" data-leer>${ICONOS.info} Leer el reglamento</button>
    <div class="reglamento" hidden>${reglamento.secciones.map((s) => `<h3>${esc(s.titulo)}</h3><ul>${s.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')}
      <p><a class="text-link" href="${esc(reglamento.archivo)}">Descargar el reglamento (.docx) ↓</a></p></div>
    <label class="check"><input type="checkbox" name="acepto"> He leído el reglamento, estoy de acuerdo y me comprometo a cumplirlo.</label>
    <p class="form-error" role="alert" hidden></p>
    <div class="modal-acciones"><span class="espacio"></span><button class="button" type="button" data-cerrar>Volver</button><button class="button primary" type="submit" disabled>Enviar solicitud</button></div></form>`, 'modal-reglamento');
  const $d = dlg.querySelector('form');
  const $btn = $d.querySelector('[type=submit]');
  $d.querySelector('[data-leer]').addEventListener('click', () => { const r = $d.querySelector('.reglamento'); r.hidden = !r.hidden; });
  $d.acepto.addEventListener('change', () => { $btn.disabled = !$d.acepto.checked; });
  $d.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $btn.disabled = true;
    try {
      const resp = await fetch('/api/practicas', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` },
        body: JSON.stringify({ ...datos, acepta_reglamento: true }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || `Error ${resp.status}`);
      cerrarDialogo(dlg);
      toast('Solicitud enviada a coordinación');
      (j.advertencias || []).forEach((a) => toast('Aviso: ' + a, 'error'));
      setTimeout(() => { location.href = `practicas.html#practica-${j.data.id}`; }, 900);
    } catch (er) {
      const $e = $d.querySelector('.form-error'); $e.textContent = er.message; $e.hidden = false; $btn.disabled = false;
    }
  });
});
