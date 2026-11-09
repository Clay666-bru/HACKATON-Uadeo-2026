// Laboratoristas (solo coordinación): alta, edición, contraseña, activar/desactivar y actividad
let labs = [];

// Contraseña temporal generada en el navegador cuando no se escribe una
function temporal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const v = crypto.getRandomValues(new Uint32Array(8));
  return 'Lab-' + [...v].map((n) => letras[n % letras.length]).join('');
}

function mostrarClave(titulo, usuario, clave, nota) {
  abrirDialogo(`<p class="eyebrow">LABORATORISTA</p><h2>${esc(titulo)}</h2>
    <dl class="credenciales"><div><dt>Usuario</dt><dd><code>${esc(usuario)}</code></dd></div>
    <div><dt>Contraseña</dt><dd><code>${esc(clave)}</code></dd></div></dl>
    <p class="muted">${esc(nota)}</p>
    <div class="modal-acciones"><span class="espacio"></span><button class="button primary" type="button" data-cerrar>Listo</button></div>`, 'modal-chico');
}

function tarjeta(l) {
  const cifras = [['Movimientos', l.movimientos], ['Prácticas confirmadas', l.practicas], ['Vales atendidos', l.vales], ['Batas atendidas', l.batas], ['Bitácoras', l.bitacoras]];
  return `<article class="panel lab-card${l.activo ? '' : ' inactivo'}">
    <div class="lab-cabeza">
      <span class="avatar lab-avatar">${esc(iniciales(l.nombre))}</span>
      <div><h3>${esc(l.nombre)}</h3><p class="muted"><code>${esc(l.usuario)}</code></p></div>
      ${l.activo ? '<span class="badge mint">Activo</span>' : '<span class="badge orange">Inactivo</span>'}
    </div>
    <dl class="lab-fechas">
      <div><dt>Último acceso</dt><dd>${l.ultimo_acceso ? fechaCorta(l.ultimo_acceso, true) : 'Nunca'}</dd></div>
      <div><dt>Cuenta desde</dt><dd>${fechaCorta(l.creado)}</dd></div>
    </dl>
    <ul class="lab-cifras">${cifras.map(([t, n]) => `<li><b>${numero(n)}</b>${esc(t)}</li>`).join('')}</ul>
    <div class="lab-acciones">
      <button class="button" type="button" data-editar="${l.id}">Editar nombre</button>
      <button class="button" type="button" data-clave="${l.id}">Restablecer contraseña</button>
      <button class="button ${l.activo ? 'peligro' : 'primary'}" type="button" data-activo="${l.id}:${l.activo ? 0 : 1}">${l.activo ? 'Desactivar' : 'Activar'}</button>
    </div>
  </article>`;
}

async function cargar() {
  labs = await api('/escolar/laboratoristas');
  document.getElementById('n-labs').textContent = `${labs.filter((l) => l.activo).length} activo(s)`;
  const $l = document.getElementById('laboratoristas');
  $l.innerHTML = labs.length ? labs.map(tarjeta).join('') : vacio('Aún no hay laboratoristas. Agrega el primero arriba.');
  animarHijos($l);
}

document.getElementById('form-lab').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const $err = f.querySelector('.form-error');
  $err.hidden = true;
  const generada = !f.password.value;
  const clave = f.password.value || temporal();
  try {
    const r = await api('/escolar/usuarios', { method: 'POST', body: { usuario: f.usuario.value, nombre: f.nombre.value, rol: 'LABORATORIO', password: clave } });
    f.reset();
    await cargar();
    if (generada) mostrarClave(r.nombre, r.usuario, clave, 'Contraseña temporal: compártela con el laboratorista; solo se muestra esta vez.');
    else toast(`Laboratorista ${r.nombre} agregado`);
  } catch (er) { $err.textContent = er.message; $err.hidden = false; }
});

document.getElementById('laboratoristas').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.editar) {
      const l = labs.find((x) => x.id === Number(b.dataset.editar));
      const r = await preguntar({ titulo: 'Editar nombre', texto: `Usuario: ${l.usuario}`, boton: 'Guardar', campo: 'Nombre completo' });
      if (!r.ok || !r.valor) return;
      await api(`/escolar/usuarios/${l.id}`, { method: 'PATCH', body: { nombre: r.valor } });
      toast('Nombre actualizado');
    } else if (b.dataset.clave) {
      const l = labs.find((x) => x.id === Number(b.dataset.clave));
      const r = await preguntar({ titulo: 'Restablecer contraseña', texto: `Se generará una contraseña temporal nueva para ${l.nombre}. La anterior dejará de funcionar.`, boton: 'Restablecer' });
      if (!r.ok) return;
      const x = await api(`/escolar/usuarios/${l.id}/password`, { method: 'POST' });
      mostrarClave(l.nombre, l.usuario, x.password_temporal, 'Compártela con el laboratorista; solo se muestra esta vez.');
    } else if (b.dataset.activo) {
      const [id, activo] = b.dataset.activo.split(':').map(Number);
      const l = labs.find((x) => x.id === id);
      if (!activo) {
        const r = await preguntar({ titulo: `Desactivar a ${l.nombre}`, texto: 'Ya no podrá iniciar sesión. Su historial se conserva y puedes activarlo de nuevo.', boton: 'Desactivar', peligro: true });
        if (!r.ok) return;
      }
      await api(`/escolar/usuarios/${id}`, { method: 'PATCH', body: { activo: !!activo } });
      toast(activo ? 'Laboratorista activado' : 'Laboratorista desactivado');
    } else return;
    await cargar();
  } catch (er) { toast(er.message, 'error'); }
});

cargar().catch((e) => { document.getElementById('laboratoristas').innerHTML = vacio(e.message); });
