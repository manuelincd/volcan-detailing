# Decisiones de Seguridad

Este documento registra el razonamiento detrás de cada decisión de seguridad tomada en el proyecto. Está dirigido a desarrolladores que mantengan el sistema y a revisores de seguridad. Cada afirmación apunta al código específico que la implementa.

---

## 1. JWT en lugar de sesiones en el servidor

**Decisión:** Autenticación sin estado mediante JWT en lugar de sesiones almacenadas en el servidor.

**Justificación:** Este es un despliegue de un solo backend y un solo frontend donde se anticipa escalabilidad horizontal. Las sesiones en el servidor requieren un almacén de sesiones compartido (Redis, base de datos) entre instancias; los JWT llevan toda la información de identidad dentro del token y no requieren estado entre nodos. La desventaja — la incapacidad de revocar un token instantáneamente — se mitiga manteniendo el tiempo de vida del access token corto (15 minutos) y validando el campo `isActive` del usuario en cada renovación.

**Implementación:**
- `src/utils/jwt.js` — los tokens se firman con HS256 y un secret de mínimo 32 caracteres.
- `src/config/env.js` — la validación al arranque rechaza secrets más cortos que 32 caracteres.
- `src/controllers/authController.js` — el endpoint `refresh` vuelve a consultar la base de datos y verifica `isActive` antes de emitir un nuevo access token, por lo que una cuenta desactivada deja de recibir tokens nuevos en un máximo de 15 minutos.

**Limitación conocida:** Un access token robado y no expirado no puede revocarse sin implementar una lista negra de tokens. Aceptable para el MVP; la ventana corta de 15 minutos limita la exposición.

---

## 2. Estrategia de doble token: access token en memoria, refresh token en cookie HttpOnly

**Decisión:** Access token de corta duración (15 min) devuelto en el cuerpo de la respuesta JSON y almacenado en memoria de JavaScript; refresh token de larga duración (7 días) almacenado en una cookie HttpOnly con `SameSite=Strict` y `Path=/api/auth`.

**Justificación:**

- **XSS no puede robar el refresh token.** Una cookie HttpOnly es invisible para JavaScript. Si un atacante inyecta un script, `document.cookie` no expone el refresh token.
- **CSRF no puede usar el refresh token.** `SameSite=Strict` impide que el navegador adjunte la cookie en solicitudes entre sitios. Un formulario falsificado o una solicitud cross-origin desde la página de un atacante llega sin la cookie.
- **`Path=/api/auth` limita el alcance de la cookie.** El navegador solo adjunta la cookie de refresh en solicitudes bajo `/api/auth`, no en cada llamada al API. Esto reduce la superficie de exposición ante middleware de registro de cookies o proxies.
- **Access token en memoria (no en localStorage).** `localStorage` es accesible para cualquier JavaScript en la página, incluyendo scripts inyectados. El estado en memoria se limpia al cerrar la pestaña y no puede ser leído por otras pestañas o extensiones.
- **Secrets separados por tipo de token.** `JWT_SECRET` firma los access tokens; `JWT_REFRESH_SECRET` firma los refresh tokens. Un access token robado no puede usarse para falsificar un refresh token válido cambiando el payload, y viceversa.

**Implementación:**
- `src/controllers/authController.js` — objeto `cookieOpts` con las cuatro propiedades; `clearOpts` usa el mismo `path` para que `clearCookie` elimine efectivamente la cookie.
- `src/utils/jwt.js` — `signAccess`/`verifyAccess` usan `JWT_SECRET`; `signRefresh`/`verifyRefresh` usan `JWT_REFRESH_SECRET`.

---

## 3. bcrypt con cost factor 12

**Decisión:** Todas las contraseñas se hashean con bcrypt en cost factor 12.

