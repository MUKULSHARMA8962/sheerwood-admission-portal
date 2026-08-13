import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAdmissionDocuments, getNewAdmissionId } from "../services/admission";
import "./NewUserDashboard.css";
import "./DocumentVerification.css";

const journey = [
  ["✓", "OTP Verified", "done"],
  ["2", "Admission Details", "current"],
  ["3", "Student Details", "pending"],
  ["4", "Parent Details", "pending"],
  ["5", "Documents", "pending"],
  ["6", "Verification", "pending"],
  ["7", "Approval", "pending"],
];

export default function NewUserDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const applicationId = getNewAdmissionId();
  const phone = location.state?.phone || "your verified mobile";
  const documents = getAdmissionDocuments();
  const approvedDocuments = documents.filter((document) => document.status === "Approved").length;

  return <main className="new-user-page">
    <header className="new-user-header">
      <Link className="new-user-brand" to="/"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link>
      <div><span>NEW ADMISSION</span><b>Mobile verified ✓</b></div>
    </header>

    <section className="new-user-shell">
      <div className="new-user-welcome"><div><p>WELCOME TO SHEERWOOD ADMISSIONS</p><h1>Your application<br /><em>starts here.</em></h1><span>We have created a secure application space for you. Complete each step and return anytime to continue.</span></div><i>✓</i></div>

      <section className="new-user-status-card">
        <header><div><span>APPLICATION CREATED</span><h2>{applicationId}</h2><p>Your mobile number <b>{phone}</b> is verified.</p></div><b className="new-user-progress">14%<small>Complete</small></b></header>
        <ol className="new-user-journey" aria-label="Admission application progress">
          {journey.map(([number, title, status]) => <li className={status} key={title}><i>{number}</i><span>{title}</span></li>)}
        </ol>
        <footer><div><span>NEXT ACTION</span><b>Complete Admission Details</b><small>Add class, campus and previous-school information to begin.</small></div><button onClick={() => navigate("/admission-details")}>Start Admission Details <span>→</span></button></footer>
      </section>

      <section className="new-document-card">
        <header><div><p>DOCUMENT VERIFICATION</p><h2>{approvedDocuments} of {documents.length} documents approved</h2></div><span>{approvedDocuments === documents.length ? "Documents verified ✓" : "Team review in progress"}</span></header>
        <p>Our admissions team will approve each document or request a replacement if something needs correction.</p>
        <div className="new-document-list">
          {documents.map((document) => <article className={`status-${document.status.toLowerCase().replaceAll(" ", "-")}`} key={document.id}><i>{document.status === "Approved" ? "✓" : document.status === "Re-upload Required" ? "!" : "◷"}</i><span><b>{document.name}</b><small>{document.status}</small>{document.reason && <em>{document.reason}</em>}</span></article>)}
        </div>
      </section>

      <section className="new-user-info-grid">
        <article><i>▤</i><div><h2>Save &amp; resume anytime</h2><p>Use your verified mobile number and OTP to continue this application later.</p></div></article>
        <article><i>⇧</i><div><h2>Keep documents ready</h2><p>Birth certificate, student photo, ID and previous-school records will be requested later.</p></div></article>
        <article><i>✦</i><div><h2>Need help?</h2><p>Our admissions team is available to help you at every step.</p></div></article>
      </section>
    </section>
  </main>;
}
