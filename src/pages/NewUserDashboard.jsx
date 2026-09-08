import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdmissionStatus, getApplicationStatusLabel, getDocumentStatusLabel, getNewAdmissionId } from "../services/admission";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import AdmissionStageCards from "./AdmissionStageCards";
import "./NewAdmissionDashboard.css";
import "./NewAdmissionDashboardLive.css";

const steps = ["OTP Verified", "Admission Details", "Student Details", "Parent Details", "Documents", "Verification", "Approval"];

function stageIndex(application) {
  if (!application) return 1;
  if (["approved", "rejected", "needs_information"].includes(application.status)) return 6;
  if (application.documents_status === "documents_verified") return 5;
  if (["uploaded", "under_verification", "reupload_required"].includes(application.documents_status)) return 4;
  return 4;
}

function Badge({ status, document = false }) {
  const normalizedStatus = document
    ? ({ submitted: "uploaded", approved: "verified" })[status] || status
    : status === "submitted" ? "pending" : status;
  const value = String(normalizedStatus || "pending");
  const label = document ? getDocumentStatusLabel(value) : getApplicationStatusLabel(value);
  return <span className={`admission-dashboard-badge ${value.replaceAll("_", "-")}`}>{label}</span>;
}

export default function NewUserDashboard() {
  const navigate = useNavigate();
  const { session, user } = useCognitoAuth();
  const [liveStatus, setLiveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const nextStatus = await getAdmissionStatus(session.accessToken, getNewAdmissionId());
      setLiveStatus(nextStatus);
      setLastUpdated(new Date());
    } catch (reason) {
      setError(reason.message || "Application status could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void loadStatus();
    const refreshTimer = window.setInterval(loadStatus, 15_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadStatus]);

  const application = liveStatus?.application || null;
  const summary = liveStatus?.document_summary || { required: 5, uploaded: 0, verified: 0 };
  const currentStage = stageIndex(application);
  const tableRows = useMemo(() => application ? [application] : [], [application]);

  const documentsNeedUpload = (summary.uploaded || 0) < (summary.required || 5);

  return <main className="new-admission-dashboard">
    <header className="new-admission-dashboard-header"><Link to="/" className="new-admission-dashboard-brand"><span>S</span><b>Sheerwood International School</b></Link><div><span>{user?.name || "Parent"}</span><button onClick={() => navigate("/admission-details")}>+ New Admission</button></div></header>
    <section className="new-admission-dashboard-shell">
      <header className="new-admission-dashboard-title"><div><p>NEW ADMISSION</p><h1>Admission Dashboard</h1><span>Track your application from document verification to final approval.</span><small className="new-admission-live-note"><i /> Live status {lastUpdated ? `updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "connecting…"}</small></div><button onClick={loadStatus} disabled={loading}>↻ Refresh</button></header>
      {error && <p className="new-admission-dashboard-error" role="alert">{error}</p>}
      <section className="new-admission-progress-card"><header><div><p>APPLICATION JOURNEY</p><h2>{application?.application_number || "Start your application"}</h2></div><Badge status={application?.status || "pending"} /></header><ol>{steps.map((step, index) => <li className={index < currentStage ? "complete" : index === currentStage ? "current" : ""} key={step}><i>{index < currentStage ? "✓" : index + 1}</i><span>{step}</span></li>)}</ol><div className="new-admission-status-metrics"><span><b>{summary.uploaded || 0}/{summary.required || 5}</b><small>Documents uploaded</small></span><span><b>{summary.verified || 0}/{summary.required || 5}</b><small>Documents verified</small></span><span><b>{summary.under_verification || 0}</b><small>Under review</small></span><span><b>{summary.reupload_required || 0}</b><small>Action needed</small></span></div><footer><div><b>{application ? "Application saved" : "Ready to begin"}</b><small>{application ? "Upload any pending documents, then the admissions team can verify them." : "Complete the Admission Details form to create your application."}</small></div><button onClick={() => navigate(application ? "/application/documents" : "/admission-details")}>{application ? (documentsNeedUpload ? "Upload documents" : "Manage documents") : "Start admission"} →</button></footer></section>
      <section className="new-admission-dashboard-table-card"><header><div><p>APPLICATIONS</p><h2>Your New Admission</h2></div><span>{loading ? "Loading…" : `${tableRows.length} application`}</span></header><div className="new-admission-dashboard-table-scroll"><table><thead><tr><th>Student Name</th><th>Admission No.</th><th>Class</th><th>Mobile</th><th>Documents</th><th>Document Verification</th><th>Admission Status</th><th>Action</th></tr></thead><tbody>{loading && <tr><td colSpan="8" className="new-admission-dashboard-empty">Loading your saved application…</td></tr>}{!loading && !tableRows.length && <tr><td colSpan="8" className="new-admission-dashboard-empty">No submitted application yet. Use “New Admission” to start.</td></tr>}{!loading && tableRows.map((item) => <tr key={item.application_number}><td><b>{item.student_name || "Application in progress"}</b></td><td>{item.application_number}</td><td>{item.desired_class || "—"}</td><td>{item.parent_mobile || "—"}</td><td>{summary.uploaded || 0}/{summary.required || 5} uploaded<br /><small>{summary.verified || 0}/{summary.required || 5} verified</small></td><td><Badge status={item.documents_status} document /></td><td><Badge status={item.status} /></td><td><button className="new-admission-view" onClick={() => navigate(documentsNeedUpload ? "/application/documents" : "/admission-details")}>{documentsNeedUpload ? "Upload documents" : "View"}</button></td></tr>)}</tbody></table></div></section>
      <AdmissionStageCards application={application} documents={liveStatus?.documents || []} />
      {liveStatus?.documents?.length > 0 && <section className="new-admission-document-list"><header><p>DOCUMENT STATUS</p><h2>Verification updates</h2></header>{liveStatus.documents.map((document) => <article key={document.id}><div><b>{document.document_key.replaceAll("-", " ")}</b><small>{document.file_name}</small>{document.reason && <small className="new-admission-document-reason">Admin remark: {document.reason}</small>}</div><Badge status={document.status} document /></article>)}</section>}
    </section>
  </main>;
}
