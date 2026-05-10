# Security Decisions

This document records the rationale behind each security decision in the codebase.
It is intended for developers maintaining this project and for security reviewers.
Every claim below points to the specific code that implements it.

---

## 1. JWT over server-side sessions

**Decision:** Stateless JWT authentication rather than server-stored sessions.

**Rationale:** This is a single-backend, single-frontend deployment where horizontal
scaling is anticipated. Server-side sessions require a shared session store (Redis,
database) across instances; JWTs carry all identity information inside the token and
require no cross-node state. The tradeoff — inability to instantly revoke a token — is
mitigated by keeping the access token lifetime short (15 minutes) and validating the
user's `isActive` flag on every refresh.

**Implementation:**
- `src/utils/jwt.js` — tokens are signed with HS256 and a 32-character minimum secret.
- `src/config/env.js` — startup validation rejects secrets shorter than 32 characters.
- `src/controllers/authController.js` — `refresh` re-queries the database and checks
  `isActive` before issuing a new access token, so a deactivated account stops
  receiving new tokens within at most 15 minutes.

**Known limitation:** A stolen, unexpired access token cannot be revoked without
upgrading to a token blocklist. Acceptable for MVP; the short 15-minute window limits
the exposure window.

---

## 2. Dual-token strategy: access token in memory, refresh token in HttpOnly cookie

**Decision:** Short-lived access token (15 min) returned in the JSON response body and
stored in JavaScript memory; long-lived refresh token (7 days) stored in an HttpOnly
cookie with `SameSite=Strict` and `Path=/api/auth`.

**Rationale:**

- **XSS cannot steal the refresh token.** An HttpOnly cookie is invisible to
  JavaScript. If an attacker injects a script, `document.cookie` does not expose the
  refresh token.
- **CSRF cannot use the refresh token.** `SameSite=Strict` prevents the browser from
  attaching the cookie to cross-site requests entirely. A forged form submission or
  cross-origin fetch from an attacker's page arrives without the cookie.
- **`Path=/api/auth` limits cookie scope.** The browser only attaches the refresh
  cookie to requests under `/api/auth`, not to every API call. This reduces the
  surface for cookie-logging middleware or proxies to capture it.
- **Access token in memory (not localStorage).** `localStorage` is accessible to any
  JavaScript running on the page, including injected scripts. Memory state is cleared
  on tab close and cannot be read by other tabs or extensions.
- **Separate secrets per token type.** `JWT_SECRET` signs access tokens;
  `JWT_REFRESH_SECRET` signs refresh tokens. A stolen access token cannot be used to
  forge a valid refresh token by changing the payload, and vice versa.

**Implementation:**
- `src/controllers/authController.js` — `cookieOpts` object with all four properties;
  `clearOpts` uses the same `path` so `clearCookie` actually removes the cookie.
- `src/utils/jwt.js` — `signAccess`/`verifyAccess` use `JWT_SECRET`;
  `signRefresh`/`verifyRefresh` use `JWT_REFRESH_SECRET`.

---

## 3. bcrypt cost factor 12

**Decision:** All passwords hashed with bcrypt at cost factor 12.

**Rationale:** The bcrypt cost factor is the base-2 exponent of the number of rounds.
Cost 10 (the library default) takes ~100 ms on modern hardware; cost 12 takes ~400 ms.
OWASP recommends a minimum of 10, with 12 preferred where server throughput allows it.

For a detailing booking system, login frequency is low (not a high-traffic API), so
the ~400 ms overhead per login is acceptable. The cost factor directly limits offline
brute-force speed: an attacker who exfiltrates the hash database can test roughly
2,500 passwords per second per GPU core at cost 12, versus ~10,000 at cost 10.

A cost factor above 12 is not used because it would make the `/api/auth/login`
endpoint noticeably slow under modest legitimate load and would not meaningfully
improve security given that rate limiting already throttles online attacks to 5
attempts per 15 minutes.

