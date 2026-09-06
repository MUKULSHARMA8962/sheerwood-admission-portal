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
