// Grupos y equipos: el profesor da de alta alumnos y arma equipos (coordinación, en cualquier grupo)
const $grupo = document.getElementById('grupo');
let alumnos = [];
let equipos = [];

if (rol === 'administrador') document.getElementById('subtitulo').textContent = 'Equipos de trabajo de cualquier grupo. Las cuentas de alumnos se crean en Usuarios y catálogos.';

async function cargarGrupos() {
  let grupos;
  if (rol === 'profesor') {
    const clases = await api('/escolar/clases');
    grupos = [...new Map(clases.map((c) => [c.grupo_id, { id: c.grupo_id, nombre: c.grupo, turno: c.turno }])).values()];
  } else {
    grupos = await api('/escolar/grupos');
  }
  document.getElementById('sin-grupos').hidden = grupos.length > 0;
  document.getElementById('contenido-grupo').hidden = !grupos.length;
  $grupo.innerHTML = grupos.map((g) => `<option value="${g.id}">${esc(g.nombre)} · ${esc(et(g.turno))}</option>`).join('');
  const previo = new URLSearchParams(location.search).get('grupo');
  if (previo && grupos.some((g) => String(g.id) === previo)) $grupo.value = previo;
}

async function cargar() {
  const g = $grupo.value;
  if (!g) return;
  [alumnos, equipos] = await Promise.all([api(`/escolar/grupos/${g}/alumnos`), api(`/escolar/equipos-trabajo?grupo_id=${g}`)]);
  pintar();
}

function pintar() {
  document.getElementById('n-alumnos').textContent = alumnos.length;
  document.getElementById('alumnos').innerHTML = alumnos.length
    ? alumnos.map((a) => `<tr><td><div class="material"><img class="mini-avatar" src="assets/avatares/nivel-${Math.min(a.avatar, nivelPorPuntos(a.puntos_conducta))}.svg" alt=""><strong>${esc(a.nombre)}</strong></div></td>
        <td><code>${esc(a.matricula)}</code></td><td>${a.equipo_trabajo ? esc(a.equipo_trabajo) : '<span class="muted">Sin equipo</span>'}</td>
        <td><span class="badge ${a.puntos_conducta < 0 ? 'orange' : 'mint'}">${a.puntos_conducta} pts</span></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Aún no hay alumnos en este grupo.</td></tr>';
  const sinEquipo = alumnos.filter((a) => !a.equipo_trabajo_id);
  document.getElementById('equipos').innerHTML = equipos.length ? equipos.map((e) => `
    <article class="equipo-card" data-equipo="${e.id}">
      <div class="card-top"><h3>${esc(e.nombre)}</h3><span class="badge violet">${e.miembros.length} integrante(s)</span></div>
      <ul class="miembros">${e.miembros.map((m) => `<li><img class="mini-avatar" src="assets/avatares/nivel-${Math.min(m.avatar, nivelPorPuntos(m.puntos_conducta))}.svg" alt=""><span>${esc(m.nombre)}<small>${esc(m.matricula)}</small></span>
        <button type="button" class="text-link" data-quitar="${e.id}:${m.id}" aria-label="Quitar a ${esc(m.nombre)} del equipo">Quitar</button></li>`).join('') || '<li class="muted">Sin integrantes.</li>'}</ul>
      <div class="equipo-acciones">
        ${sinEquipo.length ? `<label><span class="sr-only">Añadir alumno</span><select data-anadir="${e.id}"><option value="">Añadir alumno…</option>${sinEquipo.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select></label>` : '<span class="nota">Todos los alumnos ya tienen equipo.</span>'}
        <button type="button" class="text-link" data-renombrar="${e.id}">Renombrar</button>
        <button type="button" class="text-link peligro-texto" data-borrar="${e.id}">Borrar</button>
      </div>
    </article>`).join('') : vacio('Aún no hay equipos. Crea el primero arriba.');
  animarHijos(document.getElementById('equipos'));
}

$grupo.addEventListener('change', () => cargar().catch((e) => toast(e.message, 'error')));

// Crear equipo
document.getElementById('form-equipo').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/escolar/equipos-trabajo', { method: 'POST', body: { grupo_id: Number($grupo.value), nombre: e.target.nombre.value } });
    e.target.reset();
    toast('Equipo creado');
    await cargar();
  } catch (er) { toast(er.message, 'error'); }
});

const $equipos = document.getElementById('equipos');
$equipos.addEventListener('change', async (e) => {
  const s = e.target.closest('[data-anadir]');
  if (!s?.value) return;
  try {
    await api(`/escolar/equipos-trabajo/${s.dataset.anadir}/alumnos`, { method: 'POST', body: { alumno_id: Number(s.value) } });
    await cargar();
  } catch (er) { toast(er.message, 'error'); }
});
$equipos.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.quitar) {
      const [eq, al] = b.dataset.quitar.split(':');
      await api(`/escolar/equipos-trabajo/${eq}/alumnos/${al}`, { method: 'DELETE' });
      await cargar();
    } else if (b.dataset.renombrar) {
      const e2 = equipos.find((x) => x.id === Number(b.dataset.renombrar));
      const r = await preguntar({ titulo: 'Renombrar equipo', texto: e2.nombre, boton: 'Guardar', campo: 'Nombre nuevo' });
      if (!r.ok || !r.valor) return;
      await api(`/escolar/equipos-trabajo/${e2.id}`, { method: 'PUT', body: { nombre: r.valor } });
      await cargar();
    } else if (b.dataset.borrar) {
      const e2 = equipos.find((x) => x.id === Number(b.dataset.borrar));
      const r = await preguntar({ titulo: `Borrar ${e2.nombre}`, texto: 'Sus integrantes quedarán sin equipo.', boton: 'Borrar equipo', peligro: true });
      if (!r.ok) return;
      await api(`/escolar/equipos-trabajo/${e2.id}`, { method: 'DELETE' });
      toast('Equipo borrado');
      await cargar();
    }
  } catch (er) { toast(er.message, 'error'); }
});

cargarGrupos().then(cargar).catch((e) => toast(e.message, 'error'));
