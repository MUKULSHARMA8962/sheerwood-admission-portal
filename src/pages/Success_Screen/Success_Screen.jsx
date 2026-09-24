import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Success_Screen.css";
import { getRegistrationFee, getStoredAdmissionId } from "../../services/admission";
import { useCognitoAuth } from "../../auth/useCognitoAuth";

export default function SuccessScreen() {
  const navigate = useNavigate();
  const { session } = useCognitoAuth();
  const applicationNumber = getStoredAdmissionId();
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.accessToken) return;
    if (!applicationNumber) {
      setError("Application number was not found. Open your application from the dashboard.");
      return;
    }
    let active = true;
    getRegistrationFee(session.accessToken, applicationNumber)
      .then((result) => {
        if (!active) return;
        if (result.registration_fee_status !== "paid") navigate("/fee-payment", { replace: true });
        else setPayment(result);
      })
      .catch((reason) => { if (active) setError(reason.message || "Payment status could not be checked."); });
    return () => { active = false; };
  }, [applicationNumber, navigate, session?.accessToken]);

  if (error) return <main className="success-page"><section className="success-card"><h1>Could not confirm payment</h1><p>{error}</p><button onClick={() => navigate("/fee-payment")}>Check payment status</button></section></main>;
  if (!payment) return <main className="success-page"><section className="success-card"><p>Confirming your application payment…</p></section></main>;

  return <main className="success-page"><section className="success-card">
    <div className="confetti" aria-hidden="true"><i>✦</i><i>◆</i><i>✦</i><i>●</i><i>◆</i><i>✦</i></div>
    <div className="success-check">✓</div>
    <h1>Application Submitted Successfully!</h1>
    <p>Your registration fee has been confirmed. We will review your application and get back to you soon.</p>
    <div className="success-number"><span>Application Number</span><strong>{applicationNumber}</strong></div>
    <div className="success-number"><span>Easebuzz Transaction ID</span><strong>{payment.txnid}</strong></div>
    <div className="success-actions"><button onClick={() => navigate("/consent-withdrawal")}>Manage consent</button><button onClick={() => navigate("/new-user-dashboard")}>▣ Go to Dashboard</button></div>
  </section></main>;
}