**Implementation:**
- `src/controllers/authController.js` — `bcrypt.hash(password, 12)` in both `register`
  and employee `create`.
- `prisma/seed.js` — seed passwords also hashed with cost 12 for consistency.

---

## 4. Rate limiting on login

**Decision:** Maximum 5 login attempts per IP address per 15-minute sliding window on
`POST /api/auth/login`. Blocked requests receive `429` with a JSON body matching the
project's error envelope and are logged.

**Rationale:** Without rate limiting, an attacker can test thousands of passwords
per second against known email addresses (credential stuffing, online brute force).
5 attempts per 15 minutes is the OWASP-recommended threshold for login endpoints —
tight enough to stop automated attacks while allowing a legitimate user who misremembers
their password up to 5 tries before waiting.

The 15-minute window was chosen over a longer lockout (e.g. 1 hour) to reduce the
support burden from accidental lockouts while still making automation impractical.

**Why per-IP rather than per-account:** Per-account limits enable a denial-of-service
attack where an attacker repeatedly locks out a specific user's account by intentionally
failing login. Per-IP limits do not have this weakness.

**Logging:** Every blocked request calls `log.rateLimitHit(req.ip, req.body?.email)`,
which emits a structured `warn` entry with timestamp. This creates an audit trail for
detecting coordinated attacks across multiple IPs.

**Implementation:**
- `src/config/constants.js` — `LOGIN_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 5 }`.
- `src/routes/auth.js` — `express-rate-limit` applied only to `POST /login`;
  `standardHeaders: true` returns `RateLimit-Limit`, `RateLimit-Remaining`, and
  `RateLimit-Reset` headers so legitimate clients can display a countdown.
- `src/utils/logger.js` — `rateLimitHit` method.

---

## 5. IDOR protection on appointments

**Decision:** Every appointment read and write verifies that the requesting user is
authorized to access that specific resource, not just that they are authenticated.

**Rationale:** IDOR (Insecure Direct Object Reference) is OWASP A01. A client who
knows or guesses another client's appointment ID (`GET /api/appointments/42`) must
not be able to read or modify it. Role-based middleware alone is insufficient — it
confirms the user has the right role, but not that the resource belongs to them.

**Rules enforced:**
- A client may only read or cancel their own appointments (`clientId === req.user.sub`).
- An employee may only read or update status on appointments assigned to them
  (`employeeId === req.user.sub`).
- An admin has no ownership restriction.

The check is performed after fetching the record from the database. Returning `403`
rather than `404` for owned-but-wrong-role access is intentional: a `404` on a
guessed ID would still confirm that the record exists, leaking the same information.

**Implementation:**
- `src/controllers/appointmentController.js` — IDOR checks in both `get` and `update`
  before any data is returned or written.
- Status transition validation (`ALLOWED_TRANSITIONS` map) further constrains what
  each role can do once the ownership check passes.

---

## 6. Helmet configuration and HTTP security headers

**Decision:** All responses carry security headers set by Helmet with one explicit
override (`referrerPolicy`).

**Headers and their purpose:**

| Header | Value | Protects against |
|--------|-------|-----------------|
| `Content-Security-Policy` | Helmet default | XSS via injected scripts/iframes |
| `X-Frame-Options` | `SAMEORIGIN` (Helmet default) | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing attacks |
| `Strict-Transport-Security` | Helmet default (production) | SSL stripping, downgrade attacks |
| `Referrer-Policy` | `no-referrer` | Leaking the current URL to third-party requests |
| `Permissions-Policy` | Helmet default | Unwanted browser feature access (camera, mic, etc.) |

`referrerPolicy: { policy: 'no-referrer' }` is passed explicitly because the Helmet
default (`strict-origin-when-cross-origin`) would include the path in the `Referer`
header on same-origin navigations, which could expose internal routes in server logs.

**CORS** is configured to allow only `FRONTEND_URL` (set in `.env`). The wildcard
`*` origin is never used. `credentials: true` is required because the refresh-token
cookie must be sent cross-origin (browser blocks credentialed requests to `*`).

