// Roles y alcance: matriz de módulos por rol, generada del mismo menú que usa la app
const ORDEN = ['alumno', 'profesor', 'laboratorio', 'administrador'];
document.getElementById('roles-cab').innerHTML = `<th>Módulo</th>${ORDEN.map((r) => `<th class="${r === rol ? 'tu-rol' : ''}">${esc(et(r))}${r === rol ? ' <small>(tú)</small>' : ''}</th>`).join('')}`;
document.getElementById('roles-cuerpo').innerHTML = MENU.map((m) => `<tr><td>${NAV_ICONOS[m.icono]} ${esc(typeof m.texto === 'function' ? m.texto('administrador') : m.texto)}</td>
  ${ORDEN.map((r) => `<td class="${r === rol ? 'tu-rol' : ''}">${m.roles.includes(r) ? '<span class="mint-text" aria-label="Sí">✓</span>' : '<span class="muted" aria-label="No">—</span>'}</td>`).join('')}</tr>`).join('');
