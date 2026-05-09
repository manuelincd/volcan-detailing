# Volcan Detailing – Appointment System MVP
## Requirements Document

---

## 1. Project Overview

Web application for managing car wash appointments with role-based access control.
The system allows clients to book appointments, employees to manage their assigned
appointments, and administrators to oversee the entire operation.

**Development focus:** Secure software development practices including input validation,
authentication, authorization, and protection against OWASP Top 10 vulnerabilities.

---

## 2. User Roles

### 2.1 Guest (Unauthenticated)
- View available service packages and pricing
- View business information (hours, location, contact)
- Access registration and login pages

### 2.2 Client (Authenticated)
- Register and manage personal account
- View available time slots
- Create, view, and cancel own appointments
- View appointment history
- Receive appointment confirmation

### 2.3 Employee (Authenticated)
- View assigned appointments for the day
- Update appointment status: `pending → in_progress → completed`
- View client information for assigned appointments

### 2.4 Administrator (Authenticated)
- Full CRUD on employees and clients
- View and manage all appointments
- Configure available time slots and schedules
- Manage service packages and pricing
- View basic reports (appointments per day, status summary)

---

## 3. Core Functional Requirements

### 3.1 Authentication
- User registration (clients only; employees created by admin)
- Login with email and password
- JWT-based session management with refresh tokens
- Logout (token invalidation)
- Password hashing with bcrypt (cost factor 12+)

### 3.2 Appointments
- Available slots based on configurable schedule
- One appointment per time slot (no double booking)
- Appointment fields: date, time, service type, vehicle type, status, assigned employee
- Clients can cancel appointments up to 2 hours before scheduled time
- Status flow: `pending → confirmed → in_progress → completed / cancelled`

### 3.3 Services / Packages
- Basic Wash
- Full Wash
- Premium Detailing
- Each package has: name, description, duration (minutes), price

---

## 4. Technical Stack

| Layer        | Technology         | Version  |
|--------------|--------------------|----------|
| Frontend     | React.js           | 18+      |
| Routing      | React Router       | 6+       |
| HTTP Client  | Axios              | latest   |
| Backend      | Node.js + Express  | 20+ / 4+ |
| ORM          | Prisma             | latest   |
| Database     | PostgreSQL         | 15+      |
| Auth         | JWT + bcrypt       | -        |
| Validation   | Joi                | latest   |
| Security     | Helmet.js          | latest   |
| Rate Limit   | express-rate-limit | latest   |
| Environment  | dotenv             | latest   |

---

## 5. Security Requirements

### 5.1 Authentication & Authorization
- JWT tokens must be signed with HS256 and a strong secret (min 32 chars)
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- Refresh tokens stored in HttpOnly cookies (not localStorage)
- Every protected endpoint must validate JWT and check role via middleware
- Role must be verified server-side on every request, never trusted from client

### 5.2 Input Validation
- All inputs validated on the backend using Joi schemas
- Frontend validation is UX-only, never the security boundary
- Date/time inputs must be within allowed business hours
- No appointment creation in the past
- Email format validation on registration
- Password minimum: 8 characters, at least one uppercase, one number, one special character

### 5.3 Protection Against Common Attacks
- **SQL Injection:** Use Prisma ORM exclusively, no raw queries unless parameterized
- **XSS:** Escape all outputs; set Content-Security-Policy header via Helmet
- **CSRF:** CSRF tokens on all state-mutating form submissions
- **IDOR:** Verify resource ownership on every request (clients can only access own appointments)
- **Brute Force:** Rate limit on `/auth/login` — max 5 attempts per 15 minutes per IP
- **Mass Assignment:** Use explicit field whitelisting in all controllers

### 5.4 HTTP Security Headers (via Helmet.js)
```
Content-Security-Policy
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security (HSTS)
Referrer-Policy: no-referrer
Permissions-Policy
```

### 5.5 General Security Practices
- All credentials and secrets in environment variables (.env), never hardcoded
- .env file must never be committed to version control (.gitignore)
- HTTPS enforced in production
- Sensitive error details never exposed to client (generic messages only)
- Server-side logging of failed authentication attempts
- CORS configured to allow only the frontend origin

---

## 6. Project Structure

```
autolavado-app/
├── backend/
│   ├── src/
│   │   ├── config/          # DB connection, env vars, constants
│   │   ├── middlewares/     # auth, roleGuard, rateLimiter, errorHandler, validate
│   │   ├── routes/          # auth, appointments, users, services, admin
│   │   ├── controllers/     # business logic per resource
│   │   ├── schemas/         # Joi validation schemas
│   │   ├── models/          # Prisma schema
│   │   └── utils/           # JWT helpers, response helpers, logger
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/           # Login, Register, Dashboard (per role), Appointments
│   │   ├── components/      # Navbar, AppointmentCard, ProtectedRoute
│   │   ├── context/         # AuthContext
│   │   ├── services/        # API calls via Axios
│   │   └── utils/           # form validators, date helpers
│   └── package.json
│
└── docs/
    ├── REQUIREMENTS.md       # this file
    └── SECURITY_DECISIONS.md # rationale for security choices
```

---

## 7. API Endpoints

### Auth
```
POST   /api/auth/register       # Client self-registration
POST   /api/auth/login          # All roles
POST   /api/auth/logout         # Invalidate token
POST   /api/auth/refresh        # Refresh access token
```

### Appointments
```
GET    /api/appointments         # Admin: all | Employee: assigned | Client: own
POST   /api/appointments         # Client only
GET    /api/appointments/:id     # Owner or admin/employee
PATCH  /api/appointments/:id     # Status update (employee/admin) or cancel (client)
DELETE /api/appointments/:id     # Admin only
```

### Services (Packages)
```
GET    /api/services             # Public
POST   /api/services             # Admin only
PUT    /api/services/:id         # Admin only
DELETE /api/services/:id         # Admin only
```

### Users (Admin)
```
GET    /api/users                # Admin only
POST   /api/users                # Admin only (create employee)
PUT    /api/users/:id            # Admin only
DELETE /api/users/:id            # Admin only
```

### Availability
```
GET    /api/availability?date=   # Public
```

---

## 8. Data Models

### User
```
id, email, password_hash, name, phone, role (admin|employee|client),
created_at, updated_at, is_active
```

### Appointment
```
id, client_id, employee_id (nullable), service_id, vehicle_type,
date, time_slot, status, notes, created_at, updated_at
```

### Service
```
id, name, description, duration_minutes, price, is_active
```

### TimeSlot
```
id, day_of_week, start_time, end_time, is_active
```

---

## 9. Non-Functional Requirements

- API response time under 500ms for standard operations
- Passwords must never appear in logs
- All API errors return consistent JSON structure: `{ error: true, message: string, code: string }`
- Authentication errors must not reveal whether email exists (use generic message)
- Prepared for security scanning with tools like OWASP ZAP and Burp Suite
```