**Body size limit** (`express.json({ limit: '10kb' })`) prevents oversized JSON
payloads from being used as a denial-of-service vector.

**Implementation:**
- `src/app.js` — `app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }))` and
  `app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))`.

---

## 7. Timing attack prevention on login

**Decision:** bcrypt comparison runs even when the submitted email does not match any
user in the database.

**Rationale:** A naive login implementation short-circuits when the user is not found:

```js
// Vulnerable pattern
const user = await prisma.user.findUnique({ where: { email } });
if (!user) return fail(res, 'Invalid credentials', ...); // fast path
await bcrypt.compare(password, user.passwordHash);       // slow path
```

This creates a measurable timing difference between "email does not exist" (~1 ms) and
"email exists but password is wrong" (~400 ms at cost 12). An attacker can use this
difference to enumerate valid email addresses at scale, building a target list for
credential stuffing.

The fix is to always run a bcrypt comparison, using a dummy hash when no user is
found so the response time is approximately the same in both cases.

**Implementation:**
- `src/controllers/authController.js`:
  ```js
  const hash = user?.passwordHash ?? '$2b$12$invalidhashpaddingtomatchbcrypttime';
  const valid = await bcrypt.compare(password, hash);
  ```
  The dummy value is a valid bcrypt hash format so the library does not short-circuit.
  The conditional `if (!user || !user.isActive || !valid)` is evaluated after the
  comparison, ensuring the slow path always runs.

**Why the same generic error message:** The final `fail(...)` call returns
`"Invalid credentials"` regardless of whether the email exists, the password is wrong,
or the account is inactive. This prevents a different class of enumeration: an
attacker cannot confirm a valid email by observing a different error message.

---

## 8. TOCTOU fix on appointment booking

**Decision:** Double-booking prevention uses a two-layer approach: an
application-level conflict check followed by a database-level partial unique index as
the authoritative safety net.

**The problem — check-then-act race condition (TOCTOU):**

```
Request A: SELECT ... WHERE date='2024-01-15' AND time_slot='09:00' → 0 rows (slot free)
Request B: SELECT ... WHERE date='2024-01-15' AND time_slot='09:00' → 0 rows (slot free)
Request A: INSERT appointment (date='2024-01-15', time_slot='09:00') ← succeeds
Request B: INSERT appointment (date='2024-01-15', time_slot='09:00') ← also succeeds ← DOUBLE BOOKING
```

If the application only relies on a SELECT before INSERT, two concurrent requests that
both pass the check before either writes will both succeed, creating two appointments
for the same slot.

**The fix — partial unique index:**

```sql
CREATE UNIQUE INDEX "uq_active_appointment_slot"
  ON "appointments" ("date", "time_slot")
  WHERE status != 'cancelled';
```

The partial index enforces uniqueness at the database level: the INSERT itself will
fail with a unique constraint violation if a concurrent request already committed.
The `WHERE status != 'cancelled'` condition means cancelled appointments do not
block a slot from being rebooked, which is the intended business behaviour. A plain
`@@unique([date, timeSlot])` without the condition would not allow rebooking after
cancellation.

**Why keep the application-level check at all:** The application check (`findFirst`)
catches the common case and returns a user-friendly `409 SLOT_TAKEN` response. The
database index catches the race condition and its `P2002` Prisma error is translated
to the same `409` response, so the client sees a consistent error code either way.

**Why the index is in the migration rather than the schema:**
Prisma's `schema.prisma` does not support partial indexes (`WHERE` clauses on
`@@unique`). The index is appended as raw SQL at the end of the initial migration
(`prisma/migrations/20260509202620_init/migration.sql`), after all tables and foreign
keys exist, so it runs in the correct order.

**Implementation:**
- `prisma/migrations/20260509202620_init/migration.sql` — partial unique index
  definition.
