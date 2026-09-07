


import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import OidcReturnRedirect from "./routes/OidcReturnRedirect";
import "./pages/AdmissionMobile.css";

export default function App() {
  return (
    <BrowserRouter>
      <OidcReturnRedirect />
      <AppRoutes />
    </BrowserRouter>
  );
}
