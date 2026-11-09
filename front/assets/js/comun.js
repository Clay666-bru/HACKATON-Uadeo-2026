// Común a todas las pantallas: sesión, menú por rol, perfil, avatar y avisos
const sesion = Sesion.obtener();
// Todas las sesiones llevan token (usuario y contraseña); las viejas de "solo nombre" vuelven al login
if (!sesion || !sesion.rol || !sesion.nombre || !sesion.token) {
  Sesion.cerrar();
  throw new Error('Sin sesión');
}
const rol = sesion.rol;
// Laboratorio y coordinación administran el inventario (coordinación puede todo lo del laboratorio)
const esLab = ['laboratorio', 'administrador'].includes(rol);

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const NAV_ICONOS = {
  inicio: P('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  caja: P('<path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7 5l9 5"/>'),
  flechas: P('<path d="M4 7h16m-4-4 4 4-4 4 M20 17H4m4-4-4 4 4 4"/>'),
  qr: P('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z M20 14v.01 M14 20h.01 M17 20h4v-3"/>'),
  alerta: P('<path d="M12 3 2 20h20L12 3Z M12 10v4 M12 17v.01"/>'),
  matraz: P('<path d="M9 3h6 M10 3v7L4 20q0 1 2 1h12q2 0 2-1l-6-10V3 M7 15h10"/>'),
  mas: P('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18 M12 14v4m-2-2h4"/>'),
  calendario: P('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>'),
  vale: P('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1 M9 10h6 M9 14h6 M9 18h3"/>'),
  bata: P('<path d="M9 3 4 6v15h5 M15 3l5 3v15h-5 M9 3l3 4 3-4 M9 3v18h6V3 M12 7v14"/>'),
  grupos: P('<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 4a6 6 0 0 1 3 5"/>'),
  equipo: P('<circle cx="12" cy="8" r="3"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M7 20v-2a5 5 0 0 1 10 0v2 M2 19v-1a3 3 0 0 1 4-3 M22 19v-1a3 3 0 0 0-4-3"/>'),
  medalla: P('<circle cx="12" cy="9" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1 M12 6.5l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>'),
  reloj: P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2 M9 2h6"/>'),
  escuela: P('<path d="M3 10 12 4l9 6 M5 10v9h14v-9 M9 19v-5h6v5 M3 19h18"/>'),
  libro: P('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z M4 19a2 2 0 0 1 2-2h13 M8 7h7"/>'),
  campana: P('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4"/>'),
  info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'),
};

// Menú por rol: cada quien solo ve (y solo puede abrir) sus módulos
const TODOS = ['profesor', 'administrador', 'laboratorio', 'alumno'];
const LAB = ['laboratorio', 'administrador'];
// Categorías del menú (desplegables). Si a un rol solo le toca una opción de la categoría, se muestra suelta.
const GRUPOS = {
  inventario: { texto: 'Inventario y almacén', icono: 'caja' },
  practicas: { texto: 'Prácticas', icono: 'matraz' },
  alumnos: { texto: (r) => (r === 'alumno' ? 'Mi grupo' : 'Alumnos'), icono: 'grupos' },
  admin: { texto: 'Administración', icono: 'escuela' },
};
const MENU = [
  { href: 'index.html', texto: 'Inicio', icono: 'inicio', roles: ['profesor', 'administrador', 'laboratorio'] },
  { href: 'inventario.html', grupo: 'inventario', texto: 'Inventario', icono: 'caja', roles: ['profesor', 'administrador', 'laboratorio'] },
  { href: 'movimientos.html', grupo: 'inventario', texto: 'Entradas y salidas', icono: 'flechas', roles: LAB },
  { href: 'etiquetas.html', grupo: 'inventario', texto: 'Etiquetas QR', icono: 'qr', roles: LAB },
  { href: 'alertas.html', grupo: 'inventario', texto: 'Alertas', icono: 'alerta', roles: LAB, contador: true },
  { href: 'practicas.html', grupo: 'practicas', texto: (r) => ({ profesor: 'Mis prácticas', alumno: 'Prácticas de mi grupo' }[r] || 'Solicitudes y prácticas'), icono: 'matraz', roles: TODOS },
  { href: 'nueva-practica.html', grupo: 'practicas', texto: 'Solicitar laboratorio', icono: 'mas', roles: ['profesor'] },
  { href: 'calendario.html', grupo: 'practicas', texto: 'Calendario', icono: 'calendario', roles: ['profesor', 'administrador', 'laboratorio'] },
  { href: 'vales.html', grupo: 'practicas', texto: 'Vales de material', icono: 'vale', roles: LAB },
  { href: 'grupos.html', grupo: 'alumnos', texto: (r) => (r === 'profesor' ? 'Mis grupos y equipos' : 'Grupos y equipos'), icono: 'grupos', roles: ['profesor', 'administrador'] },
  { href: 'mi-equipo.html', grupo: 'alumnos', texto: 'Mi equipo', icono: 'equipo', roles: ['alumno'] },
  { href: 'batas.html', grupo: 'alumnos', texto: (r) => (r === 'alumno' ? 'Renta de bata' : 'Renta de batas'), icono: 'bata', roles: ['alumno', ...LAB] },
  { href: 'avatares.html', grupo: 'alumnos', texto: 'Buena conducta', icono: 'medalla', roles: ['profesor', 'alumno'] },
  { href: 'laboratoristas.html', grupo: 'admin', texto: 'Laboratoristas', icono: 'bata', roles: ['administrador'] },
  { href: 'escuela.html', grupo: 'admin', texto: 'Usuarios y catálogos', icono: 'escuela', roles: ['administrador'] },
  { href: 'semestre.html', grupo: 'admin', texto: 'Resúmenes y mantenimiento', icono: 'reloj', roles: LAB },
  { href: 'manuales.html', texto: 'Manuales', icono: 'libro', roles: TODOS },
];
const textoDe = (x) => (typeof x.texto === 'function' ? x.texto(rol) : x.texto);
const ACCESO = Object.fromEntries(MENU.map((m) => [m.href, m.roles]));
ACCESO['avisos.html'] = TODOS;
ACCESO['roles.html'] = TODOS;
const INICIO = { alumno: 'practicas.html' };
const inicio = INICIO[rol] || 'index.html';

const pagina = location.pathname.split('/').pop() || 'index.html';
// Módulo que no le toca a este rol: no se muestra nada y vuelve a su inicio
const sinAcceso = !ACCESO[pagina] || !ACCESO[pagina].includes(rol);
if (sinAcceso) {
  document.documentElement.style.visibility = 'hidden';
  location.replace(inicio);
}
// Las páginas no piden datos si se van a redirigir
const _api = api;
api = (...args) => (sinAcceso ? new Promise(() => {}) : _api(...args));

// Avatares (mismos niveles y puntos que el servidor)
const TIENE_CONDUCTA = ['profesor', 'alumno'];
const PUNTOS_AVATAR = [0, 5, 10, 20, 35];
const nivelPorPuntos = (p) => PUNTOS_AVATAR.filter((min) => p >= min).length || 1;

// Coordinación tiene un avatar exclusivo y fijo (matraz con corona y fondo de carnaval); no se cambia
const AVATAR_COORDINACION = 'assets/avatares/coordinacion.svg';
const srcAvatar = (nivel) => (rol === 'administrador' ? AVATAR_COORDINACION : `assets/avatares/nivel-${Number(nivel) || 1}.svg`);

// Cambia las iniciales del perfil (barra lateral y superior) por la imagen del avatar
function ponerAvatar(nivel) {
  document.querySelectorAll('.sidebar .profile .avatar, .topbar .avatar').forEach((el) => {
    el.classList.add('con-imagen');
    el.classList.toggle('avatar-fijo', rol === 'administrador');
    el.innerHTML = `<img src="${srcAvatar(nivel)}" alt="">`;
  });
}

// ---------- Tarjeta de perfil del avatar ----------
// Coordinación: se abre al pasar el mouse (escritorio). En celular, todos los roles la abren al tocar su
// avatar, y ahí está "Cerrar sesión" (la parte baja del menú lateral no se ve en pantallas chicas).
const esMovil = () => matchMedia('(max-width: 1000px), (hover: none)').matches;

function iniciarTarjetaPerfil() {
  const esAdmin = rol === 'administrador';
  const arriba = document.querySelector('.topbar .avatar');
  const objetivos = [arriba, esAdmin ? document.querySelector('.sidebar .profile') : null].filter(Boolean);
  if (!objetivos.length) return;
  const pop = document.createElement('div');
  pop.className = 'perfil-pop';
  pop.id = 'perfil-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', `Perfil de ${sesion.nombre}`);
  pop.hidden = true;
  document.body.appendChild(pop);
  objetivos.forEach((el) => { el.setAttribute('aria-haspopup', 'dialog'); el.setAttribute('aria-controls', 'perfil-pop'); });

  const foto = () => (esAdmin
    ? `<img class="perfil-pop-avatar" src="${AVATAR_COORDINACION}" alt="Avatar de Coordinación: matraz con corona">`
    : TIENE_CONDUCTA.includes(rol)
      ? `<img class="perfil-pop-avatar medalla" src="${srcAvatar(sesion.avatar || 1)}" alt="Tu avatar">`
      : `<span class="avatar perfil-pop-avatar">${esc(iniciales(sesion.nombre))}</span>`);
  const pie = `<div class="perfil-pop-pie">
      <a class="text-link" href="${TIENE_CONDUCTA.includes(rol) ? 'avatares.html' : 'roles.html'}">${TIENE_CONDUCTA.includes(rol) ? 'Mi buena conducta ↗' : 'Roles y alcance ↗'}</a>
      <button type="button" class="button perfil-pop-salir">${ICONOS.salir} Cerrar sesión</button></div>`;

  let cargado = false;
  async function llenar() {
    const cabeza = `<div class="perfil-pop-cabeza">${foto()}
        <div><strong>${esc(sesion.nombre)}</strong><span class="badge violet">${esc(et(rol))}</span><small><code>${esc(sesion.usuario || '')}</code></small></div>
      </div>`;
    pop.innerHTML = `${cabeza}<p class="muted perfil-pop-cargando">Cargando…</p>${pie}`;
    try {
      const yo = await api('/auth/yo');
      const fechas = `<dl class="perfil-pop-datos">
          <div><dt>Sesión iniciada</dt><dd>${yo.ultimo_acceso ? fechaCorta(yo.ultimo_acceso, true) : '—'}</dd></div>
          <div><dt>Cuenta desde</dt><dd>${fechaCorta(yo.creado)}</dd></div>
        </dl>`;
      let extra = '';
      if (esAdmin) {
        const [pend, usuarios] = await Promise.all([api('/practicas?pendientes=1'), api('/escolar/usuarios')]);
        const alumnos = usuarios.filter((u) => u.rol === 'alumno' && u.activo).length;
        const personal = usuarios.filter((u) => u.rol !== 'alumno' && u.activo).length;
        extra = `<ul class="perfil-pop-cifras">
            <li><a href="practicas.html"><b>${pend.length}</b>Por autorizar</a></li>
            <li><a href="escuela.html"><b>${alumnos}</b>Alumnos</a></li>
            <li><a href="laboratoristas.html"><b>${personal}</b>Personal</a></li>
          </ul>
          <p class="perfil-pop-nota">${NAV_ICONOS.medalla} Avatar exclusivo de Coordinación</p>`;
      } else if (TIENE_CONDUCTA.includes(rol)) {
        extra = `<ul class="perfil-pop-cifras dos">
            <li><a href="avatares.html"><b>${yo.puntos_conducta}</b>Puntos de conducta</a></li>
            <li><a href="${rol === 'alumno' ? 'mi-equipo.html' : 'grupos.html'}"><b>${esc(rol === 'alumno' ? (yo.equipo_trabajo || '—') : 'Ver')}</b>${rol === 'alumno' ? esc(yo.grupo || 'Mi equipo') : 'Mis grupos'}</a></li>
          </ul>`;
      }
      pop.innerHTML = `${cabeza}${fechas}${extra}${pie}`;
      cargado = true;
    } catch (e) {
      const c = pop.querySelector('.perfil-pop-cargando');
      if (c) c.textContent = 'No se pudo cargar el perfil.';
    }
  }
  pop.addEventListener('click', (e) => { if (e.target.closest('.perfil-pop-salir')) Sesion.cerrar(); });

  let ocultarT = null;
  let actual = null;
  function colocar(el) {
    const r = el.getBoundingClientRect();
    const ancho = pop.offsetWidth;
    const alto = pop.offsetHeight;
    const margen = 12;
    // Debajo del avatar de arriba; a la derecha del perfil de la barra lateral
    let top; let left;
    if (el.closest('.topbar')) {
      top = r.bottom + 10;
      left = r.right - ancho;
    } else {
      left = r.right + 12;
      top = r.bottom - alto;
      if (left + ancho > innerWidth - margen) { left = r.left; top = r.top - alto - 10; }
    }
    pop.style.left = `${Math.max(margen, Math.min(left, innerWidth - ancho - margen))}px`;
    pop.style.top = `${Math.max(margen, Math.min(top, innerHeight - alto - margen))}px`;
  }
  function mostrar(el) {
    clearTimeout(ocultarT);
    actual = el;
    if (!cargado) llenar().then(() => { if (!pop.hidden) colocar(actual); });
    pop.hidden = false;
    colocar(el);
    requestAnimationFrame(() => pop.classList.add('visible'));
  }
  function ocultar(inmediato = false) {
    clearTimeout(ocultarT);
    ocultarT = setTimeout(() => {
      pop.classList.remove('visible');
      setTimeout(() => { if (!pop.classList.contains('visible')) pop.hidden = true; }, sinMovimiento() ? 0 : 180);
    }, inmediato ? 0 : 160);
  }
  // Escritorio: coordinación con el mouse o el teclado
  if (esAdmin) {
    objetivos.forEach((el) => {
      el.addEventListener('mouseenter', () => { if (!esMovil()) mostrar(el); });
      el.addEventListener('mouseleave', () => { if (!esMovil()) ocultar(); });
      el.addEventListener('focus', () => { if (!esMovil()) mostrar(el); });
      el.addEventListener('blur', (e) => { if (!esMovil() && !pop.contains(e.relatedTarget)) ocultar(); });
    });
    pop.addEventListener('mouseenter', () => clearTimeout(ocultarT));
    pop.addEventListener('mouseleave', () => { if (!esMovil()) ocultar(); });
  }
  // Celular: tocar el avatar de arriba abre o cierra la tarjeta (en lugar de cambiar de página)
  arriba?.addEventListener('click', (e) => {
    if (!esMovil()) return;
    e.preventDefault();
    if (pop.hidden || !pop.classList.contains('visible')) mostrar(arriba); else ocultar(true);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !objetivos.some((o) => o.contains(e.target))) ocultar(true);
  });
  pop.addEventListener('focusout', (e) => { if (!esMovil() && !pop.contains(e.relatedTarget) && !objetivos.includes(e.relatedTarget)) ocultar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { ocultar(true); actual?.focus(); } });
  addEventListener('scroll', () => { if (!pop.hidden && actual) colocar(actual); }, { passive: true });
  addEventListener('resize', () => { if (!pop.hidden && actual) colocar(actual); });
}

