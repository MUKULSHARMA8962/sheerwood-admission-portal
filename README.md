# Sheerwood Admission Portal

## Frontend

```bash
npm install
npm run dev
```

## Cognito Hosted UI sign-in

The frontend uses `oidc-client-ts` through `react-oidc-context` with the authorization-code grant and PKCE. Copy `.env.example` to `.env` and set the Cognito authority, hosted domain, app-client ID, and exact callback/logout URLs. Never place an app-client secret in a `VITE_` variable.

For a public Cognito SPA app client (no secret), leave `VITE_COGNITO_TOKEN_EXCHANGE_URL` unset and the browser exchanges the PKCE code directly. For the existing confidential client `32616boac6m5uc0t5fob99i2sd`, set `VITE_COGNITO_TOKEN_EXCHANGE_URL=/api/auth/cognito/token`. The FastAPI API then exchanges the code with Cognito using the secret held only in `backend/.env`.

In the Cognito user-pool app client, select the Cognito user pool identity provider, enable the authorization-code OAuth flow, and select the `email`, `openid`, and `phone` scopes. Add only these exact production URLs to Cognito's allowed URLs:

- Development callback: `http://localhost:5173/`
- Production callback: `https://sheerwoodadmission.com/`
- Development logout: `http://localhost:5173/`
- Production logout: `https://sheerwoodadmission.com/`

Set the default redirect URL to `https://sheerwoodadmission.com/`. The OIDC provider handles the callback and then the app navigates to the role-specific dashboard; the configured value must match Cognito exactly.

Portal access is derived from `custom:role` or from Cognito groups named `parent`, `student`, `teacher`, and `admin`. The React app redirects users to the corresponding portal after Cognito returns to `/`. Logout clears the browser session and sends the user to Cognito's `/logout` endpoint.

The FastAPI backend can validate Cognito access tokens when `AUTH_MODE=cognito` is configured in `backend/.env`. It verifies the JWT signature against Cognito JWKS, issuer, expiry, `token_use=access`, and app-client ID before applying API role checks. See [backend/README.md](backend/README.md) for server configuration.

## Existing Nginx server: run the API continuously

If the Ubuntu server already serves the React site with Nginx, use this deployment path instead of Docker Compose. Do not start the included Caddy Docker gateway on the same server while Nginx owns ports `80` and `443`.

Create the isolated Python environment and install the API dependencies:

```bash
cd ~/sheerwood-admission-portal
sudo apt update
sudo apt install -y python3-venv
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -r backend/requirements.txt
test -f backend/.env || cp backend/.env.example backend/.env
```

Set the real Cognito client ID in `backend/.env`. For a confidential client, also set `COGNITO_DOMAIN`, `COGNITO_CLIENT_SECRET`, and the exact `COGNITO_REDIRECT_URI`; then install and start the always-on API service:

```bash
sudo cp deploy/sheerwood-api.service /etc/systemd/system/sheerwood-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now sheerwood-api
sudo systemctl status sheerwood-api --no-pager
curl http://127.0.0.1:8000/api/health
```

Build and publish the React UI after setting the public Cognito values in `.env.production`. Vite compiles these browser-safe `VITE_` values into the static files, so rerun this step whenever they change:

```bash
grep '^VITE_COGNITO_' .env.production
npm run build
sudo cp -a dist/. /var/www/html/
```

The build works whether or not the private `.openai/hosting.json` Sites metadata file is present. It is not required for this Nginx deployment.

The service listens only on `127.0.0.1:8000`; it is not publicly exposed. Add the API proxy to the existing HTTPS virtual host without replacing its React static-file configuration:

```bash
sudo cp deploy/nginx-api-proxy.conf /etc/nginx/snippets/sheerwood-api.conf
sudo grep -RIl "server_name.*sheerwoodadmission\\.com" /etc/nginx/sites-enabled /etc/nginx/conf.d
```

In the `server { ... }` block shown by the last command, add this line:

```nginx
include /etc/nginx/snippets/sheerwood-api.conf;
```

Ensure its existing React route has `try_files $uri $uri/ /index.html;` so the Cognito `/callback` route loads the SPA. Then validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl https://sheerwoodadmission.com/api/health
```

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
