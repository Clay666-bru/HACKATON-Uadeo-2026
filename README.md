# LabControl · HACKATON_2026_CVFS

Página web para gestionar el uso de laboratorios, materiales y equipos.
Equipo de desarrollo para Hackatón 2026 LincesCode.

**Versión actual: 2.4.0** · historial de cambios en [CHANGELOG.md](CHANGELOG.md).

📘 **Documentación:** [guía general](docs/DOCUMENTACION.md) · [accesos, cuentas y contraseñas](docs/ACCESOS.md)

## Estado: Nivel 1 (control de inventario)

Hecho con la base de datos de [`docs/base de datos.sql`](docs/base%20de%20datos.sql) (`almacen_lab`), más la tabla de usuarios de [`docs/usuarios.sql`](docs/usuarios.sql).

| Función | Quién la usa |
|---|---|
| Inicio de sesión con usuario y contraseña para los 4 roles (administrador, laboratorio, profesor y alumno) | Todos |
| Panel con resumen y alertas (stock bajo, caducidad, mantenimiento vencido, equipos no operativos) | Todos |
| Inventario de materiales y equipos con su estado, búsqueda y filtros | Todos |
| **Alta, edición y baja** de materiales y equipos; al dar de alta se genera el código y su QR | Laboratorio |
| Registrar **entradas y salidas** escaneando el **QR** (cámara, lector USB o código escrito) | Laboratorio |
| Historial de movimientos | Administrador, Laboratorio |
| Etiquetas QR imprimibles para cada material y equipo | Administrador, Laboratorio |
| Laboratorios: fechas, solicitudes y autorización | Profesor, Administrador (pantalla preparada para el Nivel 2) |

Reglas que se respetan:
- La existencia solo cambia por movimientos. La actualizan los **triggers** del `.sql`. Editar un artículo no cambia su existencia.
- La existencia inicial de un artículo nuevo se registra como una **entrada (ajuste)**, así queda en el historial.
- No hay salidas mayores al stock, y solo se prestan equipos `OPERATIVO`. El trigger lo bloquea y la API responde `409` con el mensaje.
- Los motivos permitidos por tipo son los mismos que los `CHECK` de la base de datos.
- Dar de baja oculta el artículo del inventario (`activo = 0`), pero su historial se conserva.
- Cada movimiento guarda como `responsable` el nombre del laboratorista que inició sesión.

### Seguridad
- Contraseñas cifradas con `scrypt` (nunca en texto plano).
- Al entrar, el servidor entrega un token firmado (HMAC) que dura `SESION_HORAS`. Todo lo que modifica datos exige ese token y el rol laboratorio.
- Después de 5 intentos fallidos, ese usuario queda bloqueado 5 minutos.
- La sesión se guarda en `sessionStorage`: se cierra al cerrar la pestaña.

## Requisitos
- Node.js 18 o superior
- MySQL o MariaDB (XAMPP sirve)

## Cómo correrlo

1. Importa la base de datos, la tabla de usuarios y el Nivel 2 (en ese orden). Puedes usar phpMyAdmin o la terminal:
   ```bash
   mysql -uroot --default-character-set=utf8mb4 < "docs/base de datos.sql"
   ```
   ```bash
   mysql -uroot --default-character-set=utf8mb4 < docs/usuarios.sql
   ```
   ```bash
   mysql -uroot --default-character-set=utf8mb4 < docs/nivel2.sql
   ```
   `nivel2.sql` se puede volver a ejecutar sin perder datos.
2. Instala y configura el servidor:
   ```bash
   cd back
   npm install
   cp .env.example .env
   ```
   En `.env` ajusta el usuario y la contraseña de MySQL y pon un `SESSION_SECRET` largo y aleatorio.
3. Crea un usuario de laboratorio (mínimo 8 caracteres de contraseña):
   ```bash
   npm run usuario:crear -- laboratorio laboratorio "Nombre Completo" TuContraseñaSegura
   ```
   El formato es `<usuario> <rol> "<Nombre>" <contraseña>`. Si el usuario ya existe, se actualizan su nombre y contraseña.
4. Arranca el servidor:
   ```bash
   npm start
   ```
5. Abre http://localhost:3000. Para escanear con la cámara entra por `localhost` (o HTTPS). El navegador solo da acceso a la cámara en esos casos.

