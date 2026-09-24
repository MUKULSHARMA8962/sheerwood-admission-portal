import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Fee_Payment.css";
import "./FeePaymentStatus.css";
import ParentalConsentModal from "../../components/ParentalConsentModal";
import { getAdmissionData, getStoredAdmissionId, getRegistrationFee, initiateRegistrationFeePayment, recordParentalConsent, verifyRegistrationFeePayment } from "../../services/admission";
import { useCognitoAuth } from "../../auth/useCognitoAuth";

export default function FeePayment() {
  const navigate = useNavigate();
  const { session } = useCognitoAuth();
  const [fee, setFee] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isConfirmingConsent, setIsConfirmingConsent] = useState(false);
  const applicationNumber = getStoredAdmissionId();
  const applicationData = getAdmissionData();

  useEffect(() => {
    if (!session?.accessToken || !applicationNumber) {
      setIsChecking(false);
      return;
    }
    let active = true;
    const returnedFromGateway = new URLSearchParams(window.location.search).get("payment") === "returned";
    const load = returnedFromGateway ? verifyRegistrationFeePayment : getRegistrationFee;
    load(session.accessToken, applicationNumber)
      .then((result) => {
        if (!active) return;
        setFee(result);
        if (result.registration_fee_status === "paid") {
          navigate("/application-success", { replace: true });
        } else if (returnedFromGateway) {
          setNotice(result.payment_status === "failed"
            ? "Payment was not completed. You can try again."
            : "Payment is not confirmed yet. Check status again before starting another payment.");
        }
      })
      .catch((reason) => { if (active) setError(reason.message || "Could not check payment status."); })
      .finally(() => { if (active) setIsChecking(false); });
    return () => { active = false; };
  }, [applicationNumber, navigate, session?.accessToken]);

  async function checkPayment() {
    setError("");
    setIsChecking(true);
    try {
      const result = await verifyRegistrationFeePayment(session?.accessToken, applicationNumber);
      setFee(result);
      if (result.registration_fee_status === "paid") navigate("/application-success", { replace: true });
      else setNotice("Easebuzz has not confirmed this payment yet. Please check again shortly.");
    } catch (reason) {
      setError(reason.message || "Could not verify the payment yet.");
    } finally {
      setIsChecking(false);
    }
  }

  async function payRegistrationFee() {
    setError("");
    setNotice("");
    setIsPaying(true);
    try {
      const result = await initiateRegistrationFeePayment(session?.accessToken, applicationNumber);
      if (result.registration_fee_status === "paid") {
        navigate("/application-success");
      } else if (result.checkout_url) {
        window.location.assign(result.checkout_url);
      } else {
        throw new Error("Easebuzz checkout link was not received.");
      }
    } catch (reason) {
      setError(reason.message || "Registration fee checkout could not be started.");
      setIsPaying(false);
    }
  }

  async function confirmConsent(consent) {
    setError("");
    setIsConfirmingConsent(true);
    try {
      await recordParentalConsent(session?.accessToken, applicationNumber, consent);
      setIsConsentOpen(false);
      await payRegistrationFee();
    } catch (reason) {
      setError(reason.message || "Consent could not be confirmed.");
    } finally {
      setIsConfirmingConsent(false);
    }
  }

  const amount = fee?.amount ? `₹ ${Number(fee.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "Loading…";

  return <main className="fee-page">
    <header className="fee-header"><Link className="fee-brand" to="/new-user-dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link><span>Secure payment <b>●</b></span></header>
    <section className="fee-shell">
      <div className="fee-heading"><p>APPLICATION # {applicationNumber || "ASSIGNED AFTER FIRST SAVE"}</p><h1>Fee Payment</h1><small>Complete your application fee to submit your admission request.</small></div>
      <div className="fee-content">
        <section className="fee-summary"><p>Registration Fee</p><strong>{amount}</strong><div><b>Amount due</b><span className="total"><i>Total Amount</i><em>{amount}</em></span></div></section>
        <section className="payment-methods"><h2>Pay securely with Easebuzz</h2><p>Card, UPI, net banking and other available methods can be selected on the Easebuzz checkout page.</p><p>Your fee is recorded only after payment confirmation.</p></section>
      </div>
      {notice && <p className="fee-notice" role="status">{notice}</p>}
      {error && <p className="fee-error" role="alert">{error}</p>}
      <footer className="fee-actions"><button onClick={() => navigate("/application/documents")}>← Back</button><div className="fee-action-right">{fee?.payment_status === "pending" && <button className="fee-check-button" onClick={checkPayment} disabled={isChecking}>{isChecking ? "Checking…" : "Check payment status"}</button>}<button onClick={() => setIsConsentOpen(true)} disabled={isChecking || isPaying || isConfirmingConsent || !fee?.amount || !fee?.can_retry}>{isPaying ? "Opening Easebuzz…" : "Proceed to Pay"} <span>→</span></button></div></footer>
    </section>
    {isConsentOpen && <ParentalConsentModal applicationData={applicationData} isConfirming={isConfirmingConsent} onClose={() => setIsConsentOpen(false)} onConfirm={confirmConsent} />}
  </main>;
}
