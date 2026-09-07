import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  getAdmissionDocumentLabel,
  getAdmissionStatus,
  getApplicationStatusLabel,
  getDocumentStatusLabel,
  getNewAdmissionId,
} from "../services/admission";
import { useCognitoAuth } from "../auth/useCognitoAuth";
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

function documentStatusClass(status) {
  if (status === "submitted") return "pending";
  if (status === "reupload_required") return "re-upload-required";
  return String(status || "unknown").replaceAll("_", "-");
}

function documentStatusIcon(status) {
  if (status === "approved") return "✓";
  if (status === "reupload_required") return "!";
  return "◷";
}

export default function NewUserDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useCognitoAuth();
  const applicationId = getNewAdmissionId();
  const phone = location.state?.phone || "your verified mobile";
  const [liveStatus, setLiveStatus] = useState(null);
  const [isLiveStatusLoading, setIsLiveStatusLoading] = useState(true);
  const [liveStatusError, setLiveStatusError] = useState("");

  const loadLiveStatus = useCallback(async () => {
    if (!session?.accessToken) {
      setIsLiveStatusLoading(false);
      return;
    }

    setIsLiveStatusLoading(true);
    try {
      const nextStatus = await getAdmissionStatus(session.accessToken, applicationId);
      setLiveStatus(nextStatus);
      setLiveStatusError("");
    } catch (error) {
      setLiveStatusError(error.message || "Live status is temporarily unavailable.");
    } finally {
      setIsLiveStatusLoading(false);
    }
  }, [applicationId, session?.accessToken]);

  useEffect(() => {
    void loadLiveStatus();
    const refreshTimer = window.setInterval(loadLiveStatus, 15_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadLiveStatus]);

  const documents = liveStatus?.documents || [];
  const documentSummary = liveStatus?.document_summary || { uploaded: 0, approved: 0 };
  const approvedDocuments = documentSummary.approved;
  const uploadedDocuments = documentSummary.uploaded;
  const applicationStatus = liveStatus?.application?.status;
  const documentHeading = uploadedDocuments
    ? `${approvedDocuments} of ${uploadedDocuments} uploaded documents verified`
    : "No documents uploaded yet";
  const statusText = liveStatus
    ? getApplicationStatusLabel(applicationStatus)
    : isLiveStatusLoading ? "Checking live status…" : "Save your first draft";

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
        <header><div><p>LIVE DOCUMENT VERIFICATION</p><h2>{documentHeading}</h2></div><span className={`new-document-overall-status is-${String(applicationStatus || "not-started").replaceAll("_", "-")}`}>{statusText}</span></header>
        <p>These statuses come directly from your saved application and refresh automatically every 15 seconds.</p>
        {liveStatusError && <p className="new-document-live-error" role="status">{liveStatusError} We will try again automatically.</p>}
        <div className="new-document-list">
          {documents.map((document) => <article className={`status-${documentStatusClass(document.status)}`} key={document.id}><i>{documentStatusIcon(document.status)}</i><span><b>{getAdmissionDocumentLabel(document.document_key)}</b><small>{getDocumentStatusLabel(document.status)}</small><em className="new-document-file" title={document.file_name}>{document.file_name}</em>{document.reason && <em className="new-document-reason"><b>Admin note:</b> {document.reason}</em>}</span></article>)}
        </div>
        {!documents.length && !isLiveStatusLoading && <p className="new-document-empty">Upload documents in the Documents step. Once saved, each file and the admin verification result will appear here.</p>}
      </section>

      <section className="new-user-info-grid">
        <article><i>▤</i><div><h2>Save &amp; resume anytime</h2><p>Use your verified mobile number and OTP to continue this application later.</p></div></article>
        <article><i>⇧</i><div><h2>Keep documents ready</h2><p>Birth certificate, student photo, ID and previous-school records will be requested later.</p></div></article>
        <article><i>✦</i><div><h2>Need help?</h2><p>Our admissions team is available to help you at every step.</p></div></article>
      </section>
    </section>
  </main>;
}
