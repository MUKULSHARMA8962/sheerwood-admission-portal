import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CognitoAuthProvider } from "./auth/AuthProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CognitoAuthProvider>
      <App />
    </CognitoAuthProvider>
  </React.StrictMode>
);