Prueba rápida: `http://localhost:3000/api/health` debe responder `"db": "conectada"`.

## Estructura
```
docs/base de datos.sql   Base de datos (tablas, datos de ejemplo y triggers)
docs/usuarios.sql        Tabla de usuarios para el login con contraseña
docs/nivel2.sql          Tablas del Nivel 2 (prácticas, alumnos, batas, conducta, semestres…)
back/                    API Node.js + Express (también sirve el front)
  src/server.js          Arranque y rutas
  src/db.js              Conexión a MySQL (mysql2)
  src/auth.js            Contraseñas, tokens y permisos por rol
  src/validacion.js      Validación de datos de entrada
  src/estado.js          Estados y alertas (stock, caducidad, mantenimiento)
  src/comun.js           Transacciones, avisos, conducta/avatares y fechas
  src/data/reglamento.json  Reglamento del laboratorio (para la ventana de aceptación)
  src/routes/            auth · inventario · articulos · movimientos (Nivel 1)
                         escolar · practicas · vales · batas · conducta · semestres
                         reportes · manuales · notificaciones (Nivel 2)
  uploads/practicas/     Fotos subidas (no se versiona)
  scripts/crear-usuario.js
front/                   Diseño UAdeO «Materia viva» (HTML, CSS y JS sin compilación)
  login.html             Inicio de sesión
  index.html             Vista general (indicadores, últimos movimientos, alertas)
  inventario.html        Inventario, fichas, alta y edición
  movimientos.html       Entradas y salidas con QR, bitácora e historial
  alertas.html           Alertas en vivo
  etiquetas.html         Etiquetas QR imprimibles
  practicas.html, nueva-practica.html, calendario.html, accesos.html, roles.html
                         Vista previa del Nivel 2 (datos de ejemplo, sin conexión)
  assets/interface.css   Estilos del diseño original (tokens y componentes)
  assets/app.css         Estilos añadidos para la versión conectada
  assets/js/             api.js y comun.js (sesión, menú por rol) + un script por pantalla
```

## API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servidor y la BD |
| POST | `/api/auth/login` | `{ usuario, password }` → `{ token, usuario }` |
| GET | `/api/auth/yo` | Usuario de la sesión actual |
| GET | `/api/inventario/materiales?buscar=&tipo=` | Materiales con estado y avisos |
| GET | `/api/inventario/equipos?buscar=&estado=` | Equipos con estado y avisos |
| POST | `/api/inventario/materiales` | Alta de material (`stock_inicial` opcional) 🔒 |
| PUT | `/api/inventario/materiales/:id` | Editar material (no cambia existencia) 🔒 |
| POST | `/api/inventario/materiales/:id/baja` | Dar de baja 🔒 |
| POST | `/api/inventario/equipos` | Alta de equipo (`cantidad_inicial` opcional) 🔒 |
| PUT | `/api/inventario/equipos/:id` | Editar equipo 🔒 |
| POST | `/api/inventario/equipos/:id/baja` | Dar de baja 🔒 |
| GET | `/api/inventario/codigo/:codigo` | Busca el artículo leído del QR |
| GET | `/api/inventario/qr/:codigo` | Imagen PNG del QR |
| GET | `/api/inventario/alertas` | Alertas activas |
| GET | `/api/inventario/resumen` | Totales para el panel |
| GET | `/api/movimientos?clase=&tipo=&limite=` | Historial combinado |
| GET | `/api/movimientos/motivos` | Motivos válidos por tipo |
| POST | `/api/movimientos/materiales` | Entrada o salida de material 🔒 |
| POST | `/api/movimientos/equipos` | Entrada o salida de equipo 🔒 |

🔒 = requiere `Authorization: Bearer <token>` de un usuario con rol laboratorio. El front lo envía solo.

## Nivel 2 (backend listo, front pendiente)

Todas las funciones nuevas exigen **sesión con contraseña** (`Authorization: Bearer <token>`) para los 4 roles: alumno, profesor, laboratorio y administrador. La entrada "solo con el nombre" del front actual sigue sirviendo únicamente para consultar el inventario.

