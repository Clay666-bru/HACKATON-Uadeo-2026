// Calendario de disponibilidad del laboratorio (dos semanas por vista)
const DIAS = 14;
const sumar = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Empieza en el lunes de esta semana
let desde = (() => { const d = new Date(`${hoyISO()}T00:00:00`); const dia = d.getDay() || 7; return sumar(hoyISO(), 1 - dia); })();

async function cargar() {
  const $d = document.getElementById('dias');
  try {
    const r = await api(`/practicas/disponibilidad?desde=${desde}&dias=${DIAS}`);
    document.getElementById('rango').textContent = `${fechaCorta(r.desde)} – ${fechaCorta(r.hasta)}`;
    $d.innerHTML = r.dias.map((d) => {
      const pasado = d.fecha < hoyISO();
      const nombre = new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
      return `<article class="panel dia${pasado ? ' pasado' : ''}${d.fecha === hoyISO() ? ' hoy' : ''}">
        <h3>${esc(nombre)}</h3>
        <div class="bloques-lista">${d.bloques.map((b) => {
          const ocupacion = d.ocupado.find((o) => o.hora_inicio < b.hora_fin && o.hora_fin > b.hora_inicio);
          const clase = !b.libre ? 'ocupado' : d.solicitable ? 'libre' : 'bloqueado';
          const detalle = ocupacion ? `${esc(ocupacion.grupo)} · ${esc(et(ocupacion.estado))}` : b.libre ? (d.solicitable ? 'Libre' : 'Sin anticipación') : 'Ocupado';
          const puede = rol === 'profesor' && clase === 'libre';
          return puede
            ? `<a class="bloque libre" href="nueva-practica.html?fecha=${d.fecha}&ini=${b.hora_inicio}&fin=${b.hora_fin}">${b.hora_inicio}–${b.hora_fin}<small>Solicitar ↗</small></a>`
            : `<span class="bloque ${clase}" title="${detalle}">${b.hora_inicio}–${b.hora_fin}<small>${detalle}</small></span>`;
        }).join('')}</div>
        ${d.ocupado.filter((o) => !d.bloques.some((b) => b.hora_inicio === o.hora_inicio && b.hora_fin === o.hora_fin)).map((o) => `<p class="nota">Apartado ${o.hora_inicio}–${o.hora_fin} · ${esc(o.grupo)}</p>`).join('')}
      </article>`;
    }).join('');
    animarHijos($d);
  } catch (e) { $d.innerHTML = vacio('No se pudo cargar el calendario: ' + e.message); }
}
document.getElementById('ant').addEventListener('click', () => { desde = sumar(desde, -DIAS); cargar(); });
document.getElementById('sig').addEventListener('click', () => { desde = sumar(desde, DIAS); cargar(); });
cargar();
