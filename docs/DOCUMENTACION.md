# LabControl UAdeO · Documentación general

Sistema web para gestionar el **Laboratorio Biomédico** de la UAdeO: inventario con QR, entradas y salidas, solicitudes de prácticas, vales de material, renta de batas, alumnos y equipos, puntos de buena conducta, semestres y reportes.

- Versión: **2.4.0** (ver [`CHANGELOG.md`](../CHANGELOG.md))
- Repositorio: https://github.com/Clay666-bru/HACKATON-Uadeo-2026
- Accesos, cuentas y contraseñas: [`docs/ACCESOS.md`](ACCESOS.md)
- Referencia completa de la API: [`README.md`](../README.md#api)

---

## 1. Cómo está hecho

| Parte | Tecnología | Carpeta |
|---|---|---|
| Base de datos | MySQL / MariaDB (XAMPP) · base `almacen_lab` | `docs/*.sql` |
| Servidor (API) | Node.js 18+ con Express 5, `mysql2`, `qrcode`, `exceljs`, `multer` | `back/` |
| Páginas | HTML, CSS y JavaScript sin compilar (el servidor las sirve) | `front/` |

Una sola dirección sirve todo: **http://localhost:3000** (páginas) y **http://localhost:3000/api/...** (API).

```
Navegador ──► Express (back/src/server.js) ──► MySQL almacen_lab
              ├─ /            → archivos de front/
              ├─ /api/...     → back/src/routes/*.js
              └─ /api/fotos   → back/uploads/practicas
```

Las existencias **nunca se editan directo**: solo cambian con movimientos (entradas y salidas), y los *triggers* de la base de datos actualizan el stock y bloquean salidas mayores a lo disponible.

---

## 2. Instalación (primera vez, Windows + XAMPP)

Requisitos: **Node.js 18 o superior** y **XAMPP** (MariaDB).

1. **Encender MySQL.** Abre el *XAMPP Control Panel* y pulsa **Start** en *MySQL*.
2. **Crear la base de datos.** Desde la carpeta del proyecto, en Git Bash, en este orden:
   ```bash
   /c/xampp/mysql/bin/mysql.exe -uroot --default-character-set=utf8mb4 < "docs/base de datos.sql"
   ```
   ```bash
   /c/xampp/mysql/bin/mysql.exe -uroot --default-character-set=utf8mb4 < docs/usuarios.sql
   ```
   ```bash
   /c/xampp/mysql/bin/mysql.exe -uroot --default-character-set=utf8mb4 < docs/nivel2.sql
   ```
   También sirve phpMyAdmin (*Importar*). ⚠️ `base de datos.sql` **borra y recrea** las tablas del inventario; úsalo solo en una instalación nueva. `usuarios.sql` y `nivel2.sql` se pueden repetir sin perder datos.
3. **Instalar el servidor:**
   ```bash
   cd back
   ```
   ```bash
   npm install
   ```
   ```bash
   cp .env.example .env
   ```
4. **Configurar `back/.env`** (ver sección 4). Como mínimo, pon un `SESSION_SECRET` aleatorio:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. **Crear la primera cuenta** (ver [`ACCESOS.md`](ACCESOS.md)):
   ```bash
   npm run usuario:crear -- admin administrador "Coordinación" ContraseñaSegura123
   ```
6. **Arrancar:** `npm start` y abrir http://localhost:3000.

Comprobación: http://localhost:3000/api/health debe responder `"db": "conectada"`.

## 3. Uso diario (arrancar y apagar)

1. XAMPP → **Start** en MySQL.
2. En `back/`:
   ```bash
   npm start
   ```
   Para desarrollo (se reinicia al guardar cambios): `npm run dev`.
3. Abrir http://localhost:3000.

Para apagar: `Ctrl + C` en la terminal del servidor y **Stop** en XAMPP.

## 4. Configuración (`back/.env`)

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `SESSION_SECRET` | Firma las sesiones. Si falta, se genera uno temporal y todas las sesiones se pierden al reiniciar | — |
| `SESION_HORAS` | Cuánto dura una sesión | `10` |
| `DB_HOST` / `DB_PORT` | Servidor MySQL | `localhost` / `3306` |
| `DB_USER` / `DB_PASSWORD` | Usuario de MySQL (XAMPP: `root` sin contraseña) | `root` / vacío |
| `DB_NAME` | Base de datos | `almacen_lab` |
| `DIAS_AVISO_CADUCIDAD` | Días antes de caducar para avisar | `30` |
| `DIAS_AVISO_MANTENIMIENTO` | Días antes del mantenimiento para avisar | `15` |

`.env` **no se sube a GitHub** (está en `.gitignore`).

## 5. Usar la cámara desde el teléfono (HTTPS)

Los navegadores solo permiten la cámara en `localhost` o en HTTPS. Para escanear QR con el celular:

1. En `back/`, desde Git Bash: `npm run certificado` (crea `back/certs/`).
2. Reinicia el servidor. El mismo puerto atiende http y https.
3. Con el teléfono en la misma red (o en la zona con cobertura de Windows), abre `https://<ip-de-la-computadora>:3000` y acepta el aviso del certificado una vez.

---

## 6. Roles y qué puede hacer cada uno

| Rol | Quién es | Página de inicio |
|---|---|---|
| **Administrador** (coordinación) | Coordina el laboratorio. Puede todo lo del laboratorista más usuarios, catálogos, autorizaciones y reportes | `index.html` |
| **Laboratorio** | Laboratorista. Maneja inventario, movimientos, vales, batas y semestres | `index.html` |
| **Profesor** | Solicita el laboratorio para sus prácticas y organiza sus grupos | `index.html` |
| **Alumno** | Acepta vales de su equipo, renta batas y ve las prácticas de su grupo | `practicas.html` |

### Páginas por rol

| Página | Módulo | Admin | Lab | Profesor | Alumno |
|---|---|:-:|:-:|:-:|:-:|
| `index.html` | Inicio (indicadores, últimos movimientos, alertas) | ✅ | ✅ | ✅ | |
| `inventario.html` | Inventario, fichas, alta/edición/baja | ✅ | ✅ | 👁️ | |
| `movimientos.html` | Entradas y salidas con QR, bitácora | ✅ | ✅ | | |
| `etiquetas.html` | Etiquetas QR imprimibles | ✅ | ✅ | | |
| `alertas.html` | Stock bajo, caducidad, mantenimiento | ✅ | ✅ | | |
| `practicas.html` | Solicitudes y prácticas | ✅ | ✅ | ✅ (las suyas) | ✅ (su grupo) |
| `nueva-practica.html` | Solicitar laboratorio | | | ✅ | |
| `calendario.html` | Calendario del laboratorio | ✅ | ✅ | ✅ | |
| `vales.html` | Vales de material | ✅ | ✅ | | |
| `grupos.html` | Grupos y equipos de trabajo | ✅ | | ✅ (sus grupos) | |
| `mi-equipo.html` | Mi equipo | | | | ✅ |
| `batas.html` | Renta de batas | ✅ | ✅ | | ✅ |
| `avatares.html` | Buena conducta y avatares | | | ✅ | ✅ |
| `laboratoristas.html` | Laboratoristas | ✅ | | | |
| `escuela.html` | Usuarios y catálogos | ✅ | | | |
| `semestre.html` | Resúmenes, semestre y mantenimiento | ✅ | ✅ | | |
| `manuales.html` | Manuales | ✅ | ✅ | ✅ | ✅ |
| `avisos.html`, `roles.html` | Avisos · Roles y alcance | ✅ | ✅ | ✅ | ✅ |

👁️ = solo consulta. Si alguien abre una página que no le toca, vuelve a su inicio. Además, **la API revisa el rol en cada petición**, así que ocultar el menú no es la única protección.

---

## 7. Flujos principales

### Inventario (Laboratorio / Admin)
1. **Alta** en *Inventario*: el sistema asigna el código (`MAT-001`, `EQP-001`…) y su QR. La existencia inicial se guarda como una **entrada de ajuste**.
2. **Entradas y salidas** en *Entradas y salidas*: escanea el QR (cámara, lector USB o escribiendo el código), elige tipo y motivo.
   - Material: entrada por compra, donación, devolución o ajuste; salida por práctica, caducidad, daño o ajuste.
   - Equipo: entrada por compra, donación, devolución de préstamo, regreso de mantenimiento o ajuste; salida por préstamo, mantenimiento, baja o ajuste. Solo se prestan equipos `OPERATIVO`.
   - Si no alcanza el stock, se rechaza con *STOCK INSUFICIENTE*.
3. **Baja**: oculta el artículo, pero conserva su historial.
4. **Etiquetas QR**: imprime las etiquetas para pegarlas en los frascos y equipos.

### Práctica de laboratorio
1. **Profesor** → *Solicitar laboratorio*: grupo, materia, fecha (mínimo **7 días** antes, lunes a viernes, 7:00–20:00, sin empalmarse), materiales **por equipo** y acepta el reglamento.
2. **Administrador** autoriza o rechaza (primer paso).
3. **Laboratorio** autoriza o rechaza (segundo paso).
4. **Alumno** acepta el **vale** de su equipo (mínimo **3 días** antes).
5. **Laboratorio** entrega el vale: se registran las salidas de inventario.
6. Al terminar, el **laboratorio** registra la **devolución** (con o sin incidente) y la **bitácora** de la práctica. Esto da **+1 o −1 punto** a los alumnos del equipo y al profesor.
7. Laboratorio, profesor y alumnos pueden subir **fotos** de la práctica (JPG, PNG o WEBP de hasta 5 MB).

### Batas
Alumno solicita → Laboratorio acepta (`EN_RENTA`) → la recibe de vuelta (`CONCLUIDA`). Una renta activa por alumno.

### Buena conducta
Los puntos desbloquean 5 avatares (0, 5, 10, 20 y 35 puntos). Profesores y alumnos eligen su foto en *Buena conducta*.

### Semestre
Al **iniciar** se guarda una foto del inventario y empieza la cuenta regresiva. Al **finalizar** se guarda el inventario final y llega un aviso de limpieza y mantenimiento. Los reportes (solo admin) comparan los dos inventarios y se imprimen como PDF con `?formato=html`.

---

## 8. Base de datos (`almacen_lab`)

| Tabla | Contenido |
|---|---|
| `materiales`, `equipos` | Catálogo con stock, estado, caducidad y mantenimiento |
| `movimientos_materiales`, `movimientos_equipos` | Historial de entradas y salidas (triggers actualizan el stock) |
| `usuarios` | Cuentas de los 4 roles (contraseña cifrada con scrypt), puntos y avatar |
| `alumnos`, `grupos`, `materias`, `clases`, `equipos_trabajo` | Estructura escolar |
| `solicitudes_lab`, `solicitud_lab_items` | Solicitudes de práctica y sus materiales |
| `practica_bitacora`, `practica_fotos` | Bitácora y fotos de cada práctica |
| `vales_material`, `vale_items` | Vales por equipo de alumnos |
| `rentas_batas` | Renta de batas |
| `conducta_eventos` | Historial de puntos +1 / −1 |
| `semestres`, `inventario_inicio`, `inventario_fin` | Semestres y sus fotos del inventario |
| `notificaciones`, `manuales` | Avisos internos y manuales |

Respaldo rápido:
```bash
/c/xampp/mysql/bin/mysqldump.exe -uroot almacen_lab > respaldo_almacen_lab.sql
```

## 9. Estructura de carpetas

```
back/
  src/server.js            Arranque, HTTP/HTTPS y rutas
  src/auth.js              Contraseñas, tokens y permisos por rol
  src/db.js                Conexión a MySQL
  src/validacion.js        Validación de datos
  src/estado.js            Estados y alertas (stock, caducidad, mantenimiento)
  src/comun.js             Transacciones, avisos, conducta y fechas
  src/routes/              Una ruta por módulo (inventario, practicas, vales, ...)
  scripts/crear-usuario.js     npm run usuario:crear
  scripts/crear-certificado.js npm run certificado
  uploads/                 Fotos subidas (no se sube a GitHub)
front/
  *.html                   Una página por módulo
  assets/js/api.js         Sesión y llamadas a la API
  assets/js/comun.js       Menú y permisos por rol
  assets/js/<pagina>.js    Lógica de cada página
docs/
  *.sql                    Base de datos
  DOCUMENTACION.md         Este documento
  ACCESOS.md               Cuentas, inicio de sesión y contraseñas
```

## 10. Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| `/api/health` dice `"db": "desconectada"` | MySQL apagado: Start en XAMPP. Revisa `DB_*` en `.env`. |
| "Falta la tabla usuarios" al crear usuario | Importa `docs/usuarios.sql` y `docs/nivel2.sql`. |
| `EADDRINUSE` al arrancar | Ya hay un servidor en el puerto 3000. Ciérralo o cambia `PORT`. |
| Todos pierden la sesión al reiniciar | Falta `SESSION_SECRET` en `.env`. |
| "Demasiados intentos" | 5 contraseñas incorrectas: espera 5 minutos (o reinicia el servidor). |
| "Tu rol no tiene permiso" | Esa acción es de otro rol (ver sección 6). |
| La cámara no abre | Entra por `localhost` o por HTTPS (sección 5). |
| *STOCK INSUFICIENTE* | La salida pide más de lo que hay. Registra antes una entrada. |

## 11. Git y GitHub

- Rama principal: `main` → https://github.com/Clay666-bru/HACKATON-Uadeo-2026
- Nunca se suben: `back/.env`, `node_modules/`, `back/uploads/`, `back/certs/` ni `CREDENCIALES.local.md`.
- Versiones: ver la sección *Cómo versionamos* de [`CHANGELOG.md`](../CHANGELOG.md).