### Cuentas
- **Personal** (profesor, laboratorio, administrador): `npm run usuario:crear -- <usuario> <rol> "<Nombre>" <contraseña>` o `POST /api/escolar/usuarios` (admin).
- **Alumnos**: los da de alta coordinación, uno por uno o con un Excel (`POST /api/escolar/alumnos/importar`, con la plantilla de `/api/escolar/alumnos/plantilla`). Su usuario es la matrícula; si no se da contraseña, se genera una temporal que se muestra una sola vez. Cada quien la cambia con `POST /api/auth/password`.
- El admin asigna a cada profesor sus **clases** (grupo + materia). De ahí salen los desplegables de la solicitud, y solo puede administrar alumnos y equipos de esos grupos.

### Reglas
| Tema | Regla |
|---|---|
| Solicitud de laboratorio | Mínimo **7 días** antes, lunes a viernes, de 7:00 a 20:00, sin empalmarse con otra. Hay que mandar `acepta_reglamento: true` (la casilla de la ventana del reglamento). |
| Autorización | Primero el **administrador** y luego el **laboratorista**. Cada uno solo hace su paso. |
| Materiales | El profesor indica la cantidad **por equipo** y el número de equipos. Si hoy no alcanza el stock, la solicitud se guarda igual con `advertencias`. |
| Vale de alumnos | Un alumno acepta el formato por su equipo, mínimo **3 días** antes. Un vale por equipo, hasta el número de equipos de la práctica. |
| Entrega del vale | Registra las **salidas** de inventario (material: práctica; equipo: préstamo). Si falta stock, no se entrega nada (409). El vale queda **pendiente de devolución**. |
| Devolución del vale | Se marca si hubo incidente. Regresan los equipos y consumibles; los reactivos cuentan como usados, salvo que se indique `devoluciones`. **+1 / −1** a cada integrante del equipo. |
| Bitácora de práctica | El laboratorista (o admin) registra anotaciones e incidente, solo el día de la práctica o después y una sola vez. **+1 / −1** al profesor. |
| Avatares | 5 niveles: 0, 5, 10, 20 y 35 puntos. Solo se elige uno ya desbloqueado. |
| Batas | Una renta activa por alumno. Aceptar → `EN_RENTA`; recibirla → `CONCLUIDA`. Cada renta guarda sus fechas. |
| Doble atención | Si el laboratorista ya atendió una bata o un vale, el admin recibe `409` con el estado actual, y al revés. |
| Semestre | Al iniciarlo se copia el inventario en `inventario_inicio` y empieza la cuenta regresiva. Al terminar se copia en `inventario_fin` y llega un aviso de **limpieza y mantenimiento** a administradores y laboratoristas. Hay un solo semestre activo. |
| Reportes | Solo administrador. Agregando `?formato=html` sale una página imprimible: **Imprimir → Guardar como PDF**. |
| Fotos | JPG, PNG o WEBP de hasta 5 MB. Las suben el laboratorio, el profesor de la práctica y los alumnos del grupo. Se guardan con un nombre aleatorio en `back/uploads/practicas`. |

