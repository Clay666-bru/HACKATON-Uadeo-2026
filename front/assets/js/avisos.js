// Avisos personales (la campana de la barra superior)
const ENLACE = {
  PRACTICA: 'practicas.html', VALE: rol === 'alumno' ? 'practicas.html' : 'vales.html', BATA: 'batas.html',
  CONDUCTA: 'avatares.html', SEMESTRE: 'semestre.html', MANTENIMIENTO: 'semestre.html',
};

async function cargar() {
  const $a = document.getElementById('avisos');
  const avisos = await api('/notificaciones');
  $a.innerHTML = avisos.length ? avisos.map((n) => {
    const href = ENLACE[n.tipo];
    const enlace = href && ACCESO[href]?.includes(rol) ? `<a class="text-link" href="${href}">Ir ↗</a>` : '';
    return `<article class="aviso${n.leida ? '' : ' nuevo'}"><span class="timeline-dot ${n.tipo === 'MANTENIMIENTO' ? 'orange' : 'mint'}"></span>
      <div><div class="card-top"><strong>${esc(n.titulo)}</strong><small class="muted">${fechaCorta(n.creada, true)}</small></div>
      <p>${esc(n.mensaje)}</p>${enlace}</div></article>`;
  }).join('') : vacio('No tienes avisos.');
  animarHijos($a);
}

document.getElementById('leer-todas').addEventListener('click', async () => {
  try {
    await api('/notificaciones/leidas', { method: 'POST' });
    document.querySelector('.topbar .notification-dot')?.setAttribute('hidden', '');
    await cargar();
  } catch (e) { toast(e.message, 'error'); }
});

cargar().catch((e) => { document.getElementById('avisos').innerHTML = vacio(e.message); });
