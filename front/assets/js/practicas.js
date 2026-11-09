// Prácticas: cada rol ve y hace solo lo suyo
//  profesor: sus solicitudes e historial (cancelar, subir fotos)
//  coordinación: autoriza (paso 1), bitácora y fotos
//  laboratorio: confirma (paso 2), bitácora y fotos
//  alumno: prácticas de su grupo, vale de material de su equipo y fotos
const ESTADOS = ['PENDIENTE_ADMIN', 'PENDIENTE_LAB', 'APROBADA', 'REALIZADA', 'RECHAZADA_ADMIN', 'RECHAZADA_LAB', 'CANCELADA'];
const TEXTOS = {
  profesor: ['Mis prácticas', 'Tus solicitudes de laboratorio y el historial de tus prácticas.'],
  administrador: ['Solicitudes y prácticas', 'Autoriza las solicitudes de los profesores; después las confirma el laboratorio.'],
  laboratorio: ['Solicitudes y prácticas', 'Confirma las solicitudes autorizadas por coordinación y registra la bitácora de cada práctica.'],
  alumno: ['Prácticas de mi grupo', 'Solicita el material de tu equipo con al menos 3 días de anticipación.'],
};
document.getElementById('titulo').textContent = TEXTOS[rol][0];
document.getElementById('subtitulo').textContent = TEXTOS[rol][1];

const $estado = document.getElementById('f-estado');
if (rol === 'alumno') $estado.closest('label').remove();
else $estado.insertAdjacentHTML('beforeend', ESTADOS.map((e) => `<option value="${e}">${esc(et(e))}</option>`).join(''));

let practicas = [];
let yo = null;

