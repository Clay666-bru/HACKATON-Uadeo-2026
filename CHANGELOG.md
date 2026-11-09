# Control de versiones

Registro de cambios de **LabControl · Gestión Integral de Laboratorio Biomédico (UAdeO)**.

## Cómo versionamos

Usamos números `MAYOR.MENOR.PARCHE`, alineados con los niveles del hackatón:

| Parte | Cuándo sube | Ejemplo |
|---|---|---|
| **MAYOR** | Empieza un nivel nuevo del proyecto o cambia algo que obliga a todos a actualizar (base de datos, inicio de sesión) | `1.x` → `2.0.0` |
| **MENOR** | Se agrega una función o pantalla nueva | `2.0.0` → `2.1.0` |
| **PARCHE** | Se corrige un error sin agregar funciones | `2.1.0` → `2.1.1` |

Cada versión tiene una **etiqueta en git** (`v2.1.0`) que apunta a su commit, así cualquiera puede volver a ella:

```bash
git checkout v1.0.0
```

### Al publicar una versión nueva
1. Pasa los cambios de **Sin publicar** a una sección con el número nuevo y la fecha.
2. Cambia `"version"` en `back/package.json` (la API la muestra en `/api/health`).
3. Haz commit, crea la etiqueta y súbela:
   ```bash
   git tag -a v2.4.0 -m "v2.4.0: descripción corta"
   git push origin main --tags
   ```

Las ramas de trabajo (como `frontend/tema-claro`) se fusionan en `main`. Solo se etiqueta lo que está en `main`.

---

## [Sin publicar]

Aún no hay cambios.

## [2.4.0] · 2026-11-08 · Cámara QR en teléfonos, nueva cuenta y letra más grande

### Agregado
- **Cámara en el teléfono:** el servidor atiende HTTPS en el mismo puerto si existe `back/certs` (`npm run certificado`). Desde otro dispositivo, `http` redirige a `https`; los navegadores solo permiten la cámara en páginas seguras.
- **Leer QR desde una foto:** si la página no es segura, el botón pasa a «Tomar foto del QR» y lee el código de la imagen.

### Cambiado
- «Nueva cuenta» en Usuarios y catálogos solo crea alumnos y profesores; los laboratoristas tienen su propio apartado.
- Letra más grande en Inventario y en el historial de Prácticas para todos los roles.

### Corregido
- El lector de QR no mostraba el video de la cámara (medía 0 px): ahora se ve, queda centrado en pantalla y el recuadro se ajusta al tamaño del teléfono.

## [2.3.0] · 2026-11-08 · Menú por categorías, laboratoristas, avatar de coordinación y avatar en celular

### Agregado
- **Avatar exclusivo de Coordinación** (`assets/avatares/coordinacion.svg`): un matraz con burbujas y una corona dorada sobre un fondo de carnaval animado, con serpentinas y confeti. Es fijo y no se puede cambiar.
- **Tarjeta de perfil de Coordinación:** al pasar el mouse o poner el foco en el avatar (arriba o en la barra lateral) se abre una ventana pequeña. Muestra el avatar en grande, el nombre, el usuario, el inicio de sesión, la fecha de la cuenta y las cifras de solicitudes por autorizar, alumnos y personal, que llevan a su sección. Se cierra al salir con el mouse o con Esc.
- `/api/auth/yo` devuelve también `ultimo_acceso` y `creado`.
- **Laboratoristas** (coordinación, en Administración):
  - Alta con contraseña temporal opcional, edición del nombre, restablecer contraseña y activar o desactivar.
  - Actividad de cada uno: movimientos, prácticas confirmadas, vales, batas y bitácoras.
  - Rutas nuevas: `GET /api/escolar/laboratoristas` y `POST /api/escolar/usuarios/:id/password`. `PATCH /api/escolar/usuarios/:id` ahora también cambia el nombre.

### Cambiado
- **Menú por categorías desplegables:** Inventario y almacén, Prácticas, Alumnos (o Mi grupo) y Administración.
  - La categoría de la página actual se abre sola y se recuerda cuáles abriste.
  - Si a un rol solo le toca una opción, aparece suelta.
  - En celular el menú es una tira sin categorías.