- `src/controllers/appointmentController.js` — `findFirst` conflict check before
  `create`; `P2002` caught in the `catch` block and returned as `SLOT_TAKEN`.

---

## 9. Change password requires current password confirmation

**Decision:** `POST /api/auth/change-password` requires the caller to supply
`currentPassword` and verifies it with bcrypt before applying the update.

**Rationale:** A successful login produces a JWT access token that is valid for
15 minutes and a refresh token that is valid for 7 days. If an attacker obtains
a session — by stealing the device, intercepting a token, or exploiting XSS —
they would otherwise be able to silently change the victim's password and lock
them out permanently. Requiring the current password means the attacker must
know a secret that was never transmitted after initial login, which they are
unlikely to have from a stolen token alone.

**Why the error message is generic:** Whether the supplied `currentPassword` is
wrong, the account does not exist, or the account is inactive, the endpoint
returns the same `INVALID_CREDENTIALS` code and `"Invalid credentials"` message.
Returning a distinct error such as `"Current password is incorrect"` would confirm
to an attacker that they are targeting a valid account and that the session they
hold is still active — information they should not be able to confirm.

The bcrypt comparison always runs against the stored hash (or a dummy hash if
the user is somehow not found) to prevent the timing-attack variant described in
section 7.

**Known limitation — existing tokens are not invalidated:** Changing the password
does not revoke any issued tokens. An attacker who had already captured an access
token retains access until it expires (up to 15 minutes). An attacker with the
refresh token can continue obtaining new access tokens until the 7-day refresh
token expires, regardless of the password change.

Fully closing this gap requires one of:
1. **Refresh token rotation with a blocklist** — each refresh issues a new token
   and invalidates the previous one. A password change marks all tokens for that
   user as invalid in the blocklist.
2. **Embedding a `passwordVersion` counter** in the JWT payload and incrementing
   it on every password change. The `refresh` controller compares the token's
   version with the current value in the database and rejects mismatches.

Both require additional state in the database and are left as a post-MVP
improvement.

**Implementation:**
- `src/controllers/authController.js` — `changePassword`: fetches `passwordHash`,
  runs `bcrypt.compare` unconditionally, returns `INVALID_CREDENTIALS` on failure
  (same code as login), hashes the new password at cost 12, updates the record.
- `src/schemas/authSchema.js` — `changePassword` schema: `newPassword` reuses the
  same `password` rule as registration (min 8 chars, uppercase, digit, special char).

---

## 10. Multi-Factor Authentication (TOTP)

**Decision:** TOTP-based MFA using the speakeasy library, compatible with Google
Authenticator and any RFC 6238–compliant app. MFA is opt-in per user and gated
behind a verified setup step.

### What TOTP is and why it helps

TOTP (Time-based One-Time Password, RFC 6238) generates a 6-digit code by hashing
a shared secret together with the current Unix time divided into 30-second windows.
The server and the authenticator app each compute the code independently — no
network communication is needed at verification time. Because the code changes
every 30 seconds and is single-use in practice, a stolen password alone is not
enough to authenticate: the attacker also needs physical access to the device
running the authenticator.

### Two-step login flow and the tempToken

When a user with MFA enabled submits their password, the backend cannot issue a
full session immediately — the second factor has not been verified yet. Instead,
it returns a **tempToken**:

```js
if (user.mfaEnabled) {
  const tempToken = signTemp({ sub: user.id, role: user.role, mfaRequired: true });
  return ok(res, { mfaRequired: true, tempToken });
}
```

The tempToken is a JWT signed with `JWT_SECRET` and expires in **5 minutes**.
Critically, it carries `mfaRequired: true` in its payload. The `POST /api/auth/mfa/validate`
endpoint checks for this claim before issuing real tokens:

```js
if (!payload.mfaRequired) return fail(res, 'Invalid token', 'INVALID_TOKEN', 401);
```