const fechaLarga = (f) => new Date(`${f}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const pasoTexto = (p) => (p === 'PENDIENTE_ADMIN' ? 'Paso 1 de 2 · coordinación' : p === 'PENDIENTE_LAB' ? 'Paso 2 de 2 · laboratorio' : '');

function tablaItems(p) {
  if (!p.items.length) return '<p class="muted">Sin materiales solicitados.</p>';
  return `<div class="table-scroll"><table class="tabla-compacta"><thead><tr><th>Artículo</th><th>Por equipo</th><th>Total (${p.num_equipos} eq.)</th></tr></thead><tbody>
    ${p.items.map((i) => `<tr><td><strong>${esc(i.nombre)}</strong> <code>${esc(i.codigo)}</code></td><td>${numero(i.cantidad_por_equipo)} ${esc(i.unidad)}</td><td>${numero(i.cantidad_total)} ${esc(i.unidad)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function fotos(p) {
  const puedeSubir = ['APROBADA', 'REALIZADA'].includes(p.estado);
  if (!p.fotos.length && !puedeSubir) return '';
  return `<div class="fotos"><h4>Fotos de la práctica</h4>
    <div class="galeria">${p.fotos.map((f) => `<figure><a href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="${esc(f.descripcion || 'Foto de la práctica')}" loading="lazy"></a>
      <figcaption>${esc(f.descripcion || '')}<small>${esc(f.subida_por)} · ${fechaCorta(f.subida)}</small>
      ${f.usuario_id === yo?.id || esLab ? `<button type="button" class="text-link" data-borrar-foto="${p.id}:${f.id}">Quitar</button>` : ''}</figcaption></figure>`).join('')}
    ${puedeSubir ? `<label class="subir-foto"><input type="file" accept="image/jpeg,image/png,image/webp" data-subir="${p.id}" hidden>${ICONOS.mas}<span>Subir foto</span></label>` : ''}</div></div>`;
}

function valeAlumno(p) {
  const v = p.vales[0];
  if (v) {
    return `<div class="vale-estado"><span>Material de tu equipo (<strong>${esc(v.equipo_trabajo)}</strong>):</span> ${badgeEstado(v.estado)}
      ${v.estado === 'RECHAZADO' && p.estado === 'APROBADA' ? `<button class="button" type="button" data-vale="${p.id}">Volver a solicitar</button>` : ''}</div>`;
  }
  if (p.estado !== 'APROBADA') return '';
  if (!yo?.equipo_trabajo_id) return '<p class="nota">Aún no estás en un equipo; tu profesor debe asignarte uno para pedir material.</p>';
  const dias = Math.round((new Date(`${p.fecha}T00:00:00`) - new Date(`${hoyISO()}T00:00:00`)) / 86400000);
  if (!p.items.length) return '<p class="nota">Esta práctica no requiere material.</p>';
  if (dias < 3) return '<p class="nota">El material se solicita con al menos 3 días de anticipación; el plazo ya pasó.</p>';
  return `<button class="button primary" type="button" data-vale="${p.id}">Solicitar material de mi equipo</button>`;
}

function acciones(p) {
  const a = [];
  if (rol === 'administrador' && p.estado === 'PENDIENTE_ADMIN') a.push(`<button class="button primary" data-decidir="admin:ACEPTAR:${p.id}">Autorizar</button><button class="button peligro" data-decidir="admin:RECHAZAR:${p.id}">Rechazar</button>`);
  if (rol === 'laboratorio' && p.estado === 'PENDIENTE_LAB') a.push(`<button class="button primary" data-decidir="laboratorio:ACEPTAR:${p.id}">Aceptar</button><button class="button peligro" data-decidir="laboratorio:RECHAZAR:${p.id}">Rechazar</button>`);
  if (esLab && p.estado === 'APROBADA') {
    a.push(p.fecha <= hoyISO()
      ? `<button class="button primary" data-bitacora="${p.id}">Registrar bitácora</button>`
      : `<span class="nota">La bitácora se registra el día de la práctica.</span>`);
  }
  if (rol === 'profesor' && ['PENDIENTE_ADMIN', 'PENDIENTE_LAB', 'APROBADA'].includes(p.estado)) a.push(`<button class="button peligro" data-cancelar="${p.id}">Cancelar solicitud</button>`);
  if (rol === 'alumno') a.push(valeAlumno(p));
  return a.join('');
}

function tarjeta(p) {
  const b = p.bitacora;
  const decisiones = [
    p.admin ? `Coordinación (${esc(p.admin)}): ${p.estado === 'RECHAZADA_ADMIN' ? 'rechazó' : 'autorizó'}${p.admin_comentario ? ` — “${esc(p.admin_comentario)}”` : ''}` : '',
    p.laboratorista ? `Laboratorio (${esc(p.laboratorista)}): ${p.estado === 'RECHAZADA_LAB' ? 'rechazó' : 'aceptó'}${p.lab_comentario ? ` — “${esc(p.lab_comentario)}”` : ''}` : '',
  ].filter(Boolean);
  const vales = esLab || rol === 'profesor'
    ? (p.vales.length ? `<p class="muted vales-resumen">Vales: ${p.vales.map((v) => `${esc(v.equipo_trabajo)} ${badgeEstado(v.estado)}`).join(' ')}</p>` : '')
    : '';
  return `<article class="panel practica" id="practica-${p.id}">
    <div class="card-top"><span class="overline">${esc(p.grupo)} · ${esc(p.materia)}</span>${badgeEstado(p.estado)}</div>
    <h3>${esc(p.titulo)}</h3>
    <p class="practica-cuando"><strong>${esc(fechaLarga(p.fecha))}</strong> · ${esc(p.hora_inicio)}–${esc(p.hora_fin)} · ${p.num_equipos} equipo(s)${rol !== 'profesor' ? ` · ${esc(p.profesor)}` : ''}</p>
    ${pasoTexto(p.estado) ? `<p class="paso-chip">${pasoTexto(p.estado)}</p>` : ''}
    <details><summary>Descripción y materiales</summary><div class="details-body"><p class="descripcion">${esc(p.descripcion)}</p>${tablaItems(p)}</div></details>
    ${decisiones.length ? `<ul class="decisiones">${decisiones.map((d) => `<li>${d}</li>`).join('')}</ul>` : ''}
    ${vales}
    ${b ? `<div class="bitacora ${b.hubo_incidente ? 'con-incidente' : ''}"><h4>Bitácora · ${b.hubo_incidente ? 'con incidente' : 'sin incidentes'}</h4>
      ${b.anotaciones ? `<p>${esc(b.anotaciones)}</p>` : ''}${b.hubo_incidente ? `<p class="orange-text">${esc(b.descripcion_incidente)}</p>` : ''}
      <small class="muted">${esc(b.registrado_por)} · ${fechaCorta(b.registrado, true)}</small></div>` : ''}
    ${fotos(p)}
    <div class="practica-acciones">${acciones(p)}</div>
  </article>`;
}

function pintar() {
  const filtro = $estado?.value;
  const pendiente = rol === 'administrador' ? 'PENDIENTE_ADMIN' : rol === 'laboratorio' ? 'PENDIENTE_LAB' : null;
  const $bloque = document.getElementById('por-atender');
  if (pendiente) {
    const lista = practicas.filter((p) => p.estado === pendiente);
    $bloque.hidden = false;
    document.getElementById('por-atender-titulo').textContent = rol === 'administrador' ? 'Por autorizar' : 'Por confirmar';
    document.getElementById('por-atender-n').textContent = lista.length;
    document.getElementById('por-atender-lista').innerHTML = lista.length ? lista.map(tarjeta).join('') : vacio('No hay solicitudes esperando tu decisión.');
    animarHijos(document.getElementById('por-atender-lista'));
  }
  const resto = practicas.filter((p) => p.estado !== pendiente && (!filtro || p.estado === filtro));
  document.getElementById('lista-titulo').textContent = rol === 'alumno' ? 'Prácticas' : 'Historial';
  const sinNada = { profesor: 'Aún no tienes solicitudes. Usa «Solicitar laboratorio».', alumno: 'Tu grupo todavía no tiene prácticas aprobadas.' }[rol] || 'Sin prácticas registradas.';
  document.getElementById('lista').innerHTML = resto.length ? resto.map(tarjeta).join('') : vacio(sinNada);
  animarHijos(document.getElementById('lista'));
}

async function cargar() {
  practicas = await api('/practicas');
  pintar();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: 'center' });
}

(async () => {
  try {
    yo = await api('/auth/yo'); // id para "quitar mis fotos" y equipo del alumno
    await cargar();
  } catch (e) {
    document.getElementById('lista').innerHTML = vacio('No se pudieron cargar las prácticas: ' + e.message);
  }
})();
$estado?.addEventListener('change', pintar);

// ---------- Acciones ----------
document.getElementById('contenido').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    if (t.dataset.decidir) {
      const [paso, decision, id] = t.dataset.decidir.split(':');
      const p = practicas.find((x) => x.id === Number(id));
      const r = await preguntar({
        titulo: decision === 'ACEPTAR' ? (paso === 'admin' ? 'Autorizar solicitud' : 'Aceptar práctica') : 'Rechazar solicitud',
        texto: `${p.titulo} · ${fechaLarga(p.fecha)} ${p.hora_inicio}–${p.hora_fin}`,
        boton: decision === 'ACEPTAR' ? (paso === 'admin' ? 'Autorizar' : 'Aceptar') : 'Rechazar',
        peligro: decision === 'RECHAZAR', campo: decision === 'RECHAZAR' ? 'Motivo (lo verá el profesor)' : 'Comentario (opcional)',
      });
      if (!r.ok) return;
      await api(`/practicas/${id}/${paso}`, { method: 'POST', body: { decision, comentario: r.valor } });
      toast(decision === 'ACEPTAR' ? (paso === 'admin' ? 'Solicitud autorizada; ahora la confirma el laboratorio' : 'Práctica aprobada') : 'Solicitud rechazada');
      await cargar();
    } else if (t.dataset.cancelar) {
      const r = await preguntar({ titulo: 'Cancelar solicitud', texto: 'El horario quedará libre para otros profesores.', boton: 'Cancelar solicitud', peligro: true });
      if (!r.ok) return;
      await api(`/practicas/${t.dataset.cancelar}/cancelar`, { method: 'POST' });
      toast('Solicitud cancelada');
      await cargar();
    } else if (t.dataset.bitacora) {
      abrirBitacora(practicas.find((x) => x.id === Number(t.dataset.bitacora)));
    } else if (t.dataset.vale) {
      abrirVale(practicas.find((x) => x.id === Number(t.dataset.vale)));
    } else if (t.dataset.borrarFoto) {
      const [pid, fid] = t.dataset.borrarFoto.split(':');
      const r = await preguntar({ titulo: 'Quitar foto', boton: 'Quitar', peligro: true });
      if (!r.ok) return;
      await api(`/practicas/${pid}/fotos/${fid}`, { method: 'DELETE' });
      await cargar();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});

// Subir foto
document.getElementById('contenido').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-subir]');
  if (!input?.files[0]) return;
  const fd = new FormData();
  fd.append('foto', input.files[0]);
  const desc = await preguntar({ titulo: 'Subir foto', texto: input.files[0].name, boton: 'Subir', campo: 'Descripción (opcional)' });
  if (!desc.ok) { input.value = ''; return; }
  if (desc.valor) fd.append('descripcion', desc.valor);
  try {
    await apiArchivo(`/practicas/${input.dataset.subir}/fotos`, fd);
    toast('Foto subida');
    await cargar();
  } catch (err) { toast(err.message, 'error'); }
});

function abrirBitacora(p) {
  const dlg = abrirDialogo(`<form novalidate>
    <p class="eyebrow">BITÁCORA DE PRÁCTICA</p><h2>${esc(p.titulo)}</h2>
    <p class="muted">${esc(p.profesor)} · ${esc(p.grupo)} · ${esc(fechaLarga(p.fecha))}</p>
    <div class="form-grid">
      <label class="ancho">Anotaciones<textarea name="anotaciones" rows="4" maxlength="5000" placeholder="Cómo se desarrolló la práctica, estado del área, observaciones"></textarea></label>
      <fieldset class="ancho opciones"><legend>¿Hubo un incidente?</legend>
        <label><input type="radio" name="incidente" value="no" checked> No hubo incidentes <small class="mint-text">+1 punto al profesor</small></label>
        <label><input type="radio" name="incidente" value="si"> Sí hubo un incidente <small class="orange-text">−1 punto al profesor</small></label></fieldset>
      <label class="ancho" data-incidente hidden>Describe el incidente<textarea name="descripcion_incidente" rows="3" maxlength="500"></textarea></label>
    </div>
    <p class="nota">Después de registrar la bitácora puedes subir fotos desde la tarjeta de la práctica.</p>
    <p class="form-error" role="alert" hidden></p>
    <div class="modal-acciones"><span class="espacio"></span><button class="button" type="button" data-cerrar>Cancelar</button><button class="button primary" type="submit">Registrar</button></div></form>`);
  const $f = dlg.querySelector('form');
  $f.addEventListener('change', () => { dlg.querySelector('[data-incidente]').hidden = $f.incidente.value !== 'si'; });
  $f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const $err = $f.querySelector('.form-error');
    try {
      await api(`/practicas/${p.id}/bitacora`, { method: 'POST', body: {
        anotaciones: $f.anotaciones.value, hubo_incidente: $f.incidente.value === 'si', descripcion_incidente: $f.descripcion_incidente.value,
      } });
      cerrarDialogo(dlg);
      toast('Bitácora registrada');
      await cargar();
    } catch (err) { $err.textContent = err.message; $err.hidden = false; }
  });
}

// El alumno acepta el formato con los materiales que pidió el profesor
function abrirVale(p) {
  const dlg = abrirDialogo(`<form novalidate>
    <p class="eyebrow">VALE DE MATERIAL</p><h2>${esc(p.titulo)}</h2>
    <p class="muted">${esc(fechaLarga(p.fecha))} · ${esc(p.hora_inicio)}–${esc(p.hora_fin)} · equipo <strong>${esc(yo.equipo_trabajo || '')}</strong></p>
    <div class="table-scroll"><table class="tabla-compacta"><thead><tr><th>Material para tu equipo</th><th>Cantidad</th></tr></thead><tbody>
      ${p.items.map((i) => `<tr><td>${esc(i.nombre)} <code>${esc(i.codigo)}</code></td><td>${numero(i.cantidad_por_equipo)} ${esc(i.unidad)}</td></tr>`).join('')}</tbody></table></div>
    <label class="check"><input type="checkbox" name="acepto"> Acepto el formato: mi equipo se hace responsable del material y lo devolverá limpio y en buen estado.</label>
    <p class="form-error" role="alert" hidden></p>
    <div class="modal-acciones"><span class="espacio"></span><button class="button" type="button" data-cerrar>Cancelar</button><button class="button primary" type="submit" disabled>Solicitar material</button></div></form>`);
  const $f = dlg.querySelector('form');
  const $btn = $f.querySelector('[type=submit]');
  $f.acepto.addEventListener('change', () => { $btn.disabled = !$f.acepto.checked; });
  $f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/vales', { method: 'POST', body: { solicitud_id: p.id } });
      cerrarDialogo(dlg);
      toast('Material solicitado; el laboratorio lo revisará');
      await cargar();
    } catch (err) { const $err = $f.querySelector('.form-error'); $err.textContent = err.message; $err.hidden = false; }
  });
}