**Justificación:** El cost factor de bcrypt es el exponente en base 2 del número de rondas. El cost 10 (predeterminado de la librería) toma ~100 ms en hardware moderno; el cost 12 toma ~400 ms. OWASP recomienda un mínimo de 10, con 12 preferido cuando el rendimiento del servidor lo permite.

Para un sistema de citas de autolavado, la frecuencia de login es baja (no es un API de alto tráfico), por lo que la sobrecarga de ~400 ms por login es aceptable. El cost factor limita directamente la velocidad de fuerza bruta offline: un atacante que exfiltre la base de datos de hashes puede probar aproximadamente 2,500 contraseñas por segundo por núcleo de GPU con cost 12, versus ~10,000 con cost 10.

No se usa un cost factor mayor a 12 porque haría que el endpoint `/api/auth/login` fuera notablemente lento bajo carga legítima moderada y no mejoraría significativamente la seguridad dado que el rate limiting ya limita los ataques en línea a 5 intentos por 15 minutos.

**Implementación:**
- `src/controllers/authController.js` — `bcrypt.hash(password, 12)` en tanto `register` como en la creación de empleados.
- `prisma/seed.js` — las contraseñas del seed también se hashean con cost 12 por consistencia.

---

## 4. Rate limiting en el login

**Decisión:** Máximo 5 intentos de login por dirección IP por ventana deslizante de 15 minutos en `POST /api/auth/login`. Las solicitudes bloqueadas reciben código `429` con un cuerpo JSON que sigue el formato de error del proyecto y quedan registradas.

**Justificación:** Sin rate limiting, un atacante puede probar miles de contraseñas por segundo contra direcciones de correo conocidas (credential stuffing, fuerza bruta en línea). 5 intentos por 15 minutos es el umbral recomendado por OWASP para endpoints de login — suficientemente estricto para detener ataques automatizados mientras permite a un usuario legítimo que no recuerda su contraseña hasta 5 intentos antes de esperar.

La ventana de 15 minutos se eligió sobre un bloqueo más largo (por ejemplo, 1 hora) para reducir la carga de soporte por bloqueos accidentales mientras sigue haciendo la automatización impráctica.

**Por qué por IP y no por cuenta:** Los límites por cuenta habilitan un ataque de denegación de servicio donde un atacante bloquea repetidamente la cuenta de un usuario específico fallando el login intencionalmente. Los límites por IP no tienen esta debilidad.

**Registro:** Cada solicitud bloqueada llama a `log.rateLimitHit(req.ip, req.body?.email)`, que emite una entrada `warn` estructurada con timestamp. Esto crea un rastro de auditoría para detectar ataques coordinados desde múltiples IPs.

**Implementación:**
- `src/config/constants.js` — `LOGIN_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 5 }`.
- `src/routes/auth.js` — `express-rate-limit` aplicado solo a `POST /login`; `standardHeaders: true` devuelve los headers `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` para que los clientes legítimos puedan mostrar una cuenta regresiva.
- `src/utils/logger.js` — método `rateLimitHit`.

---

## 5. Protección IDOR en citas

**Decisión:** Cada lectura y escritura de citas verifica que el usuario solicitante esté autorizado para acceder a ese recurso específico, no solo que esté autenticado.

**Justificación:** IDOR (Insecure Direct Object Reference) es OWASP A01. Un cliente que conoce o adivina el ID de cita de otro cliente (`GET /api/appointments/42`) no debe poder leerla ni modificarla. El middleware de roles por sí solo es insuficiente — confirma que el usuario tiene el rol correcto, pero no que el recurso le pertenece.

**Reglas aplicadas:**
- Un cliente solo puede leer o cancelar sus propias citas (`clientId === req.user.sub`).
- Un empleado solo puede leer o actualizar el estado de citas asignadas a él (`employeeId === req.user.sub`).
- Un administrador no tiene restricción de propiedad.

La verificación se realiza después de obtener el registro de la base de datos. Devolver `403` en lugar de `404` para acceso a recursos de otro usuario es intencional: un `404` en un ID adivinado confirmaría que el registro existe, filtrando la misma información.