### API Nivel 2
| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/api/auth/yo` | Todos | Perfil: rol, puntos, avatar, grupo y equipo |
| POST | `/api/auth/password` | Todos | `{ actual, nueva }` |
| GET | `/api/escolar/grupos` · `/materias` | Todos | Catálogos |
| POST | `/api/escolar/grupos` · `/materias` · `/clases` | Admin | Altas de catálogo y clases (`profesor_id, grupo_id, materia_id`) |
| GET | `/api/escolar/clases` | Prof, Lab, Admin | El profesor ve solo las suyas |
| GET/POST/PATCH | `/api/escolar/usuarios[/:id]` | Admin | Cuentas del personal; `PATCH { activo }` |
| GET | `/api/escolar/grupos/:id/alumnos` | Prof, Lab, Admin | Alumnos con puntos y equipo |
| POST/PATCH | `/api/escolar/alumnos[/:id]` | Admin | Alta (`matricula, nombre, grupo_id, password?`) y cambio de nombre o grupo |
| GET | `/api/escolar/alumnos/plantilla` | Admin | Plantilla de Excel para la carga de alumnos |
| POST | `/api/escolar/alumnos/importar` | Admin | Sube el Excel (`multipart`, campo `archivo`) y crea las cuentas; responde `{ total, creados, errores }` |
| GET/POST | `/api/escolar/equipos-trabajo?grupo_id=` | Prof, Admin (Lab consulta) | Equipos con sus integrantes |
| PUT/DELETE | `/api/escolar/equipos-trabajo/:id` | Prof, Admin | Renombrar o borrar |
| POST/DELETE | `/api/escolar/equipos-trabajo/:id/alumnos[/:alumnoId]` | Prof, Admin | Añadir o quitar un alumno |
| GET | `/api/escolar/mi-equipo` | Alumno | Su equipo y compañeros |
| GET | `/api/practicas/disponibilidad?desde=&dias=` | Todos | Días hábiles, horarios ocupados y bloques libres |
| GET | `/api/practicas/reglamento` · `/reglamento/archivo` | Todos | Reglamento en JSON · descarga del .docx |
| GET | `/api/practicas?estado=&pendientes=1&desde=&hasta=` | Todos | Historial según rol, con artículos, bitácora, fotos y vales |
| GET | `/api/practicas/:id` | Con acceso | Detalle |
| POST | `/api/practicas` | Profesor | Solicitud (`grupo_id, materia_id, titulo, descripcion, fecha, hora_inicio, hora_fin, num_equipos, items[], acepta_reglamento`) |
| POST | `/api/practicas/:id/admin` | Admin | `{ decision: ACEPTAR\|RECHAZAR, comentario? }` |
| POST | `/api/practicas/:id/laboratorio` | Laboratorio | Igual, segundo paso |
| POST | `/api/practicas/:id/cancelar` | Profesor | Mientras no se haya entregado material |
| POST | `/api/practicas/:id/bitacora` | Lab, Admin | `{ anotaciones, hubo_incidente, descripcion_incidente }` |
| POST/DELETE | `/api/practicas/:id/fotos[/:fotoId]` | Con acceso | Subida `multipart/form-data`, campo `foto` (+ `descripcion`) |
| GET | `/api/vales?estado=&solicitud_id=` | Todos | Alumno: su equipo · Profesor: sus prácticas · Lab/Admin: todos |
| POST | `/api/vales` | Alumno | `{ solicitud_id }`: acepta el formato de materiales |
| POST | `/api/vales/:id/decision` | Lab, Admin | Aceptar (entrega) o rechazar |
| POST | `/api/vales/:id/devolucion` | Lab, Admin | `{ hubo_incidente, descripcion_incidente?, condicion?, devoluciones?: [{ item_id, cantidad_devuelta }] }` |
| GET/POST | `/api/batas` | Alumno (Lab, Admin consultan) | Solicitar `{ cantidad?, talla? }` |
| POST | `/api/batas/:id/decision` · `/concluir` | Lab, Admin | Aceptar o rechazar · recibir la bata |
| POST | `/api/batas/:id/cancelar` | Alumno | Mientras siga solicitada |
| GET | `/api/conducta` | Prof, Alumno | Puntos, avatares e historial de puntos |
| PUT | `/api/conducta/avatar` | Prof, Alumno | `{ nivel: 1-5 }` |
| GET | `/api/conducta/:usuarioId` | Lab, Admin | Contador de cualquier profesor o alumno |
| GET | `/api/semestres/actual` · `/api/semestres` | Lab, Admin | Semestre en curso con `segundos_restantes` |
| POST | `/api/semestres/iniciar` | Lab, Admin | `{ fin: YYYY-MM-DD, nombre? }` |
| POST | `/api/semestres/:id/finalizar` | Lab, Admin | Termina hoy: inventario final y aviso de mantenimiento |
| POST | `/api/semestres/:id/cancelar` | Lab, Admin | Detiene la cuenta regresiva sin inventario final (queda como cancelado) |
| GET | `/api/reportes/batas?mes=YYYY-MM \| semestre_id=` | Admin | Batas rentadas por mes |
| GET | `/api/reportes/inventario` | Admin | Inventario actual |
| GET | `/api/reportes/movimientos?tipo=ENTRADA\|SALIDA&semestre_id=` | Admin | Entradas o salidas del semestre |
| GET | `/api/reportes/comparacion?semestre_id=` | Admin | Inventario inicial vs final |
| GET | `/api/manuales` | Todos | Lista de manuales (`url: null` hasta que se suban) |
| GET | `/api/notificaciones` · POST `/leidas` · POST `/:id/leida` | Todos | Avisos |

El administrador también puede usar las rutas 🔒 de inventario y movimientos del Nivel 1.
