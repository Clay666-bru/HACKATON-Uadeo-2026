// Avatares: contador de buena conducta, niveles desbloqueados y foto de perfil
const CANDADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const $niveles = [...document.querySelectorAll('.niveles .nivel')];
const $aviso = document.querySelector('#contenido .notice p');

// Puntos que pide cada nivel (también para quien no tiene contador)
$niveles.forEach((li, i) => {
  li.dataset.nivel = i + 1;
  li.querySelector('.nivel-num').insertAdjacentHTML('afterend', `<p class="nivel-req">Desde ${PUNTOS_AVATAR[i]} punto${PUNTOS_AVATAR[i] === 1 ? '' : 's'}</p>`);
});

function pintar(c) {
  // Resumen del contador
  let $res = document.getElementById('mi-conducta');
  if (!$res) {
    $res = document.createElement('section');
    $res.id = 'mi-conducta';
    $res.className = 'panel conducta-resumen';
    $res.setAttribute('aria-label', 'Mi buena conducta');
    document.querySelector('#contenido .notice').replaceWith($res);
  }
  const sig = c.siguiente;
  const base = PUNTOS_AVATAR[c.nivel_desbloqueado - 1];
  const avance = sig ? Math.max(0, Math.min(100, ((c.puntos - base) / (sig.puntos - base)) * 100)) : 100;
  const actual = c.avatares[c.avatar - 1];
  $res.innerHTML = `
    <img class="conducta-avatar" src="assets/avatares/nivel-${c.avatar}.svg" alt="Tu avatar: ${esc(actual.nombre)}" width="120" height="128">
    <div class="conducta-datos">
      <p class="eyebrow">MI BUENA CONDUCTA</p>
      <p class="conducta-puntos"><b class="cuenta" data-cuenta="${Math.max(c.puntos, 0)}">${c.puntos}</b> <span>punto${Math.abs(c.puntos) === 1 ? '' : 's'}</span></p>
      <p class="muted">Usas el avatar <strong>${esc(actual.nombre)}</strong> · nivel ${c.avatar}.
        ${sig ? `Te faltan <strong>${sig.faltan}</strong> punto${sig.faltan === 1 ? '' : 's'} para desbloquear <strong>${esc(sig.nombre)}</strong>.` : '¡Desbloqueaste todos los avatares!'}</p>
      <div class="conducta-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(avance)}" aria-label="Avance al siguiente nivel"><i style="--avance:${avance}%"></i></div>
      <p class="nota">Cada práctica sin incidentes suma 1 punto; un incidente resta 1.</p>
    </div>
    <div class="conducta-historial">
      <h3>Últimos movimientos</h3>
      ${c.eventos.length
        ? `<ul>${c.eventos.slice(0, 6).map((e) => `<li><span class="badge ${e.delta > 0 ? 'mint' : 'orange'}">${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)}</span><span>${esc(e.motivo)}<small>${fechaCorta(e.fecha)}</small></span></li>`).join('')}</ul>`
        : '<p class="muted">Aún no tienes puntos registrados. Se suman cuando el laboratorio cierra tus prácticas.</p>'}
    </div>`;
  if (c.puntos > 0) animarConteos($res);

  // Estado de cada nivel
  $niveles.forEach((li) => {
    const n = Number(li.dataset.nivel);
    const a = c.avatares[n - 1];
    li.classList.toggle('bloqueado', !a.desbloqueado);
    li.classList.toggle('en-uso', n === c.avatar);
    li.querySelector('.nivel-accion')?.remove();
    const faltan = a.puntos - c.puntos;
    const accion = n === c.avatar
      ? '<span class="badge mint">En uso</span>'
      : a.desbloqueado
        ? `<button class="button primary" type="button" data-usar="${n}">Usar como foto</button>`
        : `<span class="nivel-candado">${CANDADO} Faltan ${faltan} punto${faltan === 1 ? '' : 's'}</span>`;
    li.insertAdjacentHTML('beforeend', `<div class="nivel-accion">${accion}</div>`);
  });
}

if (TIENE_CONDUCTA.includes(sesion.rol)) {
  api('/conducta').then(pintar).catch((e) => toast('No se pudo cargar tu contador: ' + e.message, 'error'));

  document.querySelector('.niveles').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-usar]');
    if (!btn) return;
    btn.disabled = true;
    try {
      const c = await api('/conducta/avatar', { method: 'PUT', body: { nivel: Number(btn.dataset.usar) } });
      sesion.avatar = c.avatar;
      Sesion.guardar(sesion);
      ponerAvatar(c.avatar);
      pintar(c);
      toast(`Ahora tu foto de perfil es ${c.avatares[c.avatar - 1].nombre}`);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
} else if ($aviso) {
  $aviso.textContent = 'Los profesores y alumnos desbloquean estos avatares con su contador de buena conducta y los usan como foto de perfil.';
}