**Implementación:**
- `src/controllers/appointmentController.js` — verificaciones IDOR en tanto `get` como `update` antes de devolver o escribir cualquier dato.
- La validación de transiciones de estado (mapa `ALLOWED_TRANSITIONS`) restringe adicionalmente lo que cada rol puede hacer una vez que pasa la verificación de propiedad.

---

## 6. Configuración de Helmet y headers de seguridad HTTP

**Decisión:** Todas las respuestas llevan headers de seguridad configurados por Helmet con una anulación explícita (`referrerPolicy`).

**Headers y su propósito:**

| Header | Valor | Protege contra |
|--------|-------|----------------|
| `Content-Security-Policy` | Predeterminado de Helmet | XSS mediante scripts/iframes inyectados |
| `X-Frame-Options` | `SAMEORIGIN` (predeterminado de Helmet) | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | Ataques de sniffing de tipo MIME |
| `Strict-Transport-Security` | Predeterminado de Helmet (producción) | SSL stripping, ataques de degradación |
| `Referrer-Policy` | `no-referrer` | Filtración del URL actual a solicitudes de terceros |
| `Permissions-Policy` | Predeterminado de Helmet | Acceso no deseado a funciones del navegador (cámara, micrófono, etc.) |

`referrerPolicy: { policy: 'no-referrer' }` se pasa explícitamente porque el predeterminado de Helmet (`strict-origin-when-cross-origin`) incluiría la ruta en el header `Referer` en navegaciones del mismo origen, lo que podría exponer rutas internas en logs del servidor.

**CORS** está configurado para permitir únicamente `FRONTEND_URL` (definido en `.env`). El origen comodín `*` nunca se usa. `credentials: true` es necesario porque la cookie del refresh token debe enviarse entre orígenes (el navegador bloquea solicitudes con credenciales a `*`).

**Límite de tamaño del body** (`express.json({ limit: '10kb' })`) previene que payloads JSON sobredimensionados sean usados como vector de denegación de servicio.

**Implementación:**
- `src/app.js` — `app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }))` y `app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))`.

---

## 7. Prevención de timing attack en el login

**Decisión:** La comparación con bcrypt se ejecuta incluso cuando el correo electrónico enviado no coincide con ningún usuario en la base de datos.

**Justificación:** Una implementación de login ingenua hace un cortocircuito cuando no se encuentra el usuario:

```js
// Patrón vulnerable
const user = await prisma.user.findUnique({ where: { email } });
if (!user) return fail(res, 'Credenciales inválidas', ...); // ruta rápida
await bcrypt.compare(password, user.passwordHash);          // ruta lenta
```

Esto crea una diferencia de tiempo medible entre "el correo no existe" (~1 ms) y "el correo existe pero la contraseña es incorrecta" (~400 ms con cost 12). Un atacante puede usar esta diferencia para enumerar direcciones de correo válidas a escala, construyendo una lista de objetivos para credential stuffing.

La solución es siempre ejecutar una comparación bcrypt, usando un hash ficticio cuando no se encuentra el usuario para que el tiempo de respuesta sea aproximadamente el mismo en ambos casos.

**Implementación:**
- `src/controllers/authController.js`:
  ```js
  const hash = user?.passwordHash ?? '$2b$12$invalidhashpaddingtomatchbcrypttime';
  const valid = await bcrypt.compare(password, hash);
  ```
  El valor ficticio tiene formato válido de hash bcrypt para que la librería no haga cortocircuito. El condicional `if (!user || !user.isActive || !valid)` se evalúa después de la comparación, asegurando que la ruta lenta siempre se ejecute.

**Por qué el mismo mensaje de error genérico:** La llamada final a `fail(...)` devuelve `"Credenciales inválidas"` independientemente de si el correo existe, la contraseña es incorrecta o la cuenta está inactiva. Esto previene otra clase de enumeración: un atacante no puede confirmar un correo válido observando un mensaje de error diferente.

