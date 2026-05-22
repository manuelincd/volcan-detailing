# Volcán Detailing – Sistema de Citas MVP
## Documento de Requerimientos

---

## 1. Descripción del Proyecto

Aplicación web para la gestión de citas de un autolavado premium con control de acceso basado en roles. El sistema permite a los clientes consultar paquetes de servicio, registrarse y agendar citas en línea. Los empleados gestionan sus citas asignadas del día. El administrador tiene visibilidad y control total sobre usuarios, servicios y citas.

**Enfoque de desarrollo:** Prácticas de desarrollo de software seguro que incluyen validación de entradas, autenticación, autorización y protección contra las vulnerabilidades del OWASP Top 10.

---

## 2. Roles de Usuario

### 2.1 Visitante (No autenticado)
- Consultar paquetes de servicio disponibles y precios por categoría de vehículo
- Ver información del negocio (horarios, ubicación, contacto)
- Acceder a las páginas de registro e inicio de sesión

### 2.2 Cliente (Autenticado)
- Registrarse y gestionar su cuenta personal
- Consultar disponibilidad de horarios por fecha
- Crear, visualizar y cancelar sus propias citas (hasta 2 horas antes)
- Ver historial de citas con precios estimados
- Activar autenticación de dos factores (MFA)

### 2.3 Empleado (Autenticado)
- Ver las citas asignadas del día en orden cronológico
- Actualizar el estado de sus citas: `pendiente → en proceso → completada`
- Ver información básica del cliente en cada cita asignada

### 2.4 Administrador (Autenticado)
- CRUD completo de empleados y clientes
- Ver y gestionar todas las citas del sistema
- Configurar horarios y slots de disponibilidad
- Gestionar paquetes de servicio y precios por categoría de vehículo
- Activar, desactivar y editar usuarios

---

## 3. Requerimientos Funcionales

### 3.1 Autenticación
- Registro de clientes con validación de contraseña segura
- Inicio de sesión con correo electrónico y contraseña para todos los roles
- Gestión de sesión mediante JWT con tokens de renovación
- Cierre de sesión con invalidación del token
- Hashing de contraseñas con bcrypt (cost factor 12)
- Cambio de contraseña requiriendo contraseña actual
- Autenticación de dos factores con Google Authenticator (TOTP)

### 3.2 Citas
- Slots disponibles basados en horario configurable por día de la semana
- Una cita activa por horario (sin doble reserva)
- Campos de cita: fecha, horario, tipo de servicio, tipo de vehículo, estado, empleado asignado, precio resuelto
- Los clientes pueden cancelar hasta 2 horas antes del horario agendado
- Flujo de estados: `pendiente → confirmada → en proceso → completada / cancelada`
- El precio se guarda al momento de la reserva y no cambia con modificaciones posteriores al catálogo

### 3.3 Servicios / Paquetes
- Lavado Exterior
- Lavado Completo
- Detallado Profundo
- Pulido y Encerado
- Detallado Premium
- Cada paquete tiene: nombre, descripción, duración en minutos, precios por categoría de vehículo (sedán, SUV, van)

---

## 4. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React.js | 18+ |
| Enrutamiento | React Router | 6+ |
| Cliente HTTP | Axios | latest |
| Backend | Node.js + Express | 20+ / 4+ |
| ORM | Prisma | latest |
| Base de datos | PostgreSQL | 15+ |
| Autenticación | JWT + bcrypt + TOTP | — |
| Validación | Joi | latest |
| Seguridad | Helmet.js | latest |
| Rate Limiting | express-rate-limit | latest |
| MFA | speakeasy + qrcode | latest |
| Variables de entorno | dotenv | latest |
| Contenedor BD | Docker | latest |

---

## 5. Requerimientos de Seguridad

### 5.1 Autenticación y Autorización
- Los tokens JWT deben estar firmados con HS256 y un secret de mínimo 32 caracteres
- Secrets separados para access token y refresh token
- Expiración del access token: 15 minutos
- Expiración del refresh token: 7 días
- Refresh tokens almacenados en cookies HttpOnly con SameSite=Strict y Path=/api/auth
- Todo endpoint protegido debe validar JWT y verificar rol mediante middleware
- El rol debe verificarse en el servidor en cada solicitud, nunca confiarse desde el cliente

### 5.2 Validación de Entradas
- Todas las entradas validadas en el backend con schemas Joi
- La validación del frontend es solo para experiencia de usuario, nunca es la frontera de seguridad
- Las fechas de cita deben ser hoy o en el futuro, dentro de los próximos 30 días
- El formato de horario debe cumplir el patrón HH:MM
- Validación de formato de correo electrónico en el registro
- Contraseña mínima: 8 caracteres, al menos una mayúscula, un número y un carácter especial
- El teléfono debe cumplir el patrón de número válido si se proporciona

