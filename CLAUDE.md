# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Volcan Detailing is a car wash appointment management system MVP. Clients book appointments, employees manage their workload, and admins oversee the entire operation. The codebase has a strong security-first emphasis (OWASP Top 10 protections are explicit requirements, not nice-to-haves).

## Expected Commands

Once scaffolded, the project follows this structure:

```bash
# Backend (backend/)
npm run dev          # Start Express server with hot reload
npm run build        # Compile for production
npm run lint         # ESLint
npm test             # Run test suite
npx prisma migrate dev    # Apply DB migrations
npx prisma studio         # Open Prisma GUI

# Frontend (frontend/)
npm run dev          # Vite/CRA dev server
npm run build        # Production build
npm run lint         # ESLint
```

## Tech Stack

| Layer        | Technology         | Version  |
|--------------|--------------------|----------|
| Frontend     | React.js           | 18+      |
| Routing      | React Router       | 6+       |
| HTTP Client  | Axios              | latest   |
| Backend      | Node.js + Express  | 20+ / 4+ |
| ORM          | Prisma             | latest   |
| Database     | PostgreSQL         | 15+      |
| Auth         | JWT + bcrypt       | —        |
| Validation   | Joi                | latest   |
| Security     | Helmet.js          | latest   |
| Rate Limit   | express-rate-limit | latest   |
| Environment  | dotenv             | latest   |

## Folder Structure

```
volcan-detailing/
├── backend/
│   ├── src/
│   │   ├── config/          # env.js (startup validation), constants.js, db.js
│   │   ├── middlewares/     # auth.js, roleGuard.js, validate.js, errorHandler.js
│   │   ├── routes/          # auth, appointments, users, services, availability
│   │   ├── controllers/     # one file per resource; owns IDOR + business logic
│   │   ├── schemas/         # Joi schemas (authSchema, appointmentSchema, etc.)
│   │   └── utils/           # jwt.js, response.js (ok/fail helpers), logger.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Login, Register, AdminDashboard, ClientDashboard, EmployeeDashboard, Unauthorized
│   │   ├── components/      # Navbar, AppointmentCard, ProtectedRoute, admin/{AppointmentsTab,UsersTab,ServicesTab}
│   │   ├── context/         # AuthContext.jsx — user + accessToken in memory; loading state for session restore
│   │   ├── services/        # api.js (Axios + interceptor), authService, appointmentService, etc.
│   │   └── utils/           # dateHelpers.js, validators.js
│   └── package.json
└── docs/
    └── SECURITY_DECISIONS.md
```

## Architecture

**Monorepo with two independent apps:**

- `backend/` — Node.js 20 + Express 4 REST API
- `frontend/` — React 18 SPA (React Router 6, Axios)
- `docs/` — Requirements and security decision records

**Backend request flow:**
```
Route → rateLimiter → auth middleware → roleGuard → validate (Joi) → controller → Prisma → PostgreSQL
```

**Key backend directories:**
- `src/middlewares/` — `auth.js` (JWT verify), `roleGuard.js` (RBAC), `validate.js` (Joi wrapper), `errorHandler.js`
- `src/controllers/` — business logic; each controller uses explicit field whitelisting (no mass assignment)
- `src/schemas/` — Joi validation schemas, one per resource
- `src/utils/` — JWT helpers, standardized response format, logger (no passwords in logs)

**Frontend structure:**
- `src/context/AuthContext` — stores user role and access token in memory; refresh token lives in HttpOnly cookie
- `src/services/` — all Axios calls; token refresh interceptor lives here
- `src/components/ProtectedRoute` — guards routes by role

## Security Constraints (non-negotiable)

- **JWT:** HS256, access token 15min, refresh token 7 days in HttpOnly cookie — never localStorage
- **Passwords:** bcrypt cost factor 12+; never appear in logs or API responses
- **SQL:** Prisma ORM only; raw queries require parameterization
- **Rate limiting:** `/api/auth/login` max 5 attempts per 15 min per IP
- **IDOR:** Every controller must verify resource ownership before returning data
- **Input validation:** Joi schemas on the backend are the security boundary; frontend validation is UX only
- **Error messages:** Auth errors must not reveal whether an email exists; all errors use `{ error: true, message: string, code: string }`
- **CORS:** Allow only the configured frontend origin
- **CSRF:** Required on all state-mutating form submissions
- **HTTP headers (Helmet.js):** `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, `Permissions-Policy`
- **Password rules:** min 8 chars, at least one uppercase, one number, one special character
- **Logging:** Failed auth attempts must be logged server-side; passwords must never appear in logs

## Data Model Quick Reference

| Model       | Key fields |
|-------------|-----------|
| User        | id, email, password_hash, name, phone, role (admin\|employee\|client), is_active |
| Appointment | id, client_id, employee_id (nullable), service_id, vehicle_type, date, time_slot, status, notes |
| Service     | id, name, description, duration_minutes, price, is_active |
| TimeSlot    | id, day_of_week, start_time, end_time, is_active |

**Appointment status flow:** `pending → confirmed → in_progress → completed / cancelled`
- Clients can cancel up to 2 hours before scheduled time
- Employees update: `pending → in_progress → completed`
- Admin can do full CRUD

## Role-Based API Access Summary

- `GET /api/appointments` — admin sees all, employee sees assigned, client sees own
- `POST /api/appointments` — client only
- `PATCH /api/appointments/:id` — employee/admin (status), client (cancel only)
- `DELETE /api/appointments/:id` — admin only
- `/api/users` and `/api/services` (write) — admin only
- `GET /api/services` and `GET /api/availability` — public
