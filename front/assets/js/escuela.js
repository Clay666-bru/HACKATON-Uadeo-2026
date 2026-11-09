// Usuarios y catálogos (solo coordinación): cuentas de alumnos y personal, carga desde Excel,
// alumnos por grupo, clases, grupos y materias
const $fUsuario = document.getElementById('form-usuario');
const $grupoAlumnos = document.getElementById('grupo-alumnos');

// El formulario de cuenta cambia según el rol: alumno (matrícula y grupo) o personal (usuario)
function camposCuenta() {
  const alumno = $fUsuario.rol.value === 'ALUMNO';
  $fUsuario.querySelectorAll('[data-cuenta]').forEach((el) => { el.hidden = (el.dataset.cuenta === 'alumno') !== alumno; });
  $fUsuario.password.placeholder = alumno ? 'Opcional · mínimo 8 caracteres' : 'Mínimo 8 caracteres';
}
$fUsuario.rol.addEventListener('change', camposCuenta);
camposCuenta();

function mostrarCredenciales(titulo, filas, nota) {
  abrirDialogo(`<p class="eyebrow">CUENTA CREADA</p><h2>${esc(titulo)}</h2>
    <dl class="credenciales">${filas.map(([t, v]) => `<div><dt>${esc(t)}</dt><dd><code>${esc(v)}</code></dd></div>`).join('')}</dl>
    <p class="muted">${esc(nota)}</p>
    <div class="modal-acciones"><span class="espacio"></span><button class="button primary" type="button" data-cerrar>Listo</button></div>`, 'modal-chico');
}

