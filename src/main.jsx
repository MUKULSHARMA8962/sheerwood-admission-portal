import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "react-oidc-context";
import { CognitoAuthProvider } from "./auth/AuthProvider";

const cognitoAuthConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY || "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PGsbC8UiT",
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID || "2oii9hos09ek2r06iasb4otbgg",
  redirect_uri: import.meta.env.VITE_COGNITO_REDIRECT_URI || `${window.location.origin}/`,
  response_type: "code",
  scope: import.meta.env.VITE_COGNITO_SCOPES || "email openid phone",
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider
      {...cognitoAuthConfig}
      onSigninCallback={() => window.history.replaceState({}, document.title, window.location.pathname)}
    >
      <CognitoAuthProvider>
        <App />
      </CognitoAuthProvider>
    </AuthProvider>
  </React.StrictMode>
);
