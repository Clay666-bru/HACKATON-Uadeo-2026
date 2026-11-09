# UAdeO · Materia viva

Rediseño de Gestión Integral de Laboratorio Biomédico para LinceCode 2026. Nueve pantallas con HTML y CSS; sin JavaScript, frameworks, compilación ni backend.

## Abrir el proyecto

Abre `index.html` directamente en Edge, Chrome o Firefox. Las fuentes y el logo están incluidos; la interfaz no solicita recursos externos.

Para verlo con un servidor local, abre una terminal en esta carpeta y ejecuta:

```powershell
python -m http.server 8877 --bind 127.0.0.1
```

Después visita http://127.0.0.1:8877. Si ese puerto ya está en uso por la vista previa, abre esa dirección o elige otro puerto. No necesitas Node.js ni instalar paquetes.

## Dirección de diseño

«Materia viva»: oscuridad de escenario, luz roja y coral, una pieza orgánica construida en CSS y vidrio esmerilado en capas. Space Grotesk aporta precisión al espacio operativo; Instrument Serif introduce el gesto editorial. Las dos fuentes están alojadas localmente con sus licencias OFL.

La marca UAdeO conserva sus píxeles, proporciones y colores; se muestra sobre una tarjeta marfil en navegación y pie de página. `assets/brand/uadeo-original.png` conserva el archivo recibido y `uadeo.png` es su compresión PNG sin cambios visuales.

Paleta: fondo #101014, texto #FFF4ED, rojo #FA534B, coral #FF886B, cian #A2E0DB y ámbar #F4D491. Colores, espaciado, radios y sombras se definen al principio de `assets/interface.css`.

**Colores claros:** el botón de sol/luna de la barra superior (y el botón flotante del inicio de sesión) cambia a una versión clara de la misma identidad. Se guarda en el navegador y se aplica antes de pintar (`assets/js/tema.js`). Los estilos claros están en `assets/tema-claro.css` y el botón en `assets/tema-boton.css`.

## Estructura

- `index.html`: resumen de coordinación.
- `inventario.html`: categorías, fichas y alta de material.
- `movimientos.html`: captura exploratoria y bitácora.
- `practicas.html`: solicitudes y viabilidad ilustrativa.
- `nueva-practica.html`: solicitud de docentes.
- `calendario.html`: semana de ejemplo.
- `alertas.html`: stock, caducidad y mantenimiento.
- `accesos.html`: control de personas provisional, pendiente de validación.
- `roles.html`: responsabilidades y alcance.
- `assets/styles.css`: entrada de estilos.
- `assets/interface.css`: tokens, composición, componentes, movimiento y responsive.
- `assets/fonts/`: fuentes WOFF2 locales (115 KB en total), CSS y licencias.
- `assets/brand/`: logo original y PNG optimizado.
- `redisenio-*.png`: capturas actuales. Los archivos `vista-*.png` pertenecen a la prueba anterior y se conservan como referencia.

## Funcionalidad conservada

Se conserva el texto principal de todas las pantallas, anclas, datos de ejemplo, navegación, filtros CSS y desplegables nativos. Los campos son explorables; los siete botones de guardado/aprobación siguen deshabilitados. No hay autenticación, persistencia, cámara, lectura QR real ni reservas efectivas. El equipo Node.js podrá conectar estas vistas sin cambiar los nombres de campos.

## Accesibilidad y movimiento

Enlace de salto, foco visible, controles etiquetados, regiones de tablas desplazables, estados expresados también con palabras y objetivos principales de 44 px. Los eventos del calendario anuncian día, hora y estado mediante etiquetas accesibles. `prefers-reduced-motion` desactiva el movimiento; los efectos de entrada al hacer scroll son progresivos y se omiten donde no se admiten. Si no existe `backdrop-filter`, se usan superficies sólidas.

Validación realizada en Chromium: 72 combinaciones de pantalla/tamaño (320, 390, 600, 768, 1000, 1024, 1440 y 1920 px), filtros y desplegables por teclado, salto al contenido, imágenes, carga local y alternativa sin blur. Auditoría de 236 referencias locales y comparación del texto contra el respaldo. Contraste calculado en 825 fragmentos de texto con fondos compuestos: sin incidencias en la comprobación; no equivale a una certificación WCAG ni a una revisión completa con lector de pantalla o de todos los navegadores. El vidrio y los gradientes también se revisaron visualmente.

## Git y recuperación

Repositorio inicializado en esta carpeta. Rama de trabajo: `frontend/identidad-uadeo`. Respaldo anterior al rediseño: commit `0fca2d0`. No hay rama main ni remoto configurado; no se hizo push ni merge. El ZIP de entrega no incluye el historial Git; estas instrucciones se aplican a la carpeta de trabajo original.

Para consultar la versión anterior sin perder el rediseño, con el árbol de trabajo limpio puedes crear otra rama desde el respaldo:

```powershell
git switch -c vista-anterior 0fca2d0
```

Vuelve al rediseño con `git switch frontend/identidad-uadeo`. Conserva cualquier edición posterior antes de cambiar de rama.