async function cargarAlumnos() {
  const g = $grupoAlumnos.value;
  const $t = document.getElementById('alumnos');
  if (!g) { $t.innerHTML = '<tr><td colspan="4" class="muted">Primero agrega un grupo.</td></tr>'; return; }
  const lista = await api(`/escolar/grupos/${g}/alumnos`);
  $t.innerHTML = lista.length
    ? lista.map((a) => `<tr><td><div class="material"><img class="mini-avatar" src="assets/avatares/nivel-${Math.min(a.avatar, nivelPorPuntos(a.puntos_conducta))}.svg" alt=""><strong>${esc(a.nombre)}</strong></div></td>
        <td><code>${esc(a.matricula)}</code></td><td>${a.equipo_trabajo ? esc(a.equipo_trabajo) : '<span class="muted">Sin equipo</span>'}</td>
        <td><span class="badge ${a.puntos_conducta < 0 ? 'orange' : 'mint'}">${a.puntos_conducta} pts</span></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Este grupo aún no tiene alumnos.</td></tr>';
}

async function cargar() {
  const [usuarios, gs, ms, clases] = await Promise.all([api('/escolar/usuarios'), api('/escolar/grupos'), api('/escolar/materias'), api('/escolar/clases')]);
  const personal = usuarios.filter((u) => u.rol !== 'alumno');
  document.getElementById('usuarios').innerHTML = personal.map((u) => `<tr>
    <td><strong>${esc(u.nombre)}</strong></td><td><code>${esc(u.usuario)}</code></td><td>${esc(et(u.rol))}</td>
    <td>${u.ultimo_acceso ? fechaCorta(u.ultimo_acceso, true) : '<span class="muted">Nunca</span>'}</td>
    <td>${u.usuario === sesion.usuario ? '<span class="badge mint">Tú</span>'
      : `<button class="text-link" data-activo="${u.id}:${u.activo ? 0 : 1}">${u.activo ? 'Desactivar' : 'Activar'}</button> ${u.activo ? '' : '<span class="badge orange">Inactivo</span>'}`}</td></tr>`).join('');
  document.querySelector('[name=profesor_id]').innerHTML = personal.filter((u) => u.rol === 'profesor' && u.activo)
    .map((u) => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('') || '<option value="">Primero crea un profesor</option>';
  document.querySelectorAll('.sel-grupo').forEach((s) => {
    const previo = s.value;
    s.innerHTML = gs.map((g) => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('');
    if (previo && gs.some((g) => String(g.id) === previo)) s.value = previo;
  });
  document.querySelectorAll('.sel-materia').forEach((s) => { s.innerHTML = ms.map((m) => `<option value="${m.id}">${esc(m.nombre)}</option>`).join(''); });
  document.getElementById('clases').innerHTML = clases.length
    ? clases.map((c) => `<tr><td>${esc(c.profesor)}</td><td>${esc(c.grupo)}</td><td>${esc(c.materia)}</td><td><button class="text-link" data-quitar-clase="${c.id}">Quitar</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Aún no hay clases asignadas.</td></tr>';
  document.getElementById('grupos').innerHTML = gs.map((g) => `<li><strong>${esc(g.nombre)}</strong><span class="muted">${esc(et(g.turno))}</span></li>`).join('');
  document.getElementById('materias').innerHTML = ms.map((m) => `<li>${esc(m.nombre)}</li>`).join('');
  await cargarAlumnos();
}

// Nueva cuenta: alumno (matrícula + grupo) o personal (usuario + rol)
$fUsuario.addEventListener('submit', async (e) => {
  e.preventDefault();
  const $err = $fUsuario.querySelector('.form-error');
  $err.hidden = true;
  const f = $fUsuario;
  try {
    if (f.rol.value === 'ALUMNO') {
      const r = await api('/escolar/alumnos', { method: 'POST', body: { matricula: f.matricula.value, nombre: f.nombre.value, grupo_id: Number(f.grupo_id.value), password: f.password.value || undefined } });
      $grupoAlumnos.value = String(r.grupo_id);
      mostrarCredenciales(r.nombre, [['Usuario', r.usuario], ...(r.password_temporal ? [['Contraseña temporal', r.password_temporal]] : [])],
        r.password_temporal ? 'Compártela con el alumno: solo se muestra esta vez.' : 'Entra con la contraseña que escribiste.');
    } else {
      const r = await api('/escolar/usuarios', { method: 'POST', body: { usuario: f.usuario.value, nombre: f.nombre.value, rol: f.rol.value, password: f.password.value } });
      toast(`Cuenta de ${et(r.rol).toLowerCase()} creada: ${r.usuario}`);
    }
    const rolElegido = f.rol.value;
    f.reset();
    f.rol.value = rolElegido;
    camposCuenta();
    await cargar();
  } catch (er) { $err.textContent = er.message; $err.hidden = false; }
});

// ---------- Excel de alumnos ----------
document.getElementById('btn-plantilla').addEventListener('click', async () => {
  try {
    const resp = await fetch('/api/escolar/alumnos/plantilla', { headers: { Authorization: `Bearer ${sesion.token}` } });
    if (!resp.ok) throw new Error((await resp.json()).error || 'No se pudo descargar');
    const url = URL.createObjectURL(await resp.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'plantilla-alumnos.xlsx' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (er) { toast(er.message, 'error'); }
});

const $fExcel = document.getElementById('form-excel');
$fExcel.archivo.addEventListener('change', () => {
  const a = $fExcel.archivo.files[0];
  document.getElementById('nombre-archivo').textContent = a ? `${a.name} · ${(a.size / 1024).toFixed(0)} KB` : 'Columnas: Matrícula, Nombre completo, Grupo, Equipo (opcional) y Contraseña (opcional)';
  $fExcel.classList.toggle('con-archivo', !!a);
});

let ultimosCreados = [];
$fExcel.addEventListener('submit', async (e) => {
  e.preventDefault();
  const $err = $fExcel.parentElement.querySelector('.form-error');
  $err.hidden = true;
  const archivo = $fExcel.archivo.files[0];
  if (!archivo) { $err.textContent = 'Elige primero el archivo de Excel.'; $err.hidden = false; return; }
  const btn = $fExcel.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Creando cuentas…';
  try {
    const fd = new FormData();
    fd.append('archivo', archivo);
    const r = await apiArchivo('/escolar/alumnos/importar', fd);
    ultimosCreados = r.creados;
    const temporales = r.creados.filter((c) => c.password_temporal);
    const $res = document.getElementById('resultado-excel');
    $res.hidden = false;
    $res.innerHTML = `<div class="resultado-carga">
      <ul class="chips-resumen"><li>Filas leídas<b>${r.total}</b></li><li>Cuentas creadas<b class="mint-text">${r.creados.length}</b></li><li>Con error<b class="${r.errores.length ? 'orange-text' : ''}">${r.errores.length}</b></li></ul>
      ${temporales.length ? `<p class="nota">${temporales.length} cuenta(s) recibieron contraseña temporal. <strong>Descárgalas ahora:</strong> no se vuelven a mostrar.</p>
        <button class="button primary" type="button" id="descargar-credenciales">${NAV_ICONOS.vale} Descargar usuarios y contraseñas (CSV)</button>` : ''}
      ${r.errores.length ? `<h4>Filas que no se crearon</h4><div class="table-scroll"><table class="tabla-compacta"><thead><tr><th>Fila</th><th>Matrícula</th><th>Nombre</th><th>Motivo</th></tr></thead><tbody>
        ${r.errores.map((x) => `<tr><td>${x.fila}</td><td><code>${esc(x.matricula || '—')}</code></td><td>${esc(x.nombre || '—')}</td><td class="orange-text">${esc(x.error)}</td></tr>`).join('')}</tbody></table></div>
        <p class="nota">Corrige esas filas en el Excel y vuelve a subirlo: las cuentas que ya existen se reportan como repetidas y no se duplican.</p>` : ''}
    </div>`;
    toast(r.creados.length ? `${r.creados.length} cuenta(s) de alumno creadas` : 'No se creó ninguna cuenta', r.creados.length ? 'ok' : 'error');
    $fExcel.reset();
    $fExcel.archivo.dispatchEvent(new Event('change'));
    if (r.creados[0]) {
      const g = [...$grupoAlumnos.options].find((o) => o.textContent === r.creados[0].grupo);
      if (g) $grupoAlumnos.value = g.value;
    }
    await cargarAlumnos();
  } catch (er) {
    $err.textContent = er.message; $err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Subir y crear cuentas';
  }
});

// CSV con las cuentas creadas (se abre en Excel); se genera aquí, no se guarda en el servidor
document.getElementById('resultado-excel').addEventListener('click', (e) => {
  if (!e.target.closest('#descargar-credenciales')) return;
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [['Matrícula (usuario)', 'Nombre', 'Grupo', 'Equipo', 'Contraseña temporal'],
    ...ultimosCreados.map((c) => [c.matricula, c.nombre, c.grupo, c.equipo || '', c.password_temporal || '(la del Excel)'])];
  const csv = '﻿' + filas.map((f) => f.map(celda).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: `cuentas-alumnos-${hoyISO()}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

$grupoAlumnos.addEventListener('change', () => cargarAlumnos().catch((e) => toast(e.message, 'error')));

// ---------- Clases, grupos y materias ----------
function enviar(id, ruta, cuerpo, mensaje) {
  document.getElementById(id).addEventListener('submit', async (e) => {
    e.preventDefault();
    const $f = e.target;
    try {
      await api(ruta, { method: 'POST', body: cuerpo($f) });
      $f.reset();
      toast(mensaje);
      await cargar();
    } catch (er) { toast(er.message, 'error'); }
  });
}
enviar('form-clase', '/escolar/clases', (f) => ({ profesor_id: Number(f.profesor_id.value), grupo_id: Number(f.grupo_id.value), materia_id: Number(f.materia_id.value) }), 'Clase asignada');
enviar('form-grupo', '/escolar/grupos', (f) => ({ nombre: f.nombre.value, turno: f.turno.value }), 'Grupo agregado');
enviar('form-materia', '/escolar/materias', (f) => ({ nombre: f.nombre.value }), 'Materia agregada');

document.getElementById('contenido').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.activo) {
      const [id, activo] = b.dataset.activo.split(':').map(Number);
      await api(`/escolar/usuarios/${id}`, { method: 'PATCH', body: { activo: !!activo } });
      toast(activo ? 'Cuenta activada' : 'Cuenta desactivada');
    } else if (b.dataset.quitarClase) {
      await api(`/escolar/clases/${b.dataset.quitarClase}`, { method: 'DELETE' });
      toast('Clase quitada');
    } else return;
    await cargar();
  } catch (er) { toast(er.message, 'error'); }
});

cargar().catch((e) => toast(e.message, 'error'));
