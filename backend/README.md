# Student Document Portal

Standalone service, session-wise: students upload admission documents via
phone+OTP login; staff/admin log in with email+password then an emailed
OTP (2-step). No dependency on erp-new.

## Stack

Node.js (ESM) + Express + PostgreSQL (Prisma) + Redis

## 1. Prerequisites on the VPS

- Node.js 20+, PostgreSQL, Redis running
- A directory **outside** any web-served/static path for file storage:
  ```bash
  sudo mkdir -p /var/www/portal-uploads
  sudo chown $USER:$USER /var/www/portal-uploads
  sudo chmod 750 /var/www/portal-uploads
  ```

## 2. Install & configure

```bash
npm install
cp .env.example .env
# edit .env — DATABASE_URL, REDIS_URL, JWT secrets, SMS_*, SMTP_*, GOOGLE_*, UPLOAD_ROOT
npx prisma migrate deploy
npm run seed:admin   # creates your first ADMIN login interactively
```

Runs on **port 3007** by default (set in `.env`).

## 3. Google Sheets — service account (one-time setup)

1. In Google Cloud Console: create/select a project → enable **Google Sheets API**.
2. Create a **Service Account** → generate a JSON key.
3. Put `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `private_key` →
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` in `.env`.
4. This service account email is shared across **all** sessions — the
   `GET /api/admin/settings` response always includes it, so the admin UI
   can show "share your new sheet with: xxx@...iam.gserviceaccount.com"
   every time a new session/sheet is added.

## 4. Sessions — how import actually works now

Sessions are **not** configured via `.env` any more. Each is a DB row:

```
POST /api/admin/sessions
{ "name": "2026-27 Admission", "year": 2026, "batch": "B1", "sheetId": "<paste any sheet id>" }
```

Then trigger import for that session specifically:

```
POST /api/admin/sessions/:id/import
```

Students, documents, and statuses are fully isolated per session — the
same phone number/admission number can exist in two different sessions
without conflict. Re-running import skips students already present in
that session (matched by admission_no or phone).

Sheet column mapping (A:H) is in `src/lib/sheets.js` → `rowToStudent()` —
edit it if a sheet's column order differs from
`admission_no, name, phone, email, dob, branch`.

## 5. Define document types

Seed required document types via Prisma Studio (`npx prisma studio`) or a
script — e.g. 10th Marksheet, 12th Marksheet, Transfer Certificate,
Migration Certificate, Category Certificate, Passport Photo, Aadhar Card,
Entrance Scorecard.

## 6. SMS provider (student OTP)

Wire your provider's real API into `src/lib/sms.js` → `sendSms()`.
Without `SMS_API_URL` set, dev mode logs the OTP to the console instead.

## 7. SMTP (staff 2-step email OTP)

Fill in `SMTP_HOST/PORT/USER/PASS` in `.env` — a Gmail app password works
for low volume; use a transactional provider (Resend/SES/SendGrid) if
volume grows. Without `SMTP_HOST` set, dev mode logs the code to console.

## 8. Staff/Admin login flow

```
POST /api/admin/login          { email, password }        -> { step: "OTP_REQUIRED" }
POST /api/admin/login/verify-otp { email, otp }            -> sets staff_token cookie
```

## 9. Idle auto-lock (staff/admin only, frontend responsibility)

- Admin sets the timeout: `PUT /api/admin/settings { "idleLockMinutes": 5 }`
- Frontend starts an idle timer on load; on timeout, show a lock overlay
  (session token stays valid, user just can't see/do anything)
- To resume: `POST /api/admin/unlock { password }` — re-checks the
  password only, does **not** issue a new token or require the email OTP
  again, so the user doesn't lose their place mid-task

## 10. File naming & file management

- `GET /api/admin/settings` returns the current `fileNameFormat` template,
  e.g. `{session}_{batch}_{admissionNo}_{docType}` — edit via
  `PUT /api/admin/settings { "fileNameFormat": "..." }`.
- This only changes the **downloaded** filename (`Content-Disposition`).
  Internal on-disk storage always uses random UUID-based names — that
  part is a security measure and is not admin-configurable.
- Admin (ADMIN role only) can:
  - `DELETE /api/admin/documents/:id` — deletes file + row, logged in `AdminFileLog`
  - `POST /api/admin/documents/:id/replace` (multipart `file`) — swaps the
    file for a student's existing document, logged in `AdminFileLog`

## 11. Block / unblock students

- Individual: `PATCH /api/admin/students/:id/block { blocked: true, reason }`
- Bulk: `POST /api/admin/students/bulk-block { studentIds: [...], blocked, reason }`
- A blocked student cannot request an OTP, log in, or upload — even mid-session.

## 12. Bulk status update

`POST /api/admin/students/bulk-status { studentIds: [...], status, note }`
alongside the existing individual `PATCH /api/admin/students/:id/status`.

## 13. Run

```bash
npm run dev     # local dev, auto-restart
npm start        # production
```

Put behind Nginx + Let's Encrypt — never expose Node directly.

## Security notes (do not skip)

- `UPLOAD_ROOT` must never be inside a static/public directory.
- Downloads only ever go through the authenticated, logged download route
  — there is intentionally no static file route for uploads.
- Files validated by MIME type **and** magic bytes; stored under random
  UUID names, scoped per-session-per-student on disk.
- Rotate `JWT_STUDENT_SECRET` / `JWT_STAFF_SECRET` if ever leaked.
- Staff login is 2-step (password + emailed OTP) by design — don't remove
  the second factor to "simplify" later without discussing the tradeoff.
