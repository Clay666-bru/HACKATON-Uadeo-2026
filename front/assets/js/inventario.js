// Inventario en vivo: tabla con filtros, fichas, alta y edición (laboratorista)
let articulos = [];

function fichaArticulo(a, i) {
  const r = a.raw;
  const filas = a.clase === 'material'
    ? [['Existencia', `${numero(a.existencia)} ${a.unidad}`], ['Categoría', et(a.categoria)], ['Stock mínimo', `${numero(r.stock_minimo)} ${r.unidad}`], ['Caducidad', fechaCorta(r.fecha_caducidad)]]
    : [['Disponibles', `${a.existencia} ${a.unidad}`], ['Marca / modelo', a.detalle], ['Número de serie', r.numero_serie || '—'], ['Próx. mantenimiento', fechaCorta(r.proximo_mantenimiento)]];
  const avisos = a.avisos.filter((x) => x.tipo !== a.estado);
  return `<article class="panel material-card" id="ficha-${esc(a.codigo)}">
    <div class="card-top"><code>${esc(a.codigo)}</code>${badgeEstado(a.estado)}</div>
    <div class="ficha-cabeza"><div><h3>${esc(a.nombre)}</h3><p>${esc(a.detalle)}</p></div>
      <img class="ficha-qr" src="/api/inventario/qr/${encodeURIComponent(a.codigo)}" alt="QR ${esc(a.codigo)}" width="64" height="64" loading="lazy"></div>
    <dl>${filas.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
    ${avisos.length ? `<ul class="avisos">${avisos.map((x) => `<li class="${x.prioridad === 'alta' ? 'orange-text' : 'violet-text'}">${esc(x.mensaje)}</li>`).join('')}</ul>` : ''}
    <div class="ficha-acciones">
      ${esLab ? `<a class="text-link" href="movimientos.html?codigo=${encodeURIComponent(a.codigo)}">Registrar movimiento ↗</a><button type="button" class="text-link" data-editar="${i}">Editar</button>` : ''}
    </div>
  </article>`;
}

function pintar() {
  const q = document.getElementById('buscar').value.trim().toLowerCase();
  const lista = q ? articulos.filter((a) => (a.codigo + ' ' + a.nombre + ' ' + a.detalle).toLowerCase().includes(q)) : articulos;
  const contar = (cat) => lista.filter((a) => a.categoria === cat).length;
  document.getElementById('c-todos').textContent = lista.length;
  document.getElementById('c-equipo').textContent = contar('EQUIPO');
  document.getElementById('c-reactivo').textContent = contar('REACTIVO');
  document.getElementById('c-consumible').textContent = contar('CONSUMIBLE');
  document.getElementById('tabla').innerHTML = lista.length
    ? lista.map(filaArticulo).join('')
    : '<tr><td colspan="6" class="muted">No hay materiales que coincidan.</td></tr>';
  document.getElementById('fichas').innerHTML = lista.map((a) => fichaArticulo(a, articulos.indexOf(a))).join('');
  animarHijos(document.getElementById('tabla'));
  animarHijos(document.getElementById('fichas'), 8);
}

async function cargar() {
  articulos = await cargarArticulos();
  pintar();
}

(async () => {
  try {
    await cargar();
    if (location.hash.startsWith('#ficha-')) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  } catch (e) {
    document.getElementById('tabla').innerHTML = `<tr><td colspan="6" class="muted">No se pudo cargar el inventario: ${esc(e.message)}</td></tr>`;
  }
})();

let espera;
document.getElementById('buscar').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(pintar, 150); });