### 5.3 Protección contra Ataques Comunes
- **Inyección SQL:** Uso exclusivo de Prisma ORM con consultas parametrizadas
- **XSS:** Headers Content-Security-Policy configurados mediante Helmet
- **CSRF:** Cookie con SameSite=Strict previene solicitudes entre sitios
- **IDOR:** Verificación de propiedad del recurso en cada solicitud
- **Fuerza bruta:** Rate limiting en /api/auth/login — máximo 5 intentos por IP cada 15 minutos
- **Timing attack:** bcrypt siempre se ejecuta aunque el usuario no exista
- **TOCTOU:** Captura de error P2002 en lugar de verificación previa de duplicados
- **Asignación masiva:** Lista blanca explícita de campos permitidos en todos los controladores

### 5.4 Headers de Seguridad HTTP (vía Helmet.js)
```
Content-Security-Policy
X-Frame-Options
X-Content-Type-Options: nosniff
Strict-Transport-Security (HSTS)
Referrer-Policy: no-referrer
Permissions-Policy
```

### 5.5 Prácticas Generales de Seguridad
- Todas las credenciales y secrets en variables de entorno, nunca en el código fuente
- El archivo .env nunca debe incluirse en el control de versiones (.gitignore)
- HTTPS obligatorio en producción
- Detalles de errores internos nunca expuestos al cliente, solo mensajes genéricos
- Logging en el servidor de intentos fallidos de autenticación y bloqueos por rate limiting
- CORS configurado para permitir únicamente el origen del frontend

---

## 6. Estructura del Proyecto

```
volcan-detailing/
├── backend/
│   ├── src/
│   │   ├── config/       # env.js, constants.js, db.js
│   │   ├── middlewares/  # auth.js, roleGuard.js, validate.js, errorHandler.js
│   │   ├── routes/       # auth, appointments, users, services, availability
│   │   ├── controllers/  # lógica de negocio por recurso
│   │   ├── schemas/      # schemas Joi por recurso
│   │   └── utils/        # jwt.js, response.js, logger.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/        # Login, Register, Landing, dashboards por rol, Perfil, Unauthorized
│   │   ├── components/   # Navbar, AppointmentCard, ProtectedRoute, tabs de admin
│   │   ├── context/      # AuthContext
│   │   ├── services/     # authService, appointmentService, userService, serviceService, availabilityService
│   │   └── utils/        # validators.js, dateHelpers.js
│   └── package.json
│
└── docs/
    ├── REQUIREMENTS.md
    └── SECURITY_DECISIONS.md
```

---

## 7. Endpoints del API

### Autenticación
```
POST   /api/auth/register              # Registro de clientes
POST   /api/auth/login                 # Todos los roles
POST   /api/auth/logout                # Cierre de sesión
POST   /api/auth/refresh               # Renovación de access token
POST   /api/auth/change-password       # Cambio de contraseña (autenticado)
POST   /api/auth/mfa/setup             # Iniciar configuración de MFA
POST   /api/auth/mfa/verify-setup      # Verificar y activar MFA
POST   /api/auth/mfa/disable           # Desactivar MFA
POST   /api/auth/mfa/validate          # Validar código TOTP en login
```

### Citas
```
GET    /api/appointments                # Admin: todas | Empleado: asignadas | Cliente: propias
POST   /api/appointments                # Solo clientes
GET    /api/appointments/:id            # Propietario o admin/empleado asignado
PATCH  /api/appointments/:id            # Cambio de estado (empleado/admin) o cancelación (cliente)
DELETE /api/appointments/:id            # Solo administrador
```

### Servicios
```
GET    /api/services                    # Público, sin autenticación
POST   /api/services                    # Solo administrador
PUT    /api/services/:id                # Solo administrador
DELETE /api/services/:id                # Solo administrador (soft delete)
```

### Usuarios
```
GET    /api/users                       # Solo administrador
POST   /api/users                       # Solo administrador (crear empleado)
PUT    /api/users/:id                   # Solo administrador
DELETE /api/users/:id                   # Solo administrador (soft delete)
```

### Disponibilidad
```
GET    /api/availability?date=          # Público, sin autenticación
```

### Sistema
```
GET    /api/health                      # Público, verificación de estado del servidor
```

---

## 8. Modelos de Datos

### Usuario
```
id, email, password_hash, name, phone, role (admin|employee|client),
is_active, mfa_secret, mfa_enabled, created_at, updated_at
```

### Cita
```
id, client_id, employee_id (nullable), service_id, vehicle_type,
date, time_slot, status, notes, resolved_price, created_at, updated_at
```

### Servicio
```
id, name, description, duration_minutes, prices (JSON), is_active, created_at, updated_at
```

### Horario disponible
```
id, day_of_week, start_time, end_time, is_active
```

---

## 9. Requerimientos No Funcionales

- Tiempo de respuesta del API menor a 500ms en operaciones estándar
- Las contraseñas nunca deben aparecer en logs ni en respuestas del API
- Todos los errores del API deben seguir la estructura: `{ error: true, message: string, code: string }`
- Los errores de autenticación no deben revelar si el correo electrónico existe en el sistema
- El sistema debe estar preparado para auditoría con herramientas como OWASP ZAP y Burp Suite
- Los cambios de precio en servicios no deben afectar citas ya agendadas