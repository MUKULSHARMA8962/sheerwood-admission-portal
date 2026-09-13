import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestMobileOtp } from "../services/api";
import { getAdmissionData, getStoredAdmissionId, withdrawParentalConsent } from "../services/admission";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import "./ConsentWithdrawal.css";

function savedParentMobile(data) {
  const guardians = data.guardians && typeof data.guardians === "object" ? data.guardians : {};
  return Object.values(guardians).find((guardian) => guardian?.mobile)?.mobile || "";
}

export default function ConsentWithdrawal() {
  const navigate = useNavigate();
  const { session } = useCognitoAuth();
  const applicationNumber = getStoredAdmissionId();
  const [mobile, setMobile] = useState(() => savedParentMobile(getAdmissionData()));
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  async function sendOtp() {
    if (!mobile.trim()) {
      setError("Enter the registered parent or guardian mobile number.");
      return;
    }
    setError("");
    setMessage("");
    setIsSendingOtp(true);
    try {
      const result = await requestMobileOtp(mobile);
      setMessage(`OTP sent. It expires in ${Math.round((result.expires_in || 300) / 60)} minutes.`);
    } catch (reason) {
      setError(reason.message || "OTP could not be sent. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function withdraw(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP sent to the registered mobile number.");
      return;
    }
    setError("");
    setIsWithdrawing(true);
    try {
      await withdrawParentalConsent(session?.accessToken, applicationNumber, { parent_mobile: mobile, otp });
      setMessage("Your consent withdrawal has been recorded. Access to data-dependent portal services may now be restricted; retained records will be handled according to legal requirements.");
      setOtp("");
    } catch (reason) {
      setError(reason.message || "Consent withdrawal could not be completed.");
    } finally {
      setIsWithdrawing(false);
    }
  }

  return <main className="withdrawal-page"><header><Link to="/new-user-dashboard">← Admission dashboard</Link><span>Sheerwood International School</span></header><section className="withdrawal-card"><p>PARENTAL / GUARDIAN CONSENT</p><h1>Withdraw Consent</h1><small>Application #{applicationNumber || "not found"}</small><div className="withdrawal-notice"><p>You may withdraw consent for processing your child's personal data at any time.</p><p>Please note: withdrawing consent may result in your child losing access to the school portal and related LMS services, because those services require the data described in the consent notice to function.</p></div><form onSubmit={withdraw}><label>Registered parent/guardian mobile number<input value={mobile} onChange={(event) => { setMobile(event.target.value); setError(""); }} inputMode="tel" autoComplete="tel" /></label><div className="withdrawal-otp"><button type="button" onClick={() => void sendOtp()} disabled={isSendingOtp || isWithdrawing}>{isSendingOtp ? "Sending OTP…" : "Send OTP"}</button><label>OTP verification<input value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit OTP" /></label></div>{message && <p className="withdrawal-message success" role="status">{message}</p>}{error && <p className="withdrawal-message error" role="alert">{error}</p>}<footer><button type="button" onClick={() => navigate("/new-user-dashboard")}>Cancel</button><button type="submit" disabled={!applicationNumber || isWithdrawing}>{isWithdrawing ? "Confirming withdrawal…" : "Confirm withdrawal"}</button></footer></form></section></main>;
}