// ---------- Alta (solo laboratorista) ----------
const $alta = document.getElementById('form-alta');
if ($alta) {
  document.getElementById('btn-alta')?.addEventListener('click', () => { document.getElementById('alta').open = true; });
  if (location.hash === '#nuevo') document.getElementById('alta').open = true;

  const mostrarCampos = () => {
    const esEquipo = $alta.categoria.value === 'EQUIPO';
    $alta.querySelectorAll('[data-solo]').forEach((el) => { el.hidden = (el.dataset.solo === 'equipo') !== esEquipo; });
  };
  $alta.categoria.addEventListener('change', mostrarCampos);
  mostrarCampos();

  $alta.addEventListener('submit', async (e) => {
    e.preventDefault();
    const $err = $alta.querySelector('.form-error');
    $err.hidden = true;
    if (!$alta.nombre.value.trim()) { $err.textContent = 'Escribe el nombre.'; $err.hidden = false; $alta.nombre.focus(); return; }
    const esEquipo = $alta.categoria.value === 'EQUIPO';
    const datos = {};
    $alta.querySelectorAll('input, select').forEach((el) => {
      const zona = el.closest('[data-solo]')?.dataset.solo;
      if (el.name && (!zona || zona === (esEquipo ? 'equipo' : 'material'))) datos[el.name] = el.value;
    });
    if (!esEquipo) datos.tipo = datos.categoria;
    const btn = $alta.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const creado = await api(`/inventario/${esEquipo ? 'equipos' : 'materiales'}`, { method: 'POST', body: datos });
      $alta.reset();
      mostrarCampos();
      document.getElementById('alta').open = false;
      await cargar();
      mostrarCreado(creado);
    } catch (err) {
      $err.textContent = err.message;
      $err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

function mostrarCreado(item) {
  const dlg = abrirDialogo(`
    <p class="eyebrow">ALTA REGISTRADA</p><h2>${esc(item.nombre)}</h2>
    <figure class="etiqueta"><img src="/api/inventario/qr/${encodeURIComponent(item.codigo)}" alt="QR ${esc(item.codigo)}" width="180" height="180"><figcaption><strong>${esc(item.codigo)}</strong><span>${esc(item.nombre)}</span></figcaption></figure>
    <p class="muted">Imprime esta etiqueta y pégala en el artículo para poder escanearlo.</p>
    <div class="modal-acciones"><button class="button" type="button" data-cerrar>Cerrar</button><button class="button primary" type="button" data-imprimir>${ICONOS.qr}Imprimir etiqueta</button></div>`);
  dlg.classList.add('modal-qr');
  dlg.querySelector('[data-imprimir]').addEventListener('click', () => {
    document.body.classList.add('imprimiendo-modal');
    window.print();
    document.body.classList.remove('imprimiendo-modal');
  });
}

// ---------- Edición y baja ----------
document.getElementById('fichas').addEventListener('click', (e) => {
  const i = e.target.closest('[data-editar]')?.dataset.editar;
  if (i !== undefined) abrirEdicion(articulos[Number(i)]);
});

function abrirEdicion(a) {
  const r = a.raw;
  const esMat = a.clase === 'material';
  const v = (k) => esc(r[k] ?? '');
  const f = (k) => esc((r[k] || '').slice(0, 10));
  const opciones = (lista, actual) => lista.map((o) => `<option value="${o}" ${o === actual ? 'selected' : ''}>${et(o)}</option>`).join('');
  const campos = esMat
    ? `<label>Nombre<input name="nombre" value="${v('nombre')}" required maxlength="120"></label>
       <label>Categoría<select name="tipo">${opciones(['REACTIVO', 'CONSUMIBLE'], r.tipo)}</select></label>
       <label>Unidad<input name="unidad" value="${v('unidad')}" required maxlength="20" list="unidades"></label>
       <label>Stock mínimo<input name="stock_minimo" type="number" min="0" step="any" value="${v('stock_minimo')}"></label>
       <label>Caducidad<input name="fecha_caducidad" type="date" value="${f('fecha_caducidad')}"></label>`
    : `<label>Nombre<input name="nombre" value="${v('nombre')}" required maxlength="120"></label>
       <label>Estado<select name="estado">${opciones(['OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO'], r.estado)}</select></label>
       <label>Marca<input name="marca" value="${v('marca')}" maxlength="60"></label>
       <label>Modelo<input name="modelo" value="${v('modelo')}" maxlength="60"></label>
       <label>Número de serie<input name="numero_serie" value="${v('numero_serie')}" maxlength="80"></label>
       <label>Último mantenimiento<input name="ultimo_mantenimiento" type="date" value="${f('ultimo_mantenimiento')}"></label>
       <label>Próximo mantenimiento<input name="proximo_mantenimiento" type="date" value="${f('proximo_mantenimiento')}"></label>`;
  const dlg = abrirDialogo(`
    <form novalidate><p class="eyebrow">EDITAR · ${esc(a.codigo)}</p><h2>${esc(a.nombre)}</h2>
    <p class="muted">La existencia solo cambia con entradas y salidas en Movimientos.</p>
    <div class="form-grid">${campos}</div><p class="form-error" role="alert" hidden></p>
    <div class="modal-acciones"><button class="button peligro" type="button" data-baja>Dar de baja</button><span class="espacio"></span><button class="button" type="button" data-cerrar>Cancelar</button><button class="button primary" type="submit">Guardar cambios</button></div></form>`);
  const $form = dlg.querySelector('form');
  const $err = dlg.querySelector('.form-error');
  const ruta = `/inventario/${esMat ? 'materiales' : 'equipos'}/${a.id}`;

  $form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $err.hidden = true;
    try {
      await api(ruta, { method: 'PUT', body: Object.fromEntries(new FormData($form)) });
      cerrarDialogo(dlg);
      toast(`${a.codigo} actualizado`);
      await cargar();
    } catch (err) { $err.textContent = err.message; $err.hidden = false; }
  });
  dlg.querySelector('[data-baja]').addEventListener('click', async () => {
    if (!confirm(`¿Dar de baja ${a.codigo} · ${a.nombre}? Ya no aparecerá en el inventario, pero su historial se conserva.`)) return;
    try {
      await api(`${ruta}/baja`, { method: 'POST' });
      cerrarDialogo(dlg);
      toast(`${a.codigo} dado de baja`);
      await cargar();
    } catch (err) { $err.textContent = err.message; $err.hidden = false; }
  });
}