---

## 8. Fix TOCTOU en el agendamiento de citas

**Decisión:** La prevención de doble reserva usa un enfoque de dos capas: una verificación de conflicto a nivel de aplicación seguida de un índice único parcial a nivel de base de datos como red de seguridad definitiva.

**El problema — condición de carrera check-then-act (TOCTOU):**

```
Request A: SELECT ... WHERE date='2024-01-15' AND time_slot='09:00' → 0 filas (slot libre)
Request B: SELECT ... WHERE date='2024-01-15' AND time_slot='09:00' → 0 filas (slot libre)
Request A: INSERT cita (date='2024-01-15', time_slot='09:00') ← éxito
Request B: INSERT cita (date='2024-01-15', time_slot='09:00') ← también éxito ← DOBLE RESERVA
```

Si la aplicación solo depende de un SELECT antes del INSERT, dos solicitudes concurrentes que ambas pasen la verificación antes de que cualquiera escriba tendrán éxito, creando dos citas para el mismo horario.

**La solución — índice único parcial:**

```sql
CREATE UNIQUE INDEX "uq_active_appointment_slot"
  ON "appointments" ("date", "time_slot")
  WHERE status != 'cancelled';
```

El índice parcial aplica unicidad a nivel de base de datos: el propio INSERT fallará con una violación de restricción única si una solicitud concurrente ya confirmó. La condición `WHERE status != 'cancelled'` significa que las citas canceladas no bloquean un slot para ser reservado nuevamente, que es el comportamiento esperado del negocio.

**Por qué mantener la verificación a nivel de aplicación:** La verificación en la aplicación (`findFirst`) captura el caso común y devuelve una respuesta `409 SLOT_TAKEN` amigable para el usuario. El índice de la base de datos captura la condición de carrera y su error Prisma `P2002` se traduce al mismo `409`, por lo que el cliente ve un código de error consistente en ambos casos.

**Por qué el índice está en la migración y no en el schema:** `schema.prisma` de Prisma no soporta índices parciales (cláusulas `WHERE` en `@@unique`). El índice se agrega como SQL raw al final de la migración inicial, después de que todas las tablas y llaves foráneas existen, para que se ejecute en el orden correcto.

**Implementación:**
- `prisma/migrations/20260509202620_init/migration.sql` — definición del índice único parcial.
- `src/controllers/appointmentController.js` — verificación `findFirst` antes de `create`; `P2002` capturado en el bloque `catch` y devuelto como `SLOT_TAKEN`.

---

## 9. El cambio de contraseña requiere confirmación de la contraseña actual

**Decisión:** `POST /api/auth/change-password` requiere que el solicitante proporcione `currentPassword` y lo verifica con bcrypt antes de aplicar la actualización.

**Justificación:** Un login exitoso produce un access token válido por 15 minutos y un refresh token válido por 7 días. Si un atacante obtiene una sesión — robando el dispositivo, interceptando un token o explotando XSS — de otro modo podría cambiar silenciosamente la contraseña de la víctima y bloquearla permanentemente. Requerir la contraseña actual significa que el atacante debe conocer un secreto que nunca fue transmitido después del login inicial, lo que es poco probable que tenga solo con un token robado.

**Por qué el mensaje de error es genérico:** Ya sea que la `currentPassword` enviada sea incorrecta, la cuenta no exista o esté inactiva, el endpoint devuelve el mismo código `INVALID_CREDENTIALS` y el mensaje `"Credenciales inválidas"`. Devolver un error distinto como `"La contraseña actual es incorrecta"` confirmaría al atacante que está apuntando a una cuenta válida y que la sesión que tiene sigue activa.

