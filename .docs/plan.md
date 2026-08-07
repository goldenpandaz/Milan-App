# Plan de construcción — Milan

Contexto de negocio completo en [`universo-del-discurso.md`](./universo-del-discurso.md).
Este documento es el plan técnico, por fases, para construir la app.

## Stack

- **Angular 18**, standalone components, SSR (`@angular/ssr` + `server.ts`)
- **Angular Service Worker** (`@angular/service-worker` + `ngsw-config.json`) → PWA instalable
  en Android y iOS (Safari no dispara `beforeinstallprompt`: hay que detectar iOS por
  `userAgent` y mostrar instrucciones manuales de "Agregar a inicio", igual que en miCartera)
- **Tailwind** puro (sin Bootstrap ni Angular Material, para control total de la paleta
  blanco/negro/dorado)
- **Firebase**: Auth (REST) + Realtime Database. Sin backend propio. Proyecto Firebase propio
  para Milan, separado de cualquier otra app.
- Proyecto de referencia para patrones de carpeta y de PWA:
  `E:\Golden Panda\8) Programacion\miCartera\miCartera`

## Árbol de datos (Realtime Database)

Un único salón: el árbol es plano, sin capa de `venues/{venueId}`.

```
usuarios/
  {uid}: { nombre, email, rol, estado, creadoEn }   // rol: administrador|jefe_mesero|mesero|null
                                                      // estado: pendiente|activo
eventos/
  {eventoId}/
    info: { nombre, fecha, horaInicio, horaFin, estado, desmontajeAsignadoA?, creadoPor, creadoEn }
    participantes/
      {uid}: { activo: true }
    tareas/
      {tareaId}: { titulo, tipo, asignadoA, estado, creadoPor, creadoEn }
    inventario/
      {itemId}: { nombre, cantidad, falta, nota, cargadoPor, confirmadoPorAdmin }
```

Notas de diseño:
- Sin multi-tenant: nada de `venues/`, `codigos_negocio/` ni `usuarios_index/`. Un solo negocio,
  para siempre — la app está pensada y asegurada para eso.
- Las reglas de seguridad de RTDB validan, para cada operación, que `auth.uid` tenga un registro
  en `usuarios/{uid}` con el rol adecuado.
- **Primer administrador**: se promueve a mano desde la consola de Firebase (no hay onboarding
  de "crear negocio"). Ver sección 4 de `universo-del-discurso.md`.

## Fases

### Fase 0 — Scaffolding del proyecto
- `ng new milan-app` (standalone, SSR habilitado, sin routing módulo clásico)
- Instalar y configurar Tailwind (paleta custom blanco/negro/dorado en `tailwind.config.js`)
- Instalar `@angular/service-worker`, generar `ngsw-config.json`, configurar `manifest.webmanifest`
  (íconos, `display: standalone`, `theme_color`/`background_color` acorde a la paleta)
- Configurar Firebase (proyecto nuevo y propio en la consola, Realtime Database + Authentication
  habilitados, reglas en modo bloqueado por defecto)
- Estructura de carpetas base: `app/auth`, `app/page`, `app/shared/components`, `app/core/{guards,services,models}`

### Fase 1 — Autenticación
- Registro directo (nombre, correo, contraseña) → queda `pendiente` sin rol
- Pantalla de "solicitud pendiente" para el empleado recién registrado
- Login (patrón REST de Identity Toolkit)
- Guards de ruta por rol (`administrador`, `jefe_mesero`, `mesero`, y guard de "estado: pendiente")
- Primer administrador: promoción manual desde la consola de Firebase

### Fase 2 — Panel de administrador: usuarios
- Listado de solicitudes pendientes → aprobar y asignar rol
- Listado de equipo con rol actual → editar/revocar rol en cualquier momento

### Fase 3 — Eventos
- CRUD de eventos (administrador y jefe_mesero)
- Activación por evento: el mesero ve el evento vigente y se marca disponible
  (`participantes/{uid}.activo`)
- Vista "Equipo" del jefe de meseros: quiénes están activos para el evento actual

### Fase 4 — Tareas y asignación
- CRUD de tareas por evento (jefe_mesero / administrador)
- Sección "Asignar": asignar tarea a mesero activo, ver pendientes/sin asignar, cálculo de
  % de carga por mesero
- Vista del mesero: checklist de tareas asignadas con check hecho/no-hecho
- Tipo de tarea "lavado" como caso particular dentro del mismo modelo de tareas

### Fase 5 — Inventario / desmontaje
- Al asignar la tarea de tipo "desmontaje", habilitar la pantalla de inventario de ese evento
- Formulario de carga: ítem, cantidad, falta/no falta, nota — visible solo para el asignado
- Vista del administrador: revisar y confirmar (check) el inventario cargado
- (Opcional, fase futura) exportar/consolidar lista de compra en base a lo marcado como faltante

### Fase 6 — Pulido de UI/UX
- Sistema de diseño Tailwind (tokens de color negro/blanco/dorado, tipografía, espaciado)
- Branding Milan: logo en login, registro, header e íconos/PWA (`public/branding/logo-milan.png`)
- Componentes compartidos (header, sidebar/bottom-nav mobile-first, modal, badge de estado)
- Responsive real en mobile primero, verificar en desktop como secundario
- Probar instalación PWA en Android real y en iPhone real (Safari)

### Fase 7 — Reglas de seguridad de Firebase
- Reglas de Realtime Database: acceso por rol, admin ⊇ jefe_mesero ⊇ mesero
- Inventario de un evento: lectura/escritura restringida al `uid` asignado a esa tarea +
  administrador

### Fase 8 — Deploy
- Firebase Hosting (o alternativa) con SSR
- Verificación end-to-end del flujo completo: registrarse → promover primer admin a mano →
  aprobar empleados → asignar roles → crear evento → activarse → asignar tareas → completar →
  desmontaje/inventario
