


import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import OidcReturnRedirect from "./routes/OidcReturnRedirect";
import { captureReferralAttribution } from "./services/admission";
import "./pages/AdmissionMobile.css";

export default function App() {
  useEffect(() => {
    captureReferralAttribution();
  }, []);

  return (
    <BrowserRouter>
      <OidcReturnRedirect />
      <AppRoutes />
    </BrowserRouter>
  );
}
