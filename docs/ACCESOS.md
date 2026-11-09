# Accesos, cuentas y contraseñas

Cómo se entra a LabControl, qué cuentas existen, cómo se crean y cómo se cambian o recuperan las contraseñas.

> 🔐 **Las contraseñas reales no están en este archivo** porque el repositorio es público.
> En la computadora del laboratorio están en `CREDENCIALES.local.md` (raíz del proyecto), que **no se sube a GitHub**.

---

## 1. Inicio de sesión

- Dirección: **http://localhost:3000/login.html** (o `https://<ip>:3000` desde el teléfono).
- **Todos los roles** entran con **usuario y contraseña**. El rol sale de la cuenta, no se elige.
- Los alumnos usan su **matrícula** como usuario.
- Al entrar, cada quien llega a su inicio: alumnos a `practicas.html`, los demás a `index.html`.

### Reglas de seguridad
| Regla | Detalle |
|---|---|
| Contraseña mínima | **8 caracteres** |
| Usuario | 3 a 40 caracteres: letras, números, punto, guion o guion bajo. Se guarda en minúsculas |
| Cifrado | `scrypt` con sal aleatoria. **Nadie puede ver una contraseña guardada**, ni siquiera en la base de datos |
| Sesión | Token firmado (HMAC) que dura `SESION_HORAS` (10 h por defecto). Se guarda en `sessionStorage`: **se cierra al cerrar la pestaña** |
| Intentos fallidos | **5 errores → ese usuario queda bloqueado 5 minutos.** Reiniciar el servidor quita el bloqueo |
| Cuentas desactivadas | Ya no pueden iniciar sesión. Una sesión que ya estaba abierta sigue hasta que expire o se cierre la pestaña |
| Cerrar sesión | Botón **Cerrar sesión** abajo en el menú lateral |

---

## 2. Cuentas actuales

| Usuario | Rol | Nombre | Para qué |
|---|---|---|---|
| `laboratorio` | Laboratorio | Laboratorista Prueba | Cuenta de prueba del laboratorista |
| `prueba.administrador` | Administrador | Prueba administrador | Cuenta de prueba de coordinación |
| `prueba.profesor` | Profesor | Prueba profesor | Cuenta de prueba de profesor |

Contraseñas: en `CREDENCIALES.local.md`. Son **cuentas de prueba**: antes de usar el sistema en serio, cambia sus contraseñas (menú lateral → **Cambiar contraseña**) o desactívalas.

Ver todas las cuentas desde la base de datos:
```bash
/c/xampp/mysql/bin/mysql.exe -uroot almacen_lab -e "SELECT id, usuario, nombre, rol, activo, ultimo_acceso FROM usuarios"
```

### Base de datos (MySQL de XAMPP)
| Dato | Valor |
|---|---|
| Servidor | `localhost:3306` |
| Usuario | `root` |
| Contraseña | *(vacía, la de fábrica de XAMPP)* |
| Base | `almacen_lab` |
| phpMyAdmin | http://localhost/phpmyadmin (requiere Apache encendido en XAMPP) |

Si le pones contraseña a `root`, escríbela también en `DB_PASSWORD` de `back/.env`.

---

## 3. Crear cuentas

### Personal (administrador, laboratorio, profesor)

**Opción A: desde la terminal** (sirve para la primera cuenta). En `back/`:
```bash
npm run usuario:crear -- <usuario> <rol> "<Nombre completo>" <contraseña>
```
- `rol`: `administrador`, `laboratorio` o `profesor`.
- Si el usuario **ya existe**, se actualizan su nombre, rol y contraseña y se **reactiva**.

Ejemplos:
```bash
npm run usuario:crear -- coordinacion administrador "Coordinación Biomédicas" Cambia-Esta-123
```
```bash
npm run usuario:crear -- jperez profesor "Juan Pérez" Cambia-Esta-123
```

**Opción B: desde la página** (con sesión de administrador):
- *Administración → Usuarios y catálogos* (`escuela.html`): profesores (y alumnos).
- *Administración → Laboratoristas* (`laboratoristas.html`): laboratoristas.

### Alumnos
Solo el **administrador**, en *Usuarios y catálogos*:
- **Uno por uno**: matrícula, nombre, grupo y contraseña (opcional).
- **Con Excel**: descarga la plantilla, llénala (matrícula, nombre, grupo, equipo, contraseña opcional) y súbela. Máximo 1000 por archivo.
- Si no escribes contraseña, se genera una **temporal** (empieza con `Al-`) que **solo se muestra una vez**. Cópiala o descarga la lista en ese momento y entrégasela al alumno.

Después, el administrador asigna a cada profesor sus **clases** (grupo + materia) y arma los **equipos de trabajo** en *Grupos y equipos*.

---

## 4. Cambiar y recuperar contraseñas

| Caso | Cómo |
|---|---|
| Laboratorista olvidó su contraseña | Admin → *Laboratoristas* → **Restablecer contraseña**. Se genera una temporal (`Tmp-…`) que se muestra una sola vez |
| Profesor o alumno olvidó su contraseña | Desde la terminal con `npm run usuario:crear` (solo personal), o con la API `POST /api/escolar/usuarios/:id/password` (admin) |
| Administrador olvidó su contraseña | Solo desde la terminal: `npm run usuario:crear -- <usuario> administrador "<Nombre>" <nueva>`. La API no permite restablecer a otro administrador |
| Cambiar la propia contraseña | **Cualquier rol:** menú lateral → **Cambiar contraseña**. Escribe la actual y la nueva dos veces. La sesión sigue abierta. 5 intentos fallidos lo bloquean 5 minutos. (API: `POST /api/auth/password` con `{ "actual", "nueva" }`) |
| Desactivar una cuenta | Admin → *Usuarios y catálogos* (o `PATCH /api/escolar/usuarios/:id` con `{ "activo": false }`). Nadie puede desactivarse a sí mismo |

Para alumnos, `npm run usuario:crear` **no sirve** (los alumnos necesitan grupo). Usa la página del administrador o la API.

---

## 5. Permisos por rol (resumen)

| Acción | Admin | Lab | Profesor | Alumno |
|---|:-:|:-:|:-:|:-:|
| Ver inventario | ✅ | ✅ | ✅ | |
| Alta, edición, baja y movimientos de inventario | ✅ | ✅ | | |
| Solicitar laboratorio | | | ✅ | |
| Autorizar práctica (1.º admin, 2.º lab) | ✅ | ✅ | | |
| Bitácora de práctica y vales | ✅ | ✅ | | |
| Aceptar vale del equipo | | | | ✅ |
| Solicitar bata | | | | ✅ |
| Atender batas | ✅ | ✅ | | |
| Grupos y equipos de trabajo | ✅ | 👁️ | ✅ (sus grupos) | |
| Usuarios, catálogos, laboratoristas | ✅ | | | |
| Reportes | ✅ | | | |
| Semestres | ✅ | ✅ | | |

Detalle por página: [`DOCUMENTACION.md`, sección 6](DOCUMENTACION.md#6-roles-y-qué-puede-hacer-cada-uno).

---

## 6. Buenas prácticas

- Usa un `SESSION_SECRET` largo y distinto en cada instalación; cambiarlo cierra todas las sesiones.
- No compartas cuentas: cada movimiento guarda el **nombre** de quien lo registró.
- Cambia o desactiva las cuentas de prueba antes de la operación real.
- No subas `back/.env` ni `CREDENCIALES.local.md` a GitHub (ya están en `.gitignore`).
