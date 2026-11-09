// Mi equipo (alumno): integrantes de su equipo de trabajo
(async () => {
  const $e = document.getElementById('equipo');
  try {
    const [eq, yo] = await Promise.all([api('/escolar/mi-equipo'), api('/auth/yo')]);
    if (!eq) {
      $e.innerHTML = `<div class="notice">${ICONOS.info}<p>Aún no estás en un equipo${yo.grupo ? ` del grupo ${esc(yo.grupo)}` : ''}. Tu profesor te asignará uno.</p></div>`;
      return;
    }
    $e.innerHTML = `<section class="panel padded"><div class="card-top"><p class="eyebrow">${esc(eq.grupo)}</p><span class="badge violet">${eq.miembros.length} integrante(s)</span></div>
      <h2>${esc(eq.nombre)}</h2>
      <ul class="miembros grande">${eq.miembros.map((m) => `<li class="${m.id === yo.id ? 'yo' : ''}"><img class="mini-avatar" src="assets/avatares/nivel-${Math.min(m.avatar, nivelPorPuntos(m.puntos_conducta))}.svg" alt="">
        <span>${esc(m.nombre)}${m.id === yo.id ? ' <small>(tú)</small>' : ''}<small>${esc(m.matricula)} · ${m.puntos_conducta} puntos</small></span></li>`).join('')}</ul>
      <p class="nota">Cuando el equipo devuelve el material sin incidentes, cada integrante gana 1 punto de buena conducta.</p></section>`;
    animarHijos($e.querySelector('.miembros'));
  } catch (e) { $e.innerHTML = vacio(e.message); }
})();