La comparación con bcrypt siempre se ejecuta contra el hash almacenado (o un hash ficticio si el usuario no se encuentra) para prevenir la variante de timing attack descrita en la sección 7.

**Limitación conocida — los tokens existentes no se invalidan:** Cambiar la contraseña no revoca ningún token emitido. Un atacante que ya capturó un access token retiene acceso hasta que expire (hasta 15 minutos). Un atacante con el refresh token puede continuar obteniendo nuevos access tokens hasta que el refresh token expire en 7 días, independientemente del cambio de contraseña.

Cerrar completamente esta brecha requiere una de estas mejoras:
1. **Rotación de refresh tokens con lista negra** — cada uso del refresh token emite uno nuevo e invalida el anterior. Un cambio de contraseña marca todos los tokens del usuario como inválidos.
2. **Incorporar un contador `passwordVersion`** en el payload del JWT e incrementarlo en cada cambio de contraseña. El controlador `refresh` compara la versión del token con el valor actual en la base de datos y rechaza las discrepancias.

Ambas requieren estado adicional en la base de datos y se dejan como mejora post-MVP.

**Implementación:**
- `src/controllers/authController.js` — `changePassword`: obtiene `passwordHash`, ejecuta `bcrypt.compare` incondicionalmente, devuelve `INVALID_CREDENTIALS` en caso de fallo, hashea la nueva contraseña con cost 12 y actualiza el registro.
- `src/schemas/authSchema.js` — schema `changePassword`: `newPassword` reutiliza la misma regla de contraseña del registro (mín. 8 caracteres, mayúscula, dígito, carácter especial).

---

## 10. Autenticación multifactor (TOTP)

**Decisión:** MFA basado en TOTP usando la librería speakeasy, compatible con Google Authenticator y cualquier app compatible con RFC 6238. El MFA es opcional por usuario y requiere un paso de verificación antes de activarse.

### Qué es TOTP y por qué ayuda

TOTP (Time-based One-Time Password, RFC 6238) genera un código de 6 dígitos hasheando un secreto compartido junto con el tiempo Unix actual dividido en ventanas de 30 segundos. El servidor y la app autenticadora calculan el código de forma independiente — no se necesita comunicación de red en el momento de verificación. Dado que el código cambia cada 30 segundos y es de un solo uso en la práctica, una contraseña robada sola no es suficiente para autenticarse: el atacante también necesita acceso físico al dispositivo que ejecuta el autenticador.

### Flujo de login en dos pasos y el tempToken

Cuando un usuario con MFA activado envía su contraseña, el backend no puede emitir una sesión completa de inmediato — el segundo factor aún no ha sido verificado. En su lugar, devuelve un **tempToken**:

```js
if (user.mfaEnabled) {
  const tempToken = signTemp({ sub: user.id, role: user.role, mfaRequired: true });
  return ok(res, { mfaRequired: true, tempToken });
}
```

El tempToken es un JWT firmado con `JWT_SECRET` que expira en **5 minutos**. Lleva `mfaRequired: true` en su payload. El endpoint `POST /api/auth/mfa/validate` verifica esta claim antes de emitir tokens reales:

```js
if (!payload.mfaRequired) return fail(res, 'Token inválido', 'INVALID_TOKEN', 401);
```

Esto significa que el tempToken **no puede usarse como access token** aunque sea interceptado. La expiración de 5 minutos limita la ventana durante la cual un tempToken robado puede usarse para completar el login.

### La configuración requiere verificación antes de activar el MFA

`POST /api/auth/mfa/setup` genera un secreto TOTP y lo guarda en el registro del usuario, pero **no** establece `mfaEnabled = true`. El usuario debe llamar a `POST /api/auth/mfa/verify-setup` con un código válido de su app autenticadora para activarlo. Este proceso de dos pasos previene que un usuario active el MFA con un autenticador mal configurado y quede bloqueado de su cuenta.

### Desactivar el MFA requiere confirmación de contraseña