- "Vista general" ahora se llama **Inicio**, y el encabezado de todas las páginas, incluido el login, dice **Ciencias Biomédicas**.
- En Inicio se quitó el título «En el radar»; el panel ahora se llama **Lo que importa ahora**.
- **Avatar visible en celular y tableta:** el diseño lo ocultaba en pantallas de 1000 px o menos.
  - Ahora aparece en la barra superior y, al tocarlo, abre una tarjeta de perfil para todos los roles.
  - La tarjeta tiene datos, puntos o equipo según el rol, y **Cerrar sesión**, que antes no existía en celular.
  - En escritorio todo sigue igual.
  - En celular se oculta la etiqueta "Datos en vivo" para dejar espacio.
- **Inicio de sesión solo con usuario y contraseña:** se quitaron los botones de rol y cada quien entra a su espacio según su cuenta.

## [2.2.0] · 2026-11-08 · Pantallas del Nivel 2 por rol, carga de alumnos desde Excel y semestre

### Agregado
- **Pantallas del Nivel 2 para cada rol**, conectadas al backend:
  - **Profesor:**
    - Solicitar laboratorio: horarios libres, materiales por equipo y ventana del reglamento con casilla de aceptación.
    - Mis prácticas, con cancelar y subir fotos.
    - Mis grupos y equipos: alta de alumnos; crear, renombrar y borrar equipos; añadir y quitar integrantes.
    - Calendario.
  - **Coordinación:**
    - Autorizar solicitudes (paso 1), vales, batas, grupos y equipos.
    - Resúmenes y mantenimiento, con reportes que se ven en pantalla o se imprimen como PDF.
    - **Usuarios y catálogos:** cuentas del personal, grupos, materias y clases.
  - **Laboratorio:**
    - Confirmar solicitudes (paso 2), bitácora con incidente y fotos.
    - Vales de material: entregar, rechazar y recibir la devolución.
    - Renta de batas: aceptar, rechazar y recibir.
    - Semestre con cuenta regresiva.
  - **Alumno:** prácticas de su grupo con el vale de material de su equipo, renta de bata, mi equipo y buena conducta.
  - **Todos:** manuales, avisos (la campana) y "Roles y alcance".
- Tarjeta **Alumno** en el inicio de sesión.
- **Carga de alumnos desde Excel** (coordinación):
  - Se descarga una plantilla `.xlsx` con la lista de grupos e instrucciones, y se sube llena.
  - Se crean las cuentas fila por fila. Si el equipo indicado no existe, se crea.
  - Se informa qué filas fallaron y por qué.
  - Las contraseñas temporales se pueden descargar en un CSV.
- Coordinación crea cuentas de **alumno** (matrícula y grupo) desde "Nueva cuenta".
- Tarjetas de la Vista general: al pasar el mouse, su figura **se dibuja trazo por trazo y crece** hasta cubrir buena parte de la tarjeta, flotando detrás del texto. Si el sistema tiene activada la opción de reducir movimiento, solo aparece con un fundido.
- `docs/alumnos-prueba.xlsx`: ejemplo de la plantilla llena (12 alumnos en 2 grupos) usado en las pruebas.
- Botones **Finalizar ahora** y **Cancelar semestre** en Resúmenes y mantenimiento.
  - Finalizar: guarda el inventario final y avisa mantenimiento.
  - Cancelar: detiene la cuenta regresiva sin inventario final y queda como «Cancelado» en el historial.

### Cambiado
- **El profesor ya no registra alumnos**: solo coordinación da de alta y edita alumnos. El profesor los consulta y arma los equipos.
- Nueva dependencia `exceljs` en el backend, con `uuid` forzado a la versión corregida, y nuevo estado `CANCELADO` en `semestres`. Hay que volver a ejecutar `docs/nivel2.sql` y `npm install`.
- El menú lateral se arma según el rol: **cada quien solo ve sus módulos**, y si abre la dirección de uno que no le toca, regresa a su inicio.
- Coordinación también puede dar de alta artículos y registrar entradas y salidas.
- La campana muestra los avisos personales; las alertas de inventario quedan en "Alertas" (laboratorio y coordinación).
- Se quitó la vista previa `accesos.html`, que ahora es "Usuarios y catálogos".

## [2.1.0] · 2026-11-08 · Login con contraseña y avatares del profesor
Commit `ca6b232`.