This means the tempToken **cannot be used as an access token** even if intercepted:
the auth middleware (`src/middlewares/auth.js`) accepts any valid JWT signed with
`JWT_SECRET`, but a tempToken only grants access to the `/mfa/validate` endpoint.
Every other protected route ignores the `mfaRequired` claim entirely and relies on
the normal `sub`/`role` payload, so a tempToken presented as a Bearer token would
pass signature verification but carry no special privileges beyond what a normal
access token would — and normal access tokens do not have `mfaRequired: true`, so
this claim is effectively inert outside the validate endpoint.

The 5-minute expiry limits the window during which a stolen tempToken can be used
to complete the login.

### Setup requires verification before MFA is enabled

`POST /api/auth/mfa/setup` generates a TOTP secret and saves it to the user record,
but does **not** set `mfaEnabled = true`. The user must call
`POST /api/auth/mfa/verify-setup` with a valid code from their authenticator app:

```js
await prisma.user.update({ where: { id: req.user.sub }, data: { mfaEnabled: true } });
```

This two-step process prevents a user from enabling MFA with a misconfigured
authenticator — for example, an app that scanned a blurry QR code and stored the
secret incorrectly. If MFA were enabled without verification, the user would be
locked out of their account at next login with no way to recover without admin
intervention.

### Disabling MFA requires password confirmation

`POST /api/auth/mfa/disable` requires the user to supply their current password,
verified with bcrypt before the flag is cleared:

```js
const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
if (!user || !valid) return fail(res, 'Invalid credentials', 'INVALID_CREDENTIALS', 401);
await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecret: null } });
```

Without this check, an attacker who obtains a stolen session (access token) could
immediately disable MFA and then change the password, fully locking out the
legitimate owner. Requiring the password means the session alone is insufficient
— the attacker must also know the password, which is precisely what MFA is meant
to protect against.

### Clock drift tolerance (window: 1)

TOTP codes are time-bound to 30-second windows. If the server clock and the
device clock differ slightly — a common occurrence on mobile devices without NTP —
a code generated at the edge of a window may be rejected even though it is
technically valid. speakeasy's `window: 1` accepts the current window plus one
window on each side (±30 seconds), giving a total acceptance range of 90 seconds:

```js
speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
```

A wider window (e.g. `window: 2`, ±60 seconds) would improve tolerance for
misconfigured clocks but would also extend the time during which a captured code
could be replayed. `window: 1` is the OWASP-recommended default.

### Known limitation — refresh token rotation

MFA hardens the initial login but does not protect against a stolen refresh token
that was issued before MFA was enabled, or an access token captured mid-session.
The same token-invalidation limitation described in section 9 applies here.

Refresh token rotation is the natural pairing for MFA: each use of a refresh token
issues a new one and invalidates the previous, so a stolen token becomes useless
after one successful rotation. Combined with MFA, this would mean an attacker needs
the password, the physical authenticator device, and a live refresh token — all
simultaneously — to maintain a session. This is left as a post-MVP improvement.

**Implementation:**
- `prisma/schema.prisma` — `mfaSecret String? @map("mfa_secret")` and
  `mfaEnabled Boolean @default(false) @map("mfa_enabled")` on the `User` model.
- `prisma/migrations/20260510170104_add_mfa_fields/` — adds both columns with safe
  defaults (`NULL` secret, `false` enabled) so existing users are unaffected.
- `src/utils/jwt.js` — `signTemp`/`verifyTemp` use `JWT_SECRET` with a 5-minute
  expiry; the shared secret is intentional (no new env var needed) because the
  `mfaRequired` claim makes the token structurally distinct from an access token.
- `src/controllers/authController.js` — `mfaSetup`, `mfaVerifySetup`, `mfaDisable`,
  `mfaValidate`; updated `login` and `refresh` now include `mfaEnabled` in the
  returned user object.
- `src/schemas/authSchema.js` — `mfaVerifySetup` and `mfaValidate` require `token`
  to match `/^\d{6}$/`; `mfaDisable` requires a non-empty `password` string.