`POST /api/auth/mfa/disable` requiere que el usuario proporcione su contraseña actual, verificada con bcrypt antes de limpiar el flag. Sin esta verificación, un atacante que obtenga una sesión robada podría desactivar inmediatamente el MFA y luego cambiar la contraseña, bloqueando permanentemente al propietario legítimo.

### Tolerancia al desfase de reloj (window: 1)

Los códigos TOTP están ligados a ventanas de 30 segundos. Si el reloj del servidor y el del dispositivo difieren ligeramente, un código generado en el borde de una ventana podría ser rechazado aunque sea técnicamente válido. `window: 1` de speakeasy acepta la ventana actual más una ventana en cada lado (±30 segundos), dando un rango de aceptación total de 90 segundos. Esta es la configuración predeterminada recomendada por OWASP.

### Limitación conocida — rotación de refresh tokens

El MFA refuerza el login inicial pero no protege contra un refresh token robado que fue emitido antes de activar el MFA, o un access token capturado en mitad de la sesión. La rotación de refresh tokens es la mejora natural que se deja para post-MVP.

**Implementación:**
- `prisma/schema.prisma` — `mfaSecret String? @map("mfa_secret")` y `mfaEnabled Boolean @default(false) @map("mfa_enabled")` en el modelo `User`.
- `prisma/migrations/20260510170104_add_mfa_fields/` — agrega ambas columnas con defaults seguros para que los usuarios existentes no se vean afectados.
- `src/utils/jwt.js` — `signTemp`/`verifyTemp` usan `JWT_SECRET` con expiración de 5 minutos.
- `src/controllers/authController.js` — `mfaSetup`, `mfaVerifySetup`, `mfaDisable`, `mfaValidate`.
- `src/schemas/authSchema.js` — `mfaVerifySetup` y `mfaValidate` requieren que `token` coincida con `/^\d{6}$/`.

---

## 11. El precio de la cita se resuelve y almacena al momento de la reserva

**Decisión:** Cuando un cliente crea una cita, el controlador busca el JSON de `prices` del servicio (`{ sedan, suv, van }`) y escribe el nivel aplicable en una columna `resolvedPrice` en el registro de la cita. El precio almacenado nunca se recalcula desde el registro vivo del servicio.

**Justificación:** Los precios de los servicios pueden cambiar en cualquier momento desde el panel de administrador. Sin capturar el precio al momento de la reserva, un aumento de precio retroactaría silenciosamente a todas las citas pendientes y confirmadas que fueron reservadas a la tarifa original, lo cual sería sorpresivo para los clientes y potencialmente un problema de responsabilidad.

Almacenar `resolvedPrice` al momento de la creación significa:
- Lo que el cliente ve en la confirmación es lo que debe pagar, independientemente de cambios posteriores en los precios.
- Los reportes históricos reflejan lo que realmente se cobró, no el precio actual del catálogo.
- Los auditores pueden reconstruir el nivel de precio vigente al momento de cada reserva sin necesidad de inspeccionar el log de auditoría.

`resolvedPrice` es nullable para que la migración no requiera retroalimentar datos para citas pre-existentes creadas antes de que se introdujera esta funcionalidad.

**Implementación:**
- `prisma/schema.prisma` — `resolvedPrice Decimal? @db.Decimal(10,2) @map("resolved_price")` en `Appointment`; `prices Json` reemplaza al antiguo `price Decimal` en `Service`.
- `prisma/migrations/20260510180000_replace_price_with_prices_json/migration.sql` — elimina `price`, agrega `prices JSONB` con un `DEFAULT` temporal para filas existentes, agrega `resolved_price` como nullable.
- `src/controllers/appointmentController.js` — el mapa `VEHICLE_PRICE_KEY` convierte el tipo de vehículo del formulario de reserva a la clave de nivel `sedan | suv | van`; el valor resuelto se escribe en el payload de `create`.