// Renta de batas: el alumno la solicita; laboratorio o coordinación la aceptan, rechazan y concluyen
const esAlumno = rol === 'alumno';
let rentas = [];

if (esAlumno) {
  document.getElementById('titulo').textContent = 'Renta de bata';
  document.getElementById('lista-titulo').textContent = 'Mis rentas';
} else {
  document.getElementById('subtitulo').textContent = 'Acepta o rechaza las solicitudes de los alumnos y concluye la renta al recibir la bata.';
}
document.getElementById('cabecera').innerHTML = esAlumno
  ? '<th>Solicitada</th><th>Batas</th><th>Talla</th><th>Estado</th><th>Atendió</th><th>Devuelta</th><th></th>'
  : '<th>Alumno</th><th>Grupo</th><th>Batas</th><th>Talla</th><th>Solicitada</th><th>Estado</th><th>Acción</th>';

function fila(r) {
  if (esAlumno) {
    return `<tr><td>${fechaCorta(r.solicitada, true)}</td><td>${r.cantidad}</td><td>${esc(r.talla || '—')}</td><td>${badgeEstado(r.estado)}${r.comentario ? `<br><small class="muted">${esc(r.comentario)}</small>` : ''}</td>
      <td>${esc(r.respondio || '—')}</td><td>${r.devuelta ? fechaCorta(r.devuelta, true) : '—'}</td>
      <td>${r.estado === 'SOLICITADA' ? `<button class="text-link" data-cancelar="${r.id}">Cancelar</button>` : ''}</td></tr>`;
  }
  const acciones = r.estado === 'SOLICITADA'
    ? `<button class="button primary" data-decidir="ACEPTAR:${r.id}">Aceptar</button> <button class="button peligro" data-decidir="RECHAZAR:${r.id}">Rechazar</button>`
    : r.estado === 'EN_RENTA' ? `<button class="button primary" data-concluir="${r.id}">Recibir bata</button><br><small class="muted">Desde ${fechaCorta(r.respondida, true)} · ${esc(r.respondio)}</small>`
    : r.estado === 'CONCLUIDA' ? `<small class="muted">Recibió ${esc(r.recibio)} · ${fechaCorta(r.devuelta, true)}</small>`
    : `<small class="muted">${esc(r.respondio || '')}${r.comentario ? ` — ${esc(r.comentario)}` : ''}</small>`;
  return `<tr><td><strong>${esc(r.alumno)}</strong><br><code>${esc(r.matricula || '')}</code></td><td>${esc(r.grupo || '—')}</td><td>${r.cantidad}</td><td>${esc(r.talla || '—')}</td>
    <td>${fechaCorta(r.solicitada, true)}</td><td>${badgeEstado(r.estado)}</td><td class="acciones-celda">${acciones}</td></tr>`;
}

async function cargar() {
  if (esAlumno) {
    rentas = await api('/batas');
    const activa = rentas.some((r) => ['SOLICITADA', 'EN_RENTA'].includes(r.estado));
    const $s = document.getElementById('solicitar');
    $s.querySelector('[type=submit]').disabled = activa;
    $s.querySelector('.form-error').hidden = !activa;
    $s.querySelector('.form-error').textContent = activa ? 'Ya tienes una renta pendiente o activa. Podrás pedir otra cuando la concluyas.' : '';
  } else {
    const estado = document.querySelector('#tabs-batas input:checked').value;
    const [lista, todas] = await Promise.all([api(`/batas${estado ? `?estado=${estado}` : ''}`), api('/batas')]);
    rentas = lista;
    ['SOLICITADA', 'EN_RENTA'].forEach((e) => { document.getElementById(`n-${e}`).textContent = todas.filter((r) => r.estado === e).length; });
  }
  const $l = document.getElementById('lista');
  $l.innerHTML = rentas.length ? rentas.map(fila).join('') : `<tr><td colspan="7" class="muted">${esAlumno ? 'Aún no has rentado batas.' : 'No hay rentas en esta sección.'}</td></tr>`;
  animarHijos($l);
}

document.getElementById('tabs-batas')?.addEventListener('change', () => cargar().catch((e) => toast(e.message, 'error')));

document.getElementById('form-bata')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const $f = e.target;
  try {
    await api('/batas', { method: 'POST', body: { cantidad: Number($f.cantidad.value), talla: $f.talla.value } });
    toast('Solicitud enviada al laboratorio');
    await cargar();
  } catch (er) { const $e = $f.querySelector('.form-error'); $e.textContent = er.message; $e.hidden = false; }
});

document.getElementById('lista').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.decidir) {
      const [decision, id] = b.dataset.decidir.split(':');
      if (decision === 'RECHAZAR') {
        const r = await preguntar({ titulo: 'Rechazar renta', boton: 'Rechazar', peligro: true, campo: 'Motivo (lo verá el alumno)' });
        if (!r.ok) return;
        await api(`/batas/${id}/decision`, { method: 'POST', body: { decision, comentario: r.valor } });
      } else {
        await api(`/batas/${id}/decision`, { method: 'POST', body: { decision } });
      }
      toast(decision === 'ACEPTAR' ? 'Bata en renta' : 'Renta rechazada');
    } else if (b.dataset.concluir) {
      await api(`/batas/${b.dataset.concluir}/concluir`, { method: 'POST' });
      toast('Bata recibida; renta concluida');
    } else if (b.dataset.cancelar) {
      await api(`/batas/${b.dataset.cancelar}/cancelar`, { method: 'POST' });
      toast('Solicitud cancelada');
    }
    await cargar();
  } catch (er) {
    toast(er.message, 'error');
    await cargar().catch(() => {});
  }
});

cargar().catch((e) => { document.getElementById('lista').innerHTML = `<tr><td class="muted">${esc(e.message)}</td></tr>`; });
