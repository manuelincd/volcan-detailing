# Volcán Detailing — Appointment Management System

A fullstack web application for managing appointments at a premium car detailing shop, built with a **security-first mindset**. Academic project for the Secure Software Development course.

---

## Features

- Online appointment booking with real-time availability
- Secure authentication via **JWT** with refresh token rotation
- **Two-factor authentication (MFA)** via Google Authenticator (TOTP)
- Role-based access control — **Administrator, Employee, Client**
- Admin dashboard for full control over users, services, schedules, and appointments
- Employee view for managing and updating assigned daily appointments
- Client portal for booking, viewing, and cancelling own appointments
- Service catalog with pricing by vehicle category (sedan, SUV, van)
- Price locked at booking time — catalog changes don't affect existing appointments

---

## Security implementations

This project was developed applying **Secure Software Development** principles, covering the OWASP Top 10:

| Measure | Description |
|---|---|
| **JWT Authentication** | Signed with HS256, separate secrets for access and refresh tokens. Access token expires in 15 min, refresh token in 7 days. |
| **HttpOnly Cookies** | Refresh token stored in HttpOnly cookie with `SameSite=Strict` and `Path=/api/auth`. |
| **RBAC Authorization** | Role-based middleware on every protected route — role verified server-side on every request, never trusted from client. |
| **IDOR Protection** | Resource ownership validated before any operation — clients cannot access other users' data. |
| **Input Validation** | All inputs validated on the backend with Joi schemas. Frontend validation is UX only, never the security boundary. |
| **SQL Injection** | Prisma ORM with parameterized queries exclusively — no raw query strings. |
| **Brute Force** | Rate limiting on `/api/auth/login` — max 5 attempts per IP every 15 minutes. |
| **Timing Attack** | bcrypt always executes even if the user does not exist, preventing user enumeration via response time. |
| **TOCTOU** | Duplicate detection via Prisma `P2002` error catch instead of prior existence check. |
| **Mass Assignment** | Explicit whitelist of allowed fields in every controller. |
| **XSS** | `Content-Security-Policy` headers configured via Helmet.js. |
| **CSRF** | `SameSite=Strict` cookie attribute prevents cross-site request forgery. |
| **Password Security** | Hashed with bcrypt (cost factor 12). Minimum 8 characters, at least one uppercase, one number, one special character. |
| **Security Headers** | Full HTTP security header suite via Helmet.js. |
| **Error Handling** | Internal error details never exposed to the client — only generic messages returned. |

---

## Tech stack

**Backend**
- Node.js 20+ + Express 4+
- PostgreSQL 15+ (Docker)
- Prisma ORM
- JSON Web Tokens (JWT)
- bcrypt
- Joi (input validation)
- Helmet.js
- express-rate-limit
- speakeasy + qrcode (MFA/TOTP)

**Frontend**
- React 18+
- React Router 6+
- Axios

---

## Project structure

```
volcan-detailing/
├── backend/
│   ├── src/
│   │   ├── config/           # env.js, constants.js, db.js
│   │   ├── middlewares/      # auth.js, roleGuard.js, validate.js, errorHandler.js
│   │   ├── routes/           # auth, appointments, users, services, availability
│   │   ├── controllers/      # business logic per resource
│   │   ├── schemas/          # Joi schemas per resource
│   │   └── utils/            # jwt.js, response.js, logger.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/            # Login, Register, Landing, role dashboards, Profile, Unauthorized
│   │   ├── components/       # Navbar, AppointmentCard, ProtectedRoute, admin tabs
│   │   ├── context/          # AuthContext
│   │   ├── services/         # authService, appointmentService, userService, serviceService
│   │   └── utils/            # validators.js, dateHelpers.js
│   └── package.json
│
└── docs/
    ├── REQUIREMENTS.md
    └── SECURITY_DECISIONS.md
```

---

## Getting started

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in your environment variables
docker compose up -d    # starts PostgreSQL
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Required environment variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/volcan_detailing

JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

## API endpoints

### Authentication
```
POST   /api/auth/register           # Client registration
POST   /api/auth/login              # All roles
POST   /api/auth/logout             # Invalidate session
POST   /api/auth/refresh            # Rotate access token
POST   /api/auth/change-password    # Authenticated users
POST   /api/auth/mfa/setup          # Initialize MFA setup
POST   /api/auth/mfa/verify-setup   # Verify and activate MFA
POST   /api/auth/mfa/disable        # Disable MFA
POST   /api/auth/mfa/validate       # Validate TOTP code on login
```

### Appointments
```
GET    /api/appointments            # Admin: all | Employee: assigned | Client: own
POST   /api/appointments            # Clients only
GET    /api/appointments/:id        # Owner or assigned admin/employee
PATCH  /api/appointments/:id        # Status update (employee/admin) or cancellation (client)
DELETE /api/appointments/:id        # Admin only
```

### Services
```
GET    /api/services                # Public, no authentication required
POST   /api/services                # Admin only
PUT    /api/services/:id            # Admin only
DELETE /api/services/:id            # Admin only (soft delete)
```

### Users
```
GET    /api/users                   # Admin only
POST   /api/users                   # Admin only (create employee)
PUT    /api/users/:id               # Admin only
DELETE /api/users/:id               # Admin only (soft delete)
```

### Availability
```
GET    /api/availability?date=      # Public, no authentication required
GET    /api/health                  # Public, server health check
```

---

## Roles and permissions

| Action | Admin | Employee | Client |
|---|:---:|:---:|:---:|
| View all appointments | ✅ | ✅ | ❌ |
| View own appointments | ✅ | ✅ | ✅ |
| Create appointment | ✅ | ✅ | ✅ |
| Cancel any appointment | ✅ | ❌ | ❌ |
| Cancel own appointment (2h before) | ✅ | ✅ | ✅ |
| Update appointment status | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Manage services | ✅ | ❌ | ❌ |
| Configure availability slots | ✅ | ❌ | ❌ |

---

## Appointment status flow
```
pending → confirmed → in_progress → completed
                  ↘               ↘
                cancelled       cancelled
```

---

## Academic context
Project developed for the **Secure Software Development** course — Software Engineering, Universidad de Colima.

The goal was to apply security principles studied in class on a real functional system, prioritizing user data protection and system integrity. 
