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
