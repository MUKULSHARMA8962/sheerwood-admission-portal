import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Success_Screen.css";
import { getStoredAdmissionId } from "../../services/admission";

export default function SuccessScreen() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const applicationNumber = getStoredAdmissionId();
  return <main className="success-page"><section className="success-card"><div className="confetti" aria-hidden="true"><i>✦</i><i>◆</i><i>✦</i><i>●</i><i>◆</i><i>✦</i></div><div className="success-check">✓</div><h1>Application Submitted Successfully!</h1><p>Your application has been submitted. We will review it and get back to you soon.</p><div className="success-number"><span>Application Number</span><strong>{applicationNumber || "Assigned after first save"}</strong></div>{notice && <div className="receipt-notice">{notice}</div>}<div className="success-actions"><button onClick={() => setNotice("Your receipt download has started.")}>⇩ Download Receipt</button><button onClick={() => navigate("/consent-withdrawal")}>Manage consent</button><button onClick={() => navigate("/new-user-dashboard")}>▣ Go to Dashboard</button></div></section></main>;
}