// ---------- Menú lateral por categorías desplegables ----------
const FLECHA = '<svg class="nav-flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
function leerAbiertos() { try { return JSON.parse(localStorage.getItem('menu-abierto') || '{}'); } catch (_) { return {}; } }
function guardarAbiertos(v) { try { localStorage.setItem('menu-abierto', JSON.stringify(v)); } catch (_) {} }

function pintarMenu(nav) {
  const enlace = (m) => `<a href="${m.href}"${m.href === pagina ? ' aria-current="page"' : ''}>${NAV_ICONOS[m.icono]}<span>${esc(textoDe(m))}</span>${m.contador ? '<span class="nav-count" hidden>00</span>' : ''}</a>`;
  const mios = MENU.filter((m) => m.roles.includes(rol));
  const abiertos = leerAbiertos();
  const hecho = new Set();
  const partes = [];
  for (const m of mios) {
    if (!m.grupo) { partes.push(enlace(m)); continue; }
    if (hecho.has(m.grupo)) continue;
    hecho.add(m.grupo);
    const items = mios.filter((x) => x.grupo === m.grupo);
    if (items.length === 1) { partes.push(enlace(items[0])); continue; }
    const g = GRUPOS[m.grupo];
    const actual = items.some((x) => x.href === pagina);
    const abierto = actual || abiertos[m.grupo] === true;
    const contador = items.some((x) => x.contador);
    partes.push(`<div class="nav-grupo${actual ? ' contiene-actual' : ''}" data-grupo="${m.grupo}" data-abierto="${abierto}">
      <button type="button" class="nav-grupo-boton" aria-expanded="${abierto}" aria-controls="menu-${m.grupo}">${NAV_ICONOS[g.icono]}<span>${esc(textoDe(g))}</span>${contador ? '<span class="nav-count" hidden>00</span>' : ''}${FLECHA}</button>
      <div class="nav-grupo-items" id="menu-${m.grupo}"><div>${items.map(enlace).join('')}</div></div>
    </div>`);
  }
  nav.innerHTML = partes.join('');
  // Los enlaces de una categoría cerrada no reciben el foco del teclado
  const plano = matchMedia('(max-width: 1000px)'); // en celular el menú es una tira sin categorías
  const sincronizar = (grupo) => {
    const abierto = grupo.dataset.abierto === 'true' || plano.matches;
    grupo.querySelectorAll('.nav-grupo-items a').forEach((a) => { if (abierto) a.removeAttribute('tabindex'); else a.tabIndex = -1; });
  };
  nav.querySelectorAll('.nav-grupo').forEach(sincronizar);
  plano.addEventListener('change', () => nav.querySelectorAll('.nav-grupo').forEach(sincronizar));
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('.nav-grupo-boton');
    if (!b) return;
    const grupo = b.parentElement;
    const abrir = grupo.dataset.abierto !== 'true';
    grupo.dataset.abierto = String(abrir);
    b.setAttribute('aria-expanded', String(abrir));
    sincronizar(grupo);
    const v = leerAbiertos();
    v[grupo.dataset.grupo] = abrir;
    guardarAbiertos(v);
  });
}

