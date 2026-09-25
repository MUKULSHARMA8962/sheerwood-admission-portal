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

## Easebuzz registration-fee checkout

Set `EASEBUZZ_MERCHANT_KEY`, `EASEBUZZ_SALT`, `EASEBUZZ_ENV=test`,
`EASEBUZZ_CALLBACK_URL`, and `EASEBUZZ_FRONTEND_RETURN_URL` in the **server-only**
`backend/.env` (see `.env.example`). The Easebuzz dashboard login email is not
an API key. Obtain separate test/live merchant key and salt from the Easebuzz
dashboard, then switch to `EASEBUZZ_ENV=prod` only after a full test payment.
The callback URL must be a publicly reachable HTTPS URL ending in
`/api/payments/easebuzz/return`; the frontend return URL should end in
`/fee-payment?payment=returned`. Configure the optional S2S transaction webhook
in Easebuzz to POST to the public HTTPS URL
`/api/payments/easebuzz/webhook` on the API host.
For the confirmed production domain, use
`https://sheerwoodadmission.com/api/payments/easebuzz/return` and
`https://sheerwoodadmission.com/fee-payment?payment=returned` for those two
environment values; configure the webhook as
`https://sheerwoodadmission.com/api/payments/easebuzz/webhook`. The ignored
local `backend/.env` is not uploaded by Git, so set these values and the live
merchant key/salt separately in the production server's `backend/.env`, then
restart its FastAPI service. Never store the dashboard login password here.

The parent starts a hosted Easebuzz checkout via
`POST /api/applications/{application_number}/registration-fee/initiate`.
The server chooses the current admin-configured amount and stores a pending
transaction. The callback, webhook, and authenticated `verify` endpoint query
Easebuzz's transaction API before marking the application paid. The old direct
POST to `/registration-fee` now returns `410` and cannot mark an unpaid fee as
paid. Duplicate callbacks are idempotent. A new checkout is allowed after a
pending attempt is 20 minutes old; check the previous attempt first to avoid
accidental duplicate payments. A successful payment against an older attempt
is still recorded, so reconcile duplicates in the Easebuzz dashboard.

No live payment is made by the test suite. For production, perform a small
approved test transaction and verify the amount, application, webhook, browser
return, admin funnel, and Easebuzz dashboard match before accepting parents'
payments. Settlement/payout APIs are separate from fee collection and are not
needed for this checkout flow.

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

## Configure email delivery and OTP

The admission login and admission notifications use the same server-side mail
settings. To send through Gmail, enable 2-Step Verification for the sending
account, create a Google App Password, and set these values in `backend/.env`:

```dotenv
OTP_SECRET_KEY=replace-with-a-long-random-secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=yourgmail@gmail.com
SMTP_PASSWORD=your_google_app_password
SMTP_FROM_EMAIL=yourgmail@gmail.com
```

Use the complete Gmail address for both `SMTP_USERNAME` and `SMTP_FROM_EMAIL`.
Use the App Password for `SMTP_PASSWORD`, not the normal Google password. The
backend uses STARTTLS on port 587 automatically; `SMTP_USE_TLS` is not needed.
If `SMTP_FROM_EMAIL` is left blank, Gmail uses `SMTP_USERNAME` as the sender.
Keep the password only in `backend/.env` or your server's secret manager. After
updating the settings, restart the backend. The existing AWS SES configuration
can still be used by leaving `SMTP_HOST` blank or setting its SMTP credentials.

To send one test message using the same mail service as the portal, run this
from the `backend` directory (it sends a real email):

```bash
python send_gmail_test.py recipient@example.com
```

For another SMTP provider, set its host, username, password, and sender in
`backend/.env` (see `.env.example`). For example:

```bash
export SMTP_HOST="smtp.your-provider.com"
export SMTP_PORT="587"
export SMTP_USERNAME="your-smtp-username"
export SMTP_PASSWORD="your-smtp-app-password"
export SMTP_FROM_EMAIL="admissions@your-school.edu"
```

Optionally set `ADMISSION_NOTIFICATION_EMAILS` to additional comma-separated
addresses such as `admissions@your-school.edu,principal@your-school.edu`.

When Easebuzz confirms a registration payment, the portal sends a professional
confirmation to the parent's account email and a notification to every portal
user with the `admin` role. Use `ADMISSION_NOTIFICATION_EMAILS` for additional
admissions recipients who do not have a portal admin account. The parent
confirmation includes the application ID, paid amount, Easebuzz transaction
reference, and the next review step. The admissions notification also contains
the completed form. Both include PDF and PowerPoint (`.pptx`) application
attachments. Blank fields are marked "Not provided"; photographs and documents
are listed by filename and status. Original uploaded files remain in private
document storage and are not attached to the email. Email delivery is
best-effort: payment remains recorded even if the SMTP provider is temporarily
unavailable.

Endpoints:

- `POST /api/auth/otp/email/request` with `{ "email": "parent@example.com" }`
- `POST /api/auth/otp/email/verify` with `{ "email": "parent@example.com", "otp": "123456" }`

Email OTPs are securely generated, HMAC-hashed before storage, expire after five minutes, and are invalidated after successful verification or too many failed attempts.

## Vendor accounts

An admin can create vendor logins from **Admin → Vendors**. The portal sends the
new vendor a Cognito invitation email, assigns a unique referral ID, and
generates a link in this format:

```text
https://sheerwoodadmission.com/apply?source=vendor&referral_code=VENDOR001
```

Only applications that start from an active vendor link are attributed to that
vendor. Blocking a vendor disables both the Cognito login and its referral link;
it does not alter historical applications. The API credential used by the
backend must be allowed to create the `vendor` Cognito group and call
`AdminCreateUser`, `AdminAddUserToGroup`, `AdminEnableUser`, and
`AdminDisableUser`.

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
