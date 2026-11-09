// Vales de material de los equipos de alumnos: entregar, rechazar y recibir la devolución
let vales = [];
const estadoActual = () => document.querySelector('#tabs-vales input:checked').value;

function tarjeta(v) {
  return `<article class="panel practica">
    <div class="card-top"><span class="overline">${esc(v.grupo)} · ${esc(v.equipo_trabajo)}</span>${badgeEstado(v.estado)}</div>
    <h3>${esc(v.practica)}</h3>
    <p class="practica-cuando"><strong>${fechaCorta(v.fecha)}</strong> · ${esc(v.hora_inicio)}–${esc(v.hora_fin)} · ${esc(v.profesor)}</p>
    <p class="muted">Solicitó <strong>${esc(v.alumno)}</strong> el ${fechaCorta(v.solicitado, true)}. Integrantes: ${v.integrantes.map((m) => esc(m.nombre)).join(', ') || '—'}</p>
    <div class="table-scroll"><table class="tabla-compacta"><thead><tr><th>Artículo</th><th>Cantidad</th>${v.estado === 'DEVUELTO' ? '<th>Devuelto</th>' : ''}</tr></thead><tbody>
      ${v.items.map((i) => `<tr><td>${esc(i.nombre)} <code>${esc(i.codigo)}</code></td><td>${numero(i.cantidad)} ${esc(i.unidad)}</td>${v.estado === 'DEVUELTO' ? `<td>${numero(i.cantidad_devuelta ?? 0)} ${esc(i.unidad)}</td>` : ''}</tr>`).join('')}
    </tbody></table></div>
    ${v.atendio ? `<p class="nota">Atendió ${esc(v.atendio)} · ${fechaCorta(v.atendido, true)}${v.comentario ? ` — “${esc(v.comentario)}”` : ''}</p>` : ''}
    ${v.estado === 'DEVUELTO' ? `<p class="nota ${v.hubo_incidente ? 'orange-text' : 'mint-text'}">${v.hubo_incidente ? `Incidente: ${esc(v.descripcion_incidente)} (−1 a cada integrante)` : 'Devuelto sin incidentes (+1 a cada integrante)'} · recibió ${esc(v.recibio)}</p>` : ''}
    <div class="practica-acciones">
      ${v.estado === 'SOLICITADO' ? `<button class="button primary" data-entregar="${v.id}">Entregar material</button><button class="button peligro" data-rechazar="${v.id}">Rechazar</button>` : ''}
      ${v.estado === 'PENDIENTE_DEVOLUCION' ? `<button class="button primary" data-devolver="${v.id}">Recibir devolución</button>` : ''}
    </div>
  </article>`;
}

async function cargar() {
  const estado = estadoActual();
  const [lista, conteo] = await Promise.all([api(`/vales?estado=${estado}`), api('/vales')]);
  vales = lista;
  ['SOLICITADO', 'PENDIENTE_DEVOLUCION'].forEach((e) => { document.getElementById(`n-${e}`).textContent = conteo.filter((v) => v.estado === e).length; });
  const textos = { SOLICITADO: 'No hay vales por entregar.', PENDIENTE_DEVOLUCION: 'No hay material pendiente de devolución.', DEVUELTO: 'Aún no hay devoluciones.', RECHAZADO: 'No hay vales rechazados.' };
  const $l = document.getElementById('lista');
  $l.innerHTML = vales.length ? vales.map(tarjeta).join('') : vacio(textos[estado]);
  animarHijos($l);
}

document.getElementById('tabs-vales').addEventListener('change', () => cargar().catch((e) => toast(e.message, 'error')));

