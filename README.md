# Sheerwood Admission Portal

## Frontend

```bash
npm install
npm run dev
```

## Cognito Hosted UI sign-in

Copy `.env.example` to `.env` and set the Cognito domain and the **public** app-client ID. The app uses the authorization-code grant with PKCE; do not create an app client secret for this browser client and never place a secret in a `VITE_` variable. The client ID from a Flask confidential-client example can only be used here if that Cognito app client has no secret; otherwise create a separate public SPA app client.

In the Cognito user-pool app client, enable the authorization-code OAuth flow and the `openid`, `email`, and `phone` scopes. Add the exact redirect and sign-out values to Cognito's allowed URLs:

- Development: `http://localhost:5173/callback` and `http://localhost:5173/`
- Production: `https://YOUR-PORTAL-DOMAIN/callback` and `https://YOUR-PORTAL-DOMAIN/`

If your Cognito app client is already configured with the supplied `https://sheerwoodadmission.com/callback` URL, set `VITE_COGNITO_REDIRECT_URI=https://sheerwoodadmission.com/callback`. Both `/callback` and `/auth/callback` are handled by the React app, but the configured value must match Cognito exactly.

Portal access is derived from `custom:role` or from Cognito groups named `parent`, `student`, `teacher`, and `admin`. The React app redirects users to the corresponding portal after Cognito returns to `/callback`. Logout clears the browser session and sends the user to Cognito's `/logout` endpoint.

The FastAPI backend can validate Cognito access tokens when `AUTH_MODE=cognito` is configured in `backend/.env`. It verifies the JWT signature against Cognito JWKS, issuer, expiry, `token_use=access`, and app-client ID before applying API role checks. See [backend/README.md](backend/README.md) for server configuration.

## Run UI and API continuously on Ubuntu with Docker

The included Docker Compose setup runs three services: the React UI, the internal FastAPI API, and a Caddy HTTPS gateway. The API is reachable only through the UI gateway at `/api`, and its SQLite database is kept in a persistent Docker volume. All services use `restart: unless-stopped`, so they return after a server or Docker restart.

Before the first launch, point the DNS `A` record for `sheerwoodadmission.com` at the Ubuntu server's public IP and allow inbound TCP ports `80` and `443` in the server firewall or cloud security group. Ensure no existing Nginx or Apache service is using those ports; Caddy obtains and renews the TLS certificate automatically.

On the Ubuntu server, install Docker Engine with the Docker Compose v2 plugin, then configure the two ignored environment files:

```bash
cd ~/sheerwood-admission-portal
cp deploy/production.env.example .env.production
test -f backend/.env || cp backend/.env.example backend/.env
```

Edit `.env.production` and set the public Cognito client ID. Edit `backend/.env` and set the same `COGNITO_CLIENT_ID`, plus any required OpenAI, SMTP, AWS SMS, and OTP values. Keep app-client and API secrets in `backend/.env` only; never put them in `.env.production`.

Start everything and enable Docker to start at reboot:

```bash
sudo systemctl enable --now docker
sudo docker compose --env-file .env.production up -d --build
sudo docker compose --env-file .env.production ps
```

The portal is then available at `https://sheerwoodadmission.com`, the API health check at `https://sheerwoodadmission.com/api/health`, and OpenAPI documentation at `https://sheerwoodadmission.com/docs`.

Useful operations:

```bash
sudo docker compose --env-file .env.production logs -f
sudo docker compose --env-file .env.production up -d --build
sudo docker compose --env-file .env.production down
```

The first command follows logs; the second rebuilds and safely replaces services after a code update. Do not use `down -v` unless the saved API database is intentionally being deleted.

## FastAPI backend

The FastAPI backend lives in [backend](backend/README.md). Run it on port `8000` to use the Vite `/api` development proxy:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: `http://localhost:8000/docs`.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