function iniciales(nombre) {
  const partes = nombre.replace(/^(dr|dra|mtro|mtra|ing|lic)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || 'US';
}

document.addEventListener('DOMContentLoaded', () => {
  // Menú lateral generado según el rol
  const nav = document.querySelector('.sidebar nav');
  if (nav) pintarMenu(nav);
  document.querySelectorAll('.sidebar a.brand').forEach((a) => { a.href = inicio; });
  // Abajo del menú solo queda "Roles y alcance"
  const abajo = document.querySelector('.sidebar-bottom');
  if (abajo) {
    abajo.querySelectorAll('a.secondary-link').forEach((a) => a.remove());
    abajo.insertAdjacentHTML('afterbegin', `<a class="secondary-link" href="roles.html"${pagina === 'roles.html' ? ' aria-current="page"' : ''}>${NAV_ICONOS.info} Roles y alcance</a>`);
  }
  // Enlaces del pie que el rol no puede abrir
  document.querySelectorAll('footer a[href]').forEach((a) => {
    const permitido = ACCESO[a.getAttribute('href').split('#')[0]];
    if (!permitido || !permitido.includes(rol)) a.remove();
  });
  // Sin separadores "·" repetidos o sueltos después de quitar enlaces
  document.querySelectorAll('footer i').forEach((sep) => {
    const antes = sep.previousElementSibling;
    if (!antes || antes.tagName === 'I') sep.remove();
  });
  document.querySelectorAll('[data-roles]').forEach((el) => {
    if (!el.dataset.roles.split(' ').includes(rol)) el.remove();
  });

  // Perfil del usuario
  const ini = iniciales(sesion.nombre);
  const perfil = document.querySelector('.sidebar .profile');
  if (perfil) {
    perfil.href = TIENE_CONDUCTA.includes(rol) ? 'avatares.html' : 'roles.html';
    perfil.innerHTML = `<span class="avatar">${esc(ini)}</span><span>${esc(sesion.nombre)}<small>${esc(et(rol))}</small></span><span>↗</span>`;
    const salir = document.createElement('button');
    salir.type = 'button';
    salir.className = 'secondary-link logout';
    salir.innerHTML = `${ICONOS.salir} Cerrar sesión`;
    salir.addEventListener('click', () => Sesion.cerrar());
    const clave = document.createElement('button');
    clave.type = 'button';
    clave.className = 'secondary-link';
    clave.innerHTML = `${ICONOS.llave} Cambiar contraseña`;
    clave.addEventListener('click', cambiarPassword);
    perfil.before(clave, salir);
  }
  // Cambio de colores oscuros/claros (tema.js aplica el tema guardado antes de pintar)
  const campanaTopbar = document.querySelector('.topbar a.icon-button');
  if (campanaTopbar && window.Tema) campanaTopbar.before(Tema.boton('icon-button tema-toggle'));

  const avatar = document.querySelector('.topbar .avatar');
  if (avatar) {
    avatar.textContent = ini;
    avatar.setAttribute('aria-label', `${sesion.nombre} · ${et(rol)}`);
    if (avatar.tagName === 'A') avatar.href = TIENE_CONDUCTA.includes(rol) ? 'avatares.html' : 'roles.html';
  }

  // Coordinación: avatar fijo. Tarjeta de perfil: coordinación con el mouse; todos al tocar el avatar en celular
  if (rol === 'administrador') ponerAvatar();
  iniciarTarjetaPerfil();

  // Profesores y alumnos usan como foto de perfil el avatar que desbloquearon
  if (TIENE_CONDUCTA.includes(rol)) {
    if (sesion.avatar) ponerAvatar(sesion.avatar);
    api('/auth/yo').then((yo) => {
      sesion.avatar = Math.min(yo.avatar, nivelPorPuntos(yo.puntos_conducta));
      Sesion.guardar(sesion);
      ponerAvatar(sesion.avatar);
    }).catch(() => {});
  }

  // Indicador de datos en vivo
  const pill = document.querySelector('.demo-pill');
  if (pill) pill.innerHTML = '<span class="live-dot"></span> Datos en vivo';

  // La campana abre los avisos personales (solicitudes, decisiones, fin de semestre…)
  const campana = document.querySelector('.topbar a.icon-button');
  if (campana) {
    campana.href = 'avisos.html';
    fetch('/api/notificaciones?no_leidas=1', { headers: { Authorization: `Bearer ${sesion.token}` } })
      .then((r) => r.json()).then((j) => {
        const n = j.no_leidas || 0;
        campana.setAttribute('aria-label', n ? `${n} aviso(s) sin leer` : 'Avisos');
        campana.querySelector('.notification-dot')?.toggleAttribute('hidden', !n);
      }).catch(() => {});
  }

  // Contador de alertas de inventario (laboratorio y coordinación)
  if (LAB.includes(rol)) {
    api('/inventario/alertas').then((alertas) => {
      const n = String(alertas.length).padStart(2, '0');
      document.querySelectorAll('.nav-count').forEach((el) => { el.textContent = n; el.hidden = !alertas.length; });
    }).catch(() => {});
  }
});

// Cambiar la propia contraseña (todos los roles). La sesión sigue abierta después del cambio.
function cambiarPassword() {
  const dlg = abrirDialogo(`<form novalidate>
    <h2>Cambiar contraseña</h2>
    <p class="muted">Usuario: <strong>${esc(sesion.usuario || sesion.nombre)}</strong>. La nueva debe tener al menos 8 caracteres.</p>
    <input type="text" name="usuario" autocomplete="username" value="${esc(sesion.usuario || '')}" hidden>
    <div class="form-grid">
      <label class="ancho">Contraseña actual<input type="password" name="actual" autocomplete="current-password" required></label>
      <label class="ancho">Contraseña nueva<input type="password" name="nueva" autocomplete="new-password" minlength="8" maxlength="200" required></label>
      <label class="ancho">Repite la contraseña nueva<input type="password" name="confirmar" autocomplete="new-password" minlength="8" maxlength="200" required></label>
    </div>
    <p class="form-error" role="alert" hidden></p>
    <div class="modal-acciones"><span class="espacio"></span><button class="button" type="button" data-cerrar>Cancelar</button>
    <button class="button primary" type="submit">Guardar contraseña</button></div></form>`, 'modal-chico');
  const f = dlg.querySelector('form');
  const $err = f.querySelector('.form-error');
  const error = (m, campo) => { $err.textContent = m; $err.hidden = false; f[campo]?.focus(); };
  f.actual.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    $err.hidden = true;
    const { actual, nueva, confirmar } = f;
    if (!actual.value) return error('Escribe tu contraseña actual.', 'actual');
    if (nueva.value.length < 8) return error('La contraseña nueva debe tener al menos 8 caracteres.', 'nueva');
    if (nueva.value === actual.value) return error('La contraseña nueva debe ser distinta de la actual.', 'nueva');
    if (nueva.value !== confirmar.value) return error('Las contraseñas nuevas no coinciden.', 'confirmar');
    const boton = f.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      await api('/auth/password', { method: 'POST', body: { actual: actual.value, nueva: nueva.value } });
      cerrarDialogo(dlg);
      toast('Contraseña actualizada. Úsala la próxima vez que inicies sesión.');
    } catch (er) {
      boton.disabled = false;
      actual.value = '';
      error(er.message, 'actual');
    }
  });
}
