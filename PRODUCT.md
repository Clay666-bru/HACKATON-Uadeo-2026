# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Encargado de laboratorio (laboratorista):** cuenta, registra y clasifica equipos, reactivos y consumibles; documenta entradas y salidas, muchas veces de pie y desde el celular dentro del laboratorio. Es el único rol que modifica datos (sesión con contraseña).
- **Docente (profesor):** consulta inventario y disponibilidad; solicita el laboratorio para prácticas (docente, grupo, estudiantes, espacio, fecha, horario, insumos).
- **Coordinación (administrador):** supervisa el laboratorio, revisa solicitudes y horarios, valida viabilidad y consulta alertas.
- **Jueces del hackatón LinceCode 2026:** ven la app en una demo (laptop o proyector). Confirmado por el usuario: la prioridad es el uso real del personal, pero la demo debe verse impecable.

## Product Purpose

Gestión Integral de Laboratorio Biomédico de la Universidad Autónoma de Occidente (UAdeO): controlar el inventario de materiales y equipos, registrar entradas y salidas con trazabilidad (QR), anticipar alertas de stock, caducidad y mantenimiento, y organizar prácticas y espacios. Éxito: el personal sabe qué hay, dónde está y qué falta sin depender de hojas de cálculo.

## Operating Context

- Uso en computadora de escritorio, tableta y teléfono dentro del laboratorio; también en proyector durante la demo.
- Movimientos capturados con código QR / código de barras y etiquetas impresas (`etiquetas.html`).
- Backend Node.js + Express + MySQL/MariaDB en `back/`; el front en `front/` es HTML, CSS y JavaScript sin compilación, servido por Express.

## Capabilities and Constraints

- Funcionan con datos reales: inicio de sesión, vista general, inventario (materiales y equipos), movimientos, etiquetas QR y alertas.
- Prototipos sin backend todavía: prácticas, nueva práctica, calendario, accesos (control de personas, provisional y pendiente de validación) y roles.
- Los nombres de campos, IDs y clases que usa `front/assets/js/` deben conservarse; el rediseño no puede romper la integración.
- Sin frameworks ni compilación en el front; sin dependencias pesadas.

## Brand Commitments

- Logo UAdeO en `front/assets/brand/uadeo.png` (original en `uadeo-original.png`): respetar proporciones y colores, nunca recolorearlo ni deformarlo.
- Nombre de la app: «Laboratorio Biomédico · Gestión Integral».
- Requisito binding del usuario: glassmorphism obligatorio (vidrio esmerilado con fondo de color detrás, bordes de 1px con brillo, capas con distinto blur, fallback sin `backdrop-filter`). El usuario también pidió explícitamente que el resultado se vea profesional y no "hecho con IA".
- Diseño «Materia viva» (oscuro) como predeterminado, con versión clara activable desde el botón de sol/luna. El usuario descartó un rediseño claro alternativo («Placas sobre mesa de luz», guardado en git stash).

## Evidence on Hand

- Datos de ejemplo en la base `almacen_lab` (`docs/base de datos.sql`): materiales y equipos ficticios.
- No hay testimonios, métricas de uso ni fotografías propias del laboratorio; no deben inventarse.

## Product Principles

1. El dato manda: cantidades, estados y fechas se leen antes que cualquier decoración.
2. Lo que es prototipo se dice: los avisos de datos de ejemplo y funciones no implementadas permanecen visibles.
3. Registrar un movimiento debe ser rápido y seguro desde un teléfono.
4. Cada rol ve lo que puede hacer; las acciones restringidas no se ofrecen como si funcionaran.

## Accessibility & Inclusion

Contraste WCAG AA sobre el vidrio, foco visible, HTML semántico, objetivos táctiles de 44 px y respeto a `prefers-reduced-motion`.
