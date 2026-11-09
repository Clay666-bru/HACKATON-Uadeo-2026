// Sesión, comunicación con la API y utilidades compartidas
const Sesion = {
  obtener() {
    try { return JSON.parse(sessionStorage.getItem('sesion') || 'null'); } catch (_) { return null; }
  },
  guardar(s) {
    sessionStorage.setItem('sesion', JSON.stringify(s));
  },
  cerrar() {
    try { sessionStorage.removeItem('sesion'); } catch (_) {}
    location.href = 'login.html';
  },
};

async function api(ruta, opciones = {}) {
  const s = Sesion.obtener() || {};
  const headers = { 'Content-Type': 'application/json' };
  if (s.token) headers.Authorization = `Bearer ${s.token}`;
  else if (s.rol) { headers['X-Rol'] = s.rol; headers['X-Usuario'] = encodeURIComponent(s.nombre || ''); }
  const resp = await fetch('/api' + ruta, {
    method: opciones.method || 'GET',
    headers,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  let json = {};
  try { json = await resp.json(); } catch (_) {}
  if (!resp.ok) {
    if (resp.status === 401 && s.token) {
      alert('Tu sesión expiró. Vuelve a iniciar sesión.');
      Sesion.cerrar();
    }
    const err = new Error(json.error || `Error ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return json.data;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(mensaje, tipo = 'ok') {
  let cont = document.getElementById('toasts');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toasts';
    cont.className = 'toasts';
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = mensaje;
  cont.appendChild(el);
  setTimeout(() => {
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), sinMovimiento() ? 0 : 300);
  }, 4500);
}

// ---------- Animaciones ----------
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Entrada escalonada de los hijos de un contenedor recién pintado
function animarHijos(el, retrasoMax = 14) {
  if (!el) return;
  el.classList.remove('anim');
  void el.offsetWidth; // reinicia la animación si el contenedor se vuelve a pintar
  [...el.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, retrasoMax)));
  el.classList.add('anim');
}

// Cuenta de 0 al valor final en los elementos [data-cuenta]
function animarConteos(raiz = document) {
  raiz.querySelectorAll('[data-cuenta]').forEach((el) => {
    const final = Number(el.dataset.cuenta);
    const ancho = el.dataset.ancho ? Number(el.dataset.ancho) : 0;
    const formato = (n) => String(Math.round(n)).padStart(ancho, '0');
    if (sinMovimiento() || !final) { el.textContent = formato(final); return; }
    const inicio = performance.now();
    const dur = 900;
    const paso = (t) => {
      const p = Math.min((t - inicio) / dur, 1);
      el.textContent = formato(final * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    // Si el navegador pausa la animación (pestaña en segundo plano), igual termina en el valor real
    setTimeout(() => { el.textContent = formato(final); }, dur + 100);
  });
}

const ETIQUETAS = {
  REACTIVO: 'Reactivo', CONSUMIBLE: 'Consumible', EQUIPO: 'Equipo',
  OPERATIVO: 'Operativo', EN_MANTENIMIENTO: 'Mantenimiento', FUERA_DE_SERVICIO: 'Fuera de servicio',
  DISPONIBLE: 'Disponible', STOCK_BAJO: 'Stock bajo', AGOTADO: 'Agotado', CADUCADO: 'Caducado', POR_CADUCAR: 'Caduca pronto',
  SIN_DISPONIBLES: 'Sin unidades', MANTENIMIENTO_VENCIDO: 'Mantenimiento vencido', MANTENIMIENTO_PROXIMO: 'Mantenimiento próximo',
  ENTRADA: 'Entrada', SALIDA: 'Salida',
  COMPRA: 'Compra', DONACION: 'Donación', DEVOLUCION: 'Devolución', AJUSTE: 'Ajuste de inventario',
  PRACTICA: 'Uso en laboratorio', CADUCIDAD: 'Caducidad', DANO: 'Daño',
  DEVOLUCION_PRESTAMO: 'Devolución de préstamo', REGRESO_MANTENIMIENTO: 'Regreso de mantenimiento',
  PRESTAMO: 'Préstamo', MANTENIMIENTO: 'Mantenimiento', BAJA: 'Baja',
  BUENA: 'Buena', CON_DETALLES: 'Con detalles', DANADO: 'Dañado',
  profesor: 'Profesor', administrador: 'Coordinación', laboratorio: 'Laboratorio', alumno: 'Alumno',
  // Nivel 2
  PENDIENTE_ADMIN: 'Espera coordinación', RECHAZADA_ADMIN: 'Rechazada por coordinación',
  PENDIENTE_LAB: 'Espera laboratorio', RECHAZADA_LAB: 'Rechazada por laboratorio',
  APROBADA: 'Aprobada', CANCELADA: 'Cancelada', REALIZADA: 'Realizada',
  SOLICITADA: 'Solicitada', RECHAZADA: 'Rechazada', EN_RENTA: 'En renta', CONCLUIDA: 'Concluida',
  SOLICITADO: 'Solicitado', RECHAZADO: 'Rechazado', PENDIENTE_DEVOLUCION: 'Pendiente de devolución', DEVUELTO: 'Devuelto',
  MATUTINO: 'Matutino', VESPERTINO: 'Vespertino', ACTIVO: 'En curso', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
};
const et = (k) => ETIQUETAS[k] || k;

// Color de insignia del diseño: mint (bien), orange (atención), violet (mantenimiento)
const COLOR_ESTADO = {
  DISPONIBLE: 'mint', OPERATIVO: 'mint',
  STOCK_BAJO: 'orange', POR_CADUCAR: 'orange', AGOTADO: 'orange', CADUCADO: 'orange', FUERA_DE_SERVICIO: 'orange',
  EN_MANTENIMIENTO: 'violet',
  APROBADA: 'mint', REALIZADA: 'mint', EN_RENTA: 'violet', CONCLUIDA: 'mint', DEVUELTO: 'mint', ACTIVO: 'mint',
  PENDIENTE_ADMIN: 'violet', PENDIENTE_LAB: 'violet', SOLICITADA: 'violet', SOLICITADO: 'violet', PENDIENTE_DEVOLUCION: 'orange',
  RECHAZADA_ADMIN: 'orange', RECHAZADA_LAB: 'orange', RECHAZADA: 'orange', RECHAZADO: 'orange', CANCELADA: 'orange', CANCELADO: 'orange', FINALIZADO: 'violet',
};
const badgeEstado = (e) => `<span class="badge ${COLOR_ESTADO[e] || 'mint'}">${esc(et(e))}</span>`;

const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
function fechaCorta(s, conHora = false) {
  if (!s) return '—';
  const [f, h] = String(s).split(' ');
  const [a, m, d] = f.split('-');
  return `${d} ${MESES[Number(m) - 1]} ${a}${conHora && h ? ' · ' + h.slice(0, 5) : ''}`;
}

function numero(n) {
  return Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

// Íconos del diseño (mismos trazos que el sidebar)
const ICONOS = {
  caja: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7 5l9 5"/></svg>',
  matraz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6 M10 3v7L4 20q0 1 2 1h12q2 0 2-1l-6-10V3 M7 15h10"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg>',
  mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z M20 14v.01 M14 20h.01 M17 20h4v-3"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z M12 10v4 M12 17v.01"/></svg>',
  llave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.2-8.2 M16 7l2.5 2.5 M14 9l2 2"/></svg>',
  salir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l5-5-5-5 M15 12H4"/></svg>',
};

// Ícono y color según categoría
function iconoCategoria(cat, estado) {
  if (estado === 'EN_MANTENIMIENTO') return `<span class="material-icon violet">${ICONOS.caja}</span>`;
  return cat === 'REACTIVO'
    ? `<span class="material-icon orange">${ICONOS.matraz}</span>`
    : `<span class="material-icon mint">${ICONOS.caja}</span>`;
}

// Normaliza materiales y equipos a una sola forma para tablas y fichas
function comoArticulo(item, clase) {
  if (clase === 'material') {
    return {
      clase, id: item.id, codigo: item.codigo, nombre: item.nombre, categoria: item.tipo,
      estado: item.estado, existencia: item.stock, unidad: item.unidad,
      detalle: `${et(item.tipo)} · mínimo ${numero(item.stock_minimo)} ${item.unidad}`,
      avisos: item.avisos, raw: item,
    };
  }
  return {
    clase, id: item.id, codigo: item.codigo, nombre: item.nombre, categoria: 'EQUIPO',
    estado: item.estado, existencia: item.cantidad, unidad: item.cantidad === 1 ? 'unidad' : 'unidades',
    detalle: [item.marca, item.modelo].filter(Boolean).join(' ') || 'Equipo',
    avisos: item.avisos, raw: item,
  };
}

// ---------- Diálogos y formularios (Nivel 2) ----------
function cerrarDialogo(dlg) {
  if (dlg.open) dlg.close();
  dlg.remove();
}

function abrirDialogo(html, clase = '') {
  const dlg = document.createElement('dialog');
  dlg.className = `panel modal ${clase}`;
  dlg.innerHTML = html;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => cerrarDialogo(dlg)));
  dlg.showModal();
  return dlg;
}

// Pide confirmación con un texto opcional (comentario o motivo)
function preguntar({ titulo, texto = '', boton = 'Confirmar', peligro = false, campo = null }) {
  return new Promise((resolver) => {
    const dlg = abrirDialogo(`<form method="dialog" novalidate>
      <h2>${esc(titulo)}</h2>${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
      ${campo ? `<div class="form-grid"><label class="ancho">${esc(campo)}<textarea name="valor" rows="3" maxlength="255"></textarea></label></div>` : ''}
      <div class="modal-acciones"><span class="espacio"></span><button class="button" type="button" data-cerrar>Cancelar</button>
      <button class="button ${peligro ? 'peligro' : 'primary'}" type="submit">${esc(boton)}</button></div></form>`, 'modal-chico');
    let respondio = false;
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      respondio = true;
      const valor = dlg.querySelector('[name=valor]')?.value.trim() || '';
      cerrarDialogo(dlg);
      resolver({ ok: true, valor });
    });
    dlg.addEventListener('close', () => { if (!respondio) resolver({ ok: false }); });
  });
}

// Sube un archivo (multipart) con la sesión
async function apiArchivo(ruta, datos) {
  const s = Sesion.obtener() || {};
  const resp = await fetch('/api' + ruta, { method: 'POST', headers: s.token ? { Authorization: `Bearer ${s.token}` } : {}, body: datos });
  let json = {};
  try { json = await resp.json(); } catch (_) {}
  if (!resp.ok) throw new Error(json.error || `Error ${resp.status}`);
  return json.data;
}

// Abre en otra pestaña una página que requiere sesión (reportes imprimibles)
async function abrirConSesion(ruta) {
  const ventana = window.open('', '_blank');
  const s = Sesion.obtener() || {};
  const resp = await fetch('/api' + ruta, { headers: { Authorization: `Bearer ${s.token}` } });
  if (!resp.ok) {
    ventana?.close();
    let json = {}; try { json = await resp.json(); } catch (_) {}
    throw new Error(json.error || `Error ${resp.status}`);
  }
  const url = URL.createObjectURL(new Blob([await resp.text()], { type: 'text/html' }));
  if (ventana) ventana.location.href = url; else location.href = url;
}

const vacio = (texto) => `<p class="vacio muted">${esc(texto)}</p>`;
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function cargarArticulos() {
  const [mats, eqs] = await Promise.all([api('/inventario/materiales'), api('/inventario/equipos')]);
  return [...eqs.map((e) => comoArticulo(e, 'equipo')), ...mats.map((m) => comoArticulo(m, 'material'))];
}

function filaArticulo(a) {
  return `<tr class="item ${a.categoria.toLowerCase()}">
    <td><div class="material">${iconoCategoria(a.categoria, a.estado)}<span><strong>${esc(a.nombre)}</strong><small>${esc(a.detalle)}</small></span></div></td>
    <td><code>${esc(a.codigo)}</code></td>
    <td>${esc(et(a.categoria))}</td>
    <td><strong>${numero(a.existencia)}</strong> <span class="muted">${esc(a.unidad)}</span></td>
    <td>${badgeEstado(a.estado)}</td>
    <td><a class="text-link" href="inventario.html#ficha-${encodeURIComponent(a.codigo)}">Ver ficha ↗</a></td>
  </tr>`;
}
