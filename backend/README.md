# Sheerwood FastAPI backend

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open API documentation at `http://localhost:8000/docs` and the health check at `http://localhost:8000/api/health`.

## Configure AWS RDS PostgreSQL

The API now supports PostgreSQL and automatically creates its schema when it
starts. Copy `backend/.env.example` to `backend/.env` and provide the RDS
database name, username and password; the endpoint and port are already set:

```dotenv
POSTGRES_HOST=database-1.c0164k0cckzv.us-east-1.rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_rds_password
POSTGRES_SSLMODE=verify-full
POSTGRES_SSLROOTCERT=/certs/global-bundle.pem
```

`DATABASE_URL` is also supported and takes precedence over the individual
`POSTGRES_*` values. Keep all database credentials in `backend/.env` or the
server's secret manager—never in React `VITE_` variables.

The Docker image includes AWS's RDS global CA bundle at
`/certs/global-bundle.pem`. For a local API process, download it and point
`POSTGRES_SSLROOTCERT` to the downloaded file:

```bash
curl -o global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

The RDS security group must allow TCP `5432` from the API server (or its
security group). The endpoint is currently not publicly reachable from this
development machine, so deploy the API in the permitted network or add the
server's source to that inbound rule.

### Portal tables

The API creates these operational tables at startup: `new_admissions`,
`teachers`, `students`, and `admins`. The admission form's visible fields—
academic session, class, PEN number, previous school, current class, board and
medium—are stored as named `new_admissions` columns. The full multi-step form
payload and document list are also retained as JSON in the same row.

### Admission document storage

Actual admission files (PDF, JPG and PNG) are stored in the private
`admission_documents` table as database binary data. Every upload is limited to
5 MB by default, type-checked on the server, linked to the authenticated
parent's application, and can only be downloaded through the authenticated API.
Set `MAX_ADMISSION_DOCUMENT_BYTES` in `backend/.env` to change the limit.

Document verification and admission decisions are database-backed:

- Parents read their live document and approval state through
  `GET /api/applications/{application_number}/status`.
- Admins review the queue with `GET /api/admin/documents`, download a stored
  file with `GET /api/admin/documents/{document_id}/download`, and persist a
  decision with `PATCH /api/admin/documents/{document_id}`.
- Admin final decisions use `PATCH /api/applications/{application_id}/decision`.

The parent-facing Admission Details and New User Dashboard refresh these
statuses automatically. Parent draft saves do not overwrite an admin's final
approval/rejection or document-review state.

## Configure Sheerwood AI

Create `backend/.env` from `.env.example`, then add an OpenAI API key **only** in that server-side file:

```bash
export OPENAI_API_KEY="your_openai_api_key"
export OPENAI_MODEL="gpt-5"
uvicorn app.main:app --reload --port 8000
```

The browser calls `POST /api/ai/chat`; FastAPI calls OpenAI, so the API key is never sent to React. The general admissions chat has a small in-memory rate limit for development. For production, add authentication, CAPTCHA and a shared rate limiter such as Redis before making a public endpoint available.

The first startup creates `sheerwood.db` and seeds these demo users:

## Configure AWS SMS OTP

The mobile OTP endpoints require an AWS IAM role or credentials with permission to publish transactional SMS through Amazon SNS. Set these only on the server:

```bash
export AWS_REGION="us-east-1"
export OTP_SECRET_KEY="replace-with-a-long-random-secret"
```

Install the updated dependencies and restart the API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Endpoints:

- `POST /api/auth/otp/request` with `{ "phone_number": "+919876543210" }`
- `POST /api/auth/otp/verify` with `{ "phone_number": "+919876543210", "otp": "123456" }`

OTP codes are generated securely, hashed before storage, expire in five minutes, can only be used once, and have request/attempt rate limits. AWS SMS account, sender and India regulatory requirements must be approved before messages can be delivered.

## Configure Cognito access-token validation

The React app signs users in through Cognito Hosted UI. The FastAPI API validates the resulting **access token** using Cognito's public JWKS.

Copy the Cognito values from `.env.example` into `backend/.env` and run with `AUTH_MODE=cognito`:

```bash
AUTH_MODE=cognito
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PGsbC8UiT
COGNITO_CLIENT_ID=your_cognito_app_client_id
```

API authorization accepts roles from `custom:role` or Cognito groups named `parent`, `teacher`, `admin`, and `student`; a user without one receives `COGNITO_DEFAULT_ROLE` (parent by default). The first non-student sign-in links or creates the local profile using the Cognito `sub`, so future requests do not rely on matching an unverified email.

For a public SPA app client with no secret, React exchanges the PKCE code directly. For the confidential client `32616boac6m5uc0t5fob99i2sd`, configure this API instead and put the secret in `backend/.env` only:

```bash
COGNITO_DOMAIN=https://us-east-1yuxks7ixd.auth.us-east-1.amazoncognito.com
COGNITO_CLIENT_SECRET=your_actual_cognito_app_client_secret
COGNITO_REDIRECT_URI=https://sheerwoodadmission.com/callback
```

Then set `VITE_COGNITO_TOKEN_EXCHANGE_URL=/api/auth/cognito/token` in the frontend production environment and rebuild React. The browser sends the authorization code and PKCE verifier to the same-origin API; only the API sends the confidential secret to Cognito. The old seeded username/password endpoints remain only when `AUTH_MODE=local`. Do not use local mode in production.

## Configure email OTP

The admission login now supports email OTP. Add SMTP details to `backend/.env` (see `.env.example`):

```bash
export OTP_SECRET_KEY="replace-with-a-long-random-secret"
export SMTP_HOST="smtp.your-provider.com"
export SMTP_PORT="587"
export SMTP_USE_TLS="true"
export SMTP_USERNAME="your-smtp-username"
export SMTP_PASSWORD="your-smtp-app-password"
export SMTP_FROM_EMAIL="admissions@your-school.edu"
export ADMISSION_NOTIFICATION_EMAILS="admissions@your-school.edu,principal@your-school.edu"
```

When a parent submits an admission application, the portal sends a confirmation
to the parent's account email and a notification to every portal user with the
`admin` role. Use `ADMISSION_NOTIFICATION_EMAILS` for additional admissions
recipients who do not have a portal admin account. Email delivery is best-effort:
the application saves successfully even if the SMTP provider is temporarily unavailable.

Endpoints:

- `POST /api/auth/otp/email/request` with `{ "email": "parent@example.com" }`
- `POST /api/auth/otp/email/verify` with `{ "email": "parent@example.com", "otp": "123456" }`

Email OTPs are securely generated, HMAC-hashed before storage, expire after five minutes, and are invalidated after successful verification or too many failed attempts.

| Role | Email | Password |
| --- | --- | --- |
| Parent | `rajesh.sharma@demo.edu` | `Parent@123` |
| Teacher | `meera.kapoor@demo.edu` | `Teacher@123` |
| Admin | `admin@demo.edu` | `Admin@123` |

## Included API modules

- Parent registration and role-aware login/logout (`/api/auth/*`)
- Current-user session endpoint (`/api/auth/me`)
- Parent, teacher and admin dashboard summaries (`/api/dashboard/{role}`)
- Applications and admin decisions (`/api/applications`)
- Student, teacher and document records (`/api/students`, `/api/teachers`, `/api/documents`)

## Page-based UI API groups

The portal-specific endpoints are organised separately and appear as **Parent UI**, **Teacher UI** and **Admin UI** in Swagger.

- Parent: `/api/parent/dashboard` (includes admission approval and document-upload summary), `/api/parent/notices`, `/api/parent/profile`
- Teacher: `/api/teacher/dashboard`, `/classes`, `/students`, `/attendance`, `/assignments`, `/marks`, `/materials`, `/timetable`, `/messages`, `/announcements`, `/leaves`, `/ai`
- Admin: `/api/admin/dashboard`, `/admissions`, `/students`, `/teachers`, `/classes`, `/attendance`, `/fees`, `/exams`, `/timetable`, `/documents`, `/transport-hostel`, `/parents`, `/notifications`, `/reports`, `/users-roles`, `/settings`, `/ai`
- AI Assistant: `POST /api/ai/chat` with `{ "prompt": "...", "audience": "guest" }`

All page endpoints are role-protected. First call `POST /api/auth/login`, then include the returned token in every request:

```http
Authorization: Bearer <access_token>
```

Use the token from login as `Authorization: Bearer <access_token>` for protected endpoints.