document.getElementById('lista').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.entregar) {
      const v = vales.find((x) => x.id === Number(b.dataset.entregar));
      const r = await preguntar({ titulo: 'Entregar material', texto: `Se registrará la salida del inventario para ${v.equipo_trabajo} (${v.practica}). Quedará pendiente de devolución.`, boton: 'Entregar', campo: 'Comentario (opcional)' });
      if (!r.ok) return;
      await api(`/vales/${v.id}/decision`, { method: 'POST', body: { decision: 'ACEPTAR', comentario: r.valor } });
      toast('Material entregado; pendiente de devolución');
    } else if (b.dataset.rechazar) {
      const r = await preguntar({ titulo: 'Rechazar vale', boton: 'Rechazar', peligro: true, campo: 'Motivo (lo verá el equipo)' });
      if (!r.ok) return;
      await api(`/vales/${b.dataset.rechazar}/decision`, { method: 'POST', body: { decision: 'RECHAZAR', comentario: r.valor } });
      toast('Vale rechazado');
    } else if (b.dataset.devolver) {
      return abrirDevolucion(vales.find((x) => x.id === Number(b.dataset.devolver)));
    }
    await cargar();
  } catch (er) { toast(er.message, 'error'); }
});

function abrirDevolucion(v) {
  const sugerido = (i) => (i.clase === 'equipo' || i.tipo_material === 'CONSUMIBLE' ? i.cantidad : 0);
  const dlg = abrirDialogo(`<form novalidate>
    <p class="eyebrow">DEVOLUCIÓN</p><h2>${esc(v.equipo_trabajo)} · ${esc(v.practica)}</h2>
    <p class="muted">Indica cuánto regresa. Los reactivos se consideran usados.</p>
    <div class="table-scroll"><table class="tabla-compacta"><thead><tr><th>Artículo</th><th>Entregado</th><th>Regresa</th></tr></thead><tbody>
      ${v.items.map((i) => `<tr><td>${esc(i.nombre)}</td><td>${numero(i.cantidad)} ${esc(i.unidad)}</td>
        <td><input type="number" class="cantidad-item" min="0" max="${i.cantidad}" step="${i.clase === 'equipo' || i.unidad === 'pza' ? 1 : 'any'}" value="${sugerido(i)}" data-item="${i.id}" aria-label="Cantidad que regresa de ${esc(i.nombre)}"> ${esc(i.unidad)}</td></tr>`).join('')}
    </tbody></table></div>
    <fieldset class="opciones"><legend>¿Hubo un incidente?</legend>
      <label><input type="radio" name="incidente" value="no" checked> No hubo incidentes <small class="mint-text">+1 punto a cada integrante</small></label>
      <label><input type="radio" name="incidente" value="si"> Sí hubo un incidente <small class="orange-text">−1 punto a cada integrante</small></label></fieldset>
    <div class="form-grid" data-incidente hidden><label class="ancho">Describe el incidente<textarea name="descripcion_incidente" rows="3" maxlength="500"></textarea></label>
      <label>Condición del equipo<select name="condicion"><option value="CON_DETALLES">Con detalles</option><option value="DANADO">Dañado</option><option value="BUENA">Buena</option></select></label></div>
    <p class="form-error" role="alert" hidden></p>
    <div class="modal-acciones"><span class="espacio"></span><button class="button" type="button" data-cerrar>Cancelar</button><button class="button primary" type="submit">Registrar devolución</button></div></form>`);
  const $f = dlg.querySelector('form');
  $f.addEventListener('change', () => { dlg.querySelector('[data-incidente]').hidden = $f.incidente.value !== 'si'; });
  $f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const incidente = $f.incidente.value === 'si';
    try {
      await api(`/vales/${v.id}/devolucion`, { method: 'POST', body: {
        hubo_incidente: incidente, descripcion_incidente: $f.descripcion_incidente.value, condicion: incidente ? $f.condicion.value : 'BUENA',
        devoluciones: [...$f.querySelectorAll('[data-item]')].map((x) => ({ item_id: Number(x.dataset.item), cantidad_devuelta: Number(x.value) })),
      } });
      cerrarDialogo(dlg);
      toast('Devolución registrada');
      await cargar();
    } catch (er) { const $e = $f.querySelector('.form-error'); $e.textContent = er.message; $e.hidden = false; }
  });
}

cargar().catch((e) => { document.getElementById('lista').innerHTML = vacio(e.message); });