### Agregado
- La página **Avatares** se conecta al contador de buena conducta. Muestra los puntos, el avance al siguiente nivel, el historial de puntos y los niveles bloqueados o desbloqueados, con el botón **"Usar como foto"**.
- El avatar elegido sustituye las iniciales en el perfil (barra lateral y superior).

### Cambiado
- **Profesor y coordinación ahora entran con usuario y contraseña.** Ya no se entra solo con el nombre.
- El login revisa que la cuenta corresponda al rol elegido.

### Para actualizar
- Cada profesor y coordinador necesita su cuenta: `npm run usuario:crear -- <usuario> <rol> "<Nombre>" <contraseña>`.

## [2.0.0] · 2026-11-08 · Nivel 2 (backend)
Commit `715133b`. Solo backend: el front todavía no tiene las pantallas.

### Agregado
- **Rol alumno.** Los profesores dan de alta a sus alumnos en sus grupos y los organizan en equipos de trabajo (crear, renombrar, borrar, añadir y quitar alumnos).
- **Solicitud de laboratorio:**
  - Con 7 días de anticipación, de lunes a viernes de 7:00 a 20:00 y sin empalmes.
  - Materiales por equipo y número de equipos.
  - Se acepta el reglamento antes de enviarla.
  - Doble autorización: primero el administrador, después el laboratorista.
- **Vales de material** por equipo de alumnos, con 3 días de anticipación:
  - La entrega descuenta el inventario.
  - El vale queda pendiente de devolución hasta que se recibe, y entonces se marca si hubo incidente.
- **Bitácora de prácticas** con anotaciones, incidente y fotos (JPG, PNG o WEBP).
- **Buena conducta:** +1 o −1 al profesor (bitácora) y a los alumnos (devolución del vale). Hay 5 avatares desbloqueables.
- **Renta de batas:**
  - Flujo: solicitud → aceptada o rechazada → en renta → concluida.
  - Cada renta guarda sus fechas.
- **Semestre:**
  - Al iniciarlo se guarda el inventario (`inventario_inicio`) y empieza la cuenta regresiva.
  - Al terminar se guarda `inventario_fin` y llega un aviso de limpieza y mantenimiento a administración y laboratorio.
- **Reportes del administrador:**
  - Batas por mes o semestre, inventario actual, entradas y salidas del semestre, y comparación inicio vs. fin.
  - Todos tienen versión imprimible para guardar como PDF.
- Notificaciones por usuario, lista de manuales (sin archivo todavía) y cambio de contraseña.
- El administrador puede usar todas las funciones del laboratorista.
- Bitácoras matutina y vespertina y reglamento en `docs/`.

### Para actualizar
- Ejecutar `docs/nivel2.sql` después de `usuarios.sql` (se puede repetir sin perder datos).
- Ejecutar `npm install` en `back/` (dependencia nueva: `multer`).

## [1.1.0] · 2026-11-08 · Tema claro y avatares (diseño)
Merge `8e75a8b` de la rama `frontend/tema-claro` (Alan Gaxiola).

### Agregado
- Versión clara del diseño y botón para cambiar entre colores oscuros y claros (se recuerda la elección).
- Vista general con el logo UAdeO y «Ciencias Biomédicas».
- Sección **Avatares** con los cinco niveles de clasificación (Aprendiz → Director de laboratorio).

## [1.0.0] · 2026-11-07 · Nivel 1 (control de inventario)
Commit `5f4c69a` «prototipo 1».

### Agregado
- API en Node.js + Express sobre MySQL/MariaDB (`docs/base de datos.sql`, `docs/usuarios.sql`).
- Inicio de sesión del laboratorista con contraseña cifrada (scrypt), token firmado y bloqueo tras 5 intentos.
- Inventario de materiales y equipos con estado y alertas (stock bajo, caducidad, mantenimiento).
- Alta, edición y baja de artículos, con código y QR automáticos.
- Entradas y salidas por **QR** (cámara, lector USB o código escrito), bitácora e historial.
- Etiquetas QR imprimibles.
- Front con el diseño UAdeO «Materia viva» y animaciones.

## [0.1.0] · 2026-11-06 · Inicio del proyecto
Commit `da307a5`. Repositorio creado.
