// Movimientos: registro por QR (laboratorista), bitácora e historial
let motivos = null;
let lector = null;
let actual = null; // { clase, item }

function itemBitacora(m) {
  const entrada = m.tipo === 'ENTRADA';
  const color = entrada ? 'mint' : 'orange';
  return `<article class="timeline-item"><span class="timeline-dot ${color}"></span>
    <div class="card-top"><span class="badge ${color}">${et(m.tipo)} · ${esc(et(m.motivo))}</span><small>${fechaCorta(m.fecha_hora, true)}</small></div>
    <h3>${esc(m.nombre)} <code>${esc(m.codigo)}</code></h3>
    <p>${esc(m.persona || m.proveedor || m.responsable)} <strong class="${entrada ? 'mint-text' : 'orange-text'}">${entrada ? '+' : '−'} ${numero(m.cantidad)} ${esc(m.unidad)}</strong></p></article>`;
}

async function cargarBitacora() {
  const movs = await api('/movimientos?limite=5');
  document.getElementById('bitacora').innerHTML = movs.length ? movs.map(itemBitacora).join('') : '<p class="muted">Aún no hay movimientos.</p>';
  animarHijos(document.getElementById('bitacora'));
}

async function cargarHistorial() {
  const clase = document.getElementById('f-clase').value;
  const tipo = document.getElementById('f-tipo').value;
  const movs = await api(`/movimientos?clase=${clase}&tipo=${tipo}&limite=200`);
  document.getElementById('historial').innerHTML = movs.length ? movs.map((m) => `<tr>
      <td>${fechaCorta(m.fecha_hora, true)}</td>
      <td><span class="badge ${m.tipo === 'ENTRADA' ? 'mint' : 'orange'}">${et(m.tipo)}</span></td>
      <td><strong>${esc(m.nombre)}</strong><br><code>${esc(m.codigo)}</code></td>
      <td><strong>${numero(m.cantidad)}</strong> <span class="muted">${esc(m.unidad)}</span></td>
      <td>${esc(et(m.motivo))}${m.observaciones ? `<br><small class="muted">${esc(m.observaciones)}</small>` : ''}</td>
      <td>${esc(m.persona || m.proveedor || '—')}</td>
      <td>${esc(m.responsable)}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">Sin movimientos.</td></tr>';
  animarHijos(document.getElementById('historial'));
}

const refrescar = () => Promise.all([cargarBitacora(), cargarHistorial()]).catch((e) => toast(e.message, 'error'));
document.getElementById('f-clase').addEventListener('change', refrescar);
document.getElementById('f-tipo').addEventListener('change', refrescar);
refrescar();

// ---------- Registro (solo laboratorista) ----------
const $codigo = document.getElementById('codigo');
const $form = document.getElementById('form-mov');

if ($codigo) {
  document.getElementById('responsable').textContent = sesion.nombre;

  document.getElementById('form-codigo').addEventListener('submit', (e) => { e.preventDefault(); buscar($codigo.value); });
  // Los lectores USB escriben el código y terminan con Enter
  $codigo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscar($codigo.value); } });
  document.getElementById('btn-camara').addEventListener('click', alternarCamara);
  document.getElementById('txt-camara').textContent = TEXTO_CAMARA();
  window.addEventListener('pagehide', detenerLector);

  const inicial = new URLSearchParams(location.search).get('codigo');
  if (inicial) { $codigo.value = inicial; buscar(inicial); } else $codigo.focus();

  $form.addEventListener('change', (e) => { if (['tipo', 'motivo'].includes(e.target.name)) pintarExtras(); });
  $form.addEventListener('submit', registrar);
}

// Los navegadores solo dan la cámara en vivo en páginas seguras (https o localhost).
// En http se usa una foto: la cámara del teléfono la toma y el QR se lee de la imagen.
function camaraEnVivo() {
  return window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

function TEXTO_CAMARA() {
  return camaraEnVivo() ? 'Activar cámara para leer el QR' : 'Tomar foto del QR';
}

function pedirFotoQR() {
  let $foto = document.getElementById('foto-qr');
  if (!$foto) {
    $foto = document.createElement('input');
    $foto.type = 'file';
    $foto.accept = 'image/*';
    $foto.capture = 'environment';
    $foto.id = 'foto-qr';
    $foto.hidden = true;
    $foto.addEventListener('change', () => { if ($foto.files[0]) leerFotoQR($foto.files[0]); $foto.value = ''; });
    document.body.append($foto);
  }
  $foto.click();
}

async function leerFotoQR(archivo) {
  const txt = document.getElementById('txt-camara');
  const l = new Html5Qrcode('lector');
  txt.textContent = 'Leyendo el QR…';
  try {
    const texto = await l.scanFile(archivo, false);
    $codigo.value = texto;
    buscar(texto);
  } catch (_) {
    toast('No se encontró un QR en la foto. Acércate, evita reflejos o escribe el código.', 'error');
  } finally {
    try { l.clear(); } catch (_) {}
    txt.textContent = TEXTO_CAMARA();
  }
}

async function alternarCamara() {
  const txt = document.getElementById('txt-camara');
  if (lector) { await detenerLector(); return; }
  if (typeof Html5Qrcode === 'undefined') { toast('No se cargó el lector de QR (requiere internet). Escribe el código.', 'error'); return; }
  if (!camaraEnVivo()) { pedirFotoQR(); return; }
  // El contenedor debe verse antes de iniciar: la librería toma su ancho para dibujar el video
  const $visor = document.getElementById('lector');
  $visor.classList.add('abierto');
  lector = new Html5Qrcode('lector');
  try {
    // El recuadro para apuntar ocupa el 75 % del lado menor del video
    const qrbox = (ancho, alto) => { const lado = Math.floor(Math.min(ancho, alto) * 0.75); return { width: lado, height: lado }; };
    await lector.start({ facingMode: 'environment' }, { fps: 10, qrbox }, async (texto) => {
      await detenerLector();
      $codigo.value = texto;
      buscar(texto);
    });
    txt.textContent = 'Cámara activa · toca para detener';
    document.getElementById('btn-camara').classList.add('activo');
    $visor.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'center' });
  } catch (e) {
    lector = null;
    $visor.classList.remove('abierto');
    toast('No se pudo abrir la cámara: ' + (e.message || e), 'error');
  }
}

async function detenerLector() {
  const txt = document.getElementById('txt-camara');
  if (txt) txt.textContent = TEXTO_CAMARA();
  document.getElementById('btn-camara')?.classList.remove('activo');
  document.getElementById('lector')?.classList.remove('abierto');
  if (!lector) return;
  const l = lector;
  lector = null;
  try { await l.stop(); l.clear(); } catch (_) {}
}

async function buscar(codigo) {
  codigo = String(codigo || '').trim();
  if (!codigo) return;
  const $a = document.getElementById('articulo');
  try {
    if (!motivos) motivos = await api('/movimientos/motivos');
    actual = await api('/inventario/codigo/' + encodeURIComponent(codigo));
    pintarArticulo();
  } catch (e) {
    actual = null;
    $form.hidden = true;
    $a.innerHTML = `<div class="notice warning">${ICONOS.alerta}<p>${esc(e.message)}</p></div>`;
  }
}

function pintarArticulo() {
  const { clase, item } = actual;
  const a = comoArticulo(item, clase);
  document.getElementById('articulo').innerHTML = `
    <div class="articulo-escaneado">
      <img src="/api/inventario/qr/${encodeURIComponent(a.codigo)}" alt="" width="64" height="64">
      <div><div class="card-top"><code>${esc(a.codigo)}</code>${badgeEstado(a.estado)}</div>
        <h3>${esc(a.nombre)}</h3>
        <p class="muted">${esc(et(a.categoria))} · Existencia: <strong class="${a.existencia > 0 ? 'mint-text' : 'orange-text'}">${numero(a.existencia)} ${esc(a.unidad)}</strong></p>
        ${a.avisos.length ? `<ul class="avisos">${a.avisos.map((x) => `<li class="${x.prioridad === 'alta' ? 'orange-text' : 'violet-text'}">${esc(x.mensaje)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>`;
  $form.hidden = false;
  const fraccion = clase === 'material' && item.unidad !== 'pza';
  $form.cantidad.min = fraccion ? '0.01' : '1';
  $form.cantidad.step = fraccion ? 'any' : '1';
  $form.cantidad.value = 1;
  $form.unidad.value = clase === 'material' ? item.unidad : 'unidades';
  $form.querySelector('.form-error').hidden = true;
  pintarExtras();
}

function pintarExtras() {
  if (!actual || !motivos) return;
  const { clase, item } = actual;
  const esMat = clase === 'material';
  const tipo = $form.tipo.value;
  const lista = motivos[clase][tipo];
  const previo = $form.motivo.value;
  $form.motivo.innerHTML = lista.map((m) => `<option value="${m}">${esc(et(m))}</option>`).join('');
  if (lista.includes(previo)) $form.motivo.value = previo;
  const motivo = $form.motivo.value;

  const campo = (name, label, attrs = '') => `<label>${label}<input name="${name}" ${attrs}></label>`;
  let html = '';
  if (tipo === 'SALIDA') {
    html += campo(esMat ? 'solicitante' : 'persona', 'Quién recibe', 'required maxlength="100" placeholder="Nombre de quien se lo lleva"');
    if (!esMat && motivo === 'PRESTAMO') html += campo('devolucion_esperada', 'Devolución esperada', 'type="datetime-local"');
  } else {
    if (['COMPRA', 'DONACION'].includes(motivo)) {
      html += campo('proveedor', motivo === 'DONACION' ? 'Donante' : 'Proveedor', 'maxlength="120"');
      html += campo('factura', 'Factura', 'maxlength="40"');
    }
    if (esMat && item.tipo === 'REACTIVO' && ['COMPRA', 'DONACION'].includes(motivo)) {
      html += campo('lote', 'Lote', 'maxlength="40"');
      html += campo('fecha_caducidad', 'Caducidad del lote', 'type="date"');
    }
    if (!esMat && motivo === 'DEVOLUCION_PRESTAMO') html += campo('persona', 'Quién devuelve', 'maxlength="100"');
  }
  if (!esMat) {
    html += `<label>Condición del equipo<select name="condicion"><option value="">Sin especificar</option>${motivos.condiciones.map((c) => `<option value="${c}">${et(c)}</option>`).join('')}</select></label>`;
  }
  // Conserva lo que ya se escribió al cambiar tipo o motivo
  const $extras = document.getElementById('extras');
  const previos = Object.fromEntries([...$extras.querySelectorAll('[name]')].map((el) => [el.name, el.value]));
  $extras.innerHTML = html;
  for (const [k, val] of Object.entries(previos)) {
    const el = $extras.querySelector(`[name="${k}"]`);
    if (el && val) el.value = val;
  }
}

async function registrar(e) {
  e.preventDefault();
  if (!actual) return;
  const $err = $form.querySelector('.form-error');
  $err.hidden = true;
  const { clase, item } = actual;
  const datos = Object.fromEntries(new FormData($form));
  delete datos.unidad;
  datos.cantidad = Number(datos.cantidad);
  datos[clase === 'material' ? 'material_id' : 'equipo_id'] = item.id;
  const btn = $form.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const r = await api(`/movimientos/${clase === 'material' ? 'materiales' : 'equipos'}`, { method: 'POST', body: datos });
    toast(`${et(datos.tipo)} registrada: ${numero(datos.cantidad)} · ${item.nombre}`);
    actual = { clase, item: clase === 'material' ? r.material : r.equipo };
    $form.reset();
    pintarArticulo();
    document.querySelector('.articulo-escaneado')?.classList.add('destello'); // resalta la existencia actualizada
    $codigo.value = '';
    $codigo.focus();
    refrescar();
  } catch (err) {
    $err.textContent = err.message;
    $err.hidden = false;
  } finally {
    btn.disabled = false;
  }
}
