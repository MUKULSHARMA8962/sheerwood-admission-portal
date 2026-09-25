import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteAdmissionDocument, getAdmissionDocumentFile, getApplicationStatusLabel, getCurrentAdmissionStatus, getDocumentStatusLabel, syncAdmissionDataFromDatabase } from "../services/admission";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import AccountMenu from "../components/AccountMenu";
import SchoolCrest from "../components/SchoolCrest";
import AdmissionStageCards from "./AdmissionStageCards";
import DocumentPreviewModal from "./DocumentPreviewModal";
import "./NewAdmissionDashboard.css";
import "./NewAdmissionDashboardLive.css";
import "./AdmissionDashboardMenu.css";

const steps = ["OTP Verified", "Admission Details", "Student Details", "Parent Details", "Documents", "Verification", "Approval"];

function stageIndex(application) {
  if (!application) return 1;
  if (["approved", "rejected"].includes(application.status)) return 6;
  const formData = application.form_data || {};
  const admission = formData.admissionDetails || {};
  const student = formData.student || {};
  const guardians = formData.guardians || {};
  const hasAdmissionDetails = admission.class && admission.class !== "Select class" && admission.currentClass && admission.currentClass !== "Select current class";
  const hasStudentDetails = student.firstName && student.lastName && student.birthDate && student.placeOfBirth && student.motherTongue && student.howHeard;
  const hasParentDetails = Object.values(guardians).some((guardian) => guardian?.fullName && guardian?.mobile && guardian?.email);
  if (!hasAdmissionDetails) return 1;
  if (!hasStudentDetails) return 2;
  if (!hasParentDetails) return 3;
  if (application.documents_status === "documents_verified") return 5;
  if (["uploaded", "under_verification", "reupload_required"].includes(application.documents_status)) return 4;
  return 4;
}

function applicationAction(application, summary) {
  if (!application) return { label: "Start admission", path: "/admission-details" };
  const formData = application.form_data || {};
  const admission = formData.admissionDetails || {};
  const student = formData.student || {};
  const guardians = formData.guardians || {};
  if (!admission.class || admission.class === "Select class" || !admission.currentClass || admission.currentClass === "Select current class") return { label: "Continue admission details", path: "/admission-details" };
  if (!student.firstName || !student.lastName || !student.birthDate || !student.placeOfBirth || !student.motherTongue || !student.howHeard) return { label: "Continue student details", path: "/student-information" };
  if (!Object.values(guardians).some((guardian) => guardian?.fullName && guardian?.mobile && guardian?.email)) return { label: "Continue parent details", path: "/parent-guardian" };
  return { label: (summary.uploaded || 0) < (summary.required || 5) ? "Upload documents" : "Manage documents", path: "/application/documents" };
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
  const [preview, setPreview] = useState(null);
  const [deletingDocument, setDeletingDocument] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const nextStatus = await getCurrentAdmissionStatus(session.accessToken);
      if (nextStatus?.application?.form_data) syncAdmissionDataFromDatabase(nextStatus.application.form_data);
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

  useEffect(() => () => {
    if (preview?.fileUrl) URL.revokeObjectURL(preview.fileUrl);
  }, [preview?.fileUrl]);

  const application = liveStatus?.application || null;
  const summary = liveStatus?.document_summary || { required: 5, uploaded: 0, verified: 0 };
  const currentStage = stageIndex(application);
  const tableRows = useMemo(() => application ? [application] : [], [application]);

  const nextAction = applicationAction(application, summary);
  const savedForm = application?.form_data || {};
  const savedStudent = savedForm.student || {};
  const savedAdmission = savedForm.admissionDetails || {};
  const savedGuardian = Object.values(savedForm.guardians || {}).find((guardian) => guardian?.fullName || guardian?.mobile) || {};

  async function openDocumentPreview(document) {
    if (!application?.application_number) return;
    setPreview({ document, loading: true, fileUrl: "", contentType: "", error: "" });
    try {
      const file = await getAdmissionDocumentFile(session?.accessToken, application.application_number, document.document_key);
      setPreview((current) => current?.document?.id === document.id ? {
        ...current,
        loading: false,
        fileUrl: URL.createObjectURL(file.blob),
        contentType: file.contentType,
      } : current);
    } catch (reason) {
      setPreview((current) => current?.document?.id === document.id ? { ...current, loading: false, error: reason.message || "Document could not be opened." } : current);
    }
  }

  function downloadPreview() {
    if (!preview?.fileUrl) return;
    const link = window.document.createElement("a");
    link.href = preview.fileUrl;
    link.download = preview.document.file_name || "admission-document";
    link.click();
  }

  async function deletePreviewDocument() {
    if (!preview?.document || !application?.application_number || !window.confirm(`Delete ${preview.document.file_name}? You can upload it again later.`)) return;
    setDeletingDocument(true);
    try {
      await deleteAdmissionDocument(session?.accessToken, application.application_number, preview.document.document_key);
      setPreview(null);
      await loadStatus();
    } catch (reason) {
      setPreview((current) => current ? { ...current, error: reason.message || "Document could not be deleted." } : current);
    } finally {
      setDeletingDocument(false);
    }
  }

  return <main className="new-admission-dashboard" id="admission-dashboard">
    <header className="new-admission-dashboard-header"><Link to="/" className="new-admission-dashboard-brand"><SchoolCrest /><b>Sheerwood International School</b></Link><div><span>{user?.name || "Parent"}</span><button onClick={() => navigate("/admission-details")}>+ New Admission</button><AccountMenu /></div></header>
    <nav className="new-admission-dashboard-menu" aria-label="Admission dashboard menu"><div><a href="#admission-dashboard" className="active">Overview</a><a href="#application-table">Application</a><a href="#filled-application-form">Filled Form</a><a href="#document-status">Documents &amp; Status</a></div><button type="button" onClick={() => navigate("/admission-details")}>Edit admission form</button></nav>
    <section className="new-admission-dashboard-shell">
      <header className="new-admission-dashboard-title"><div><p>NEW ADMISSION</p><h1>Admission Dashboard</h1><span>Track your application from document verification to final approval.</span><small className="new-admission-live-note"><i /> Live status {lastUpdated ? `updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "connecting…"}</small></div><button onClick={loadStatus} disabled={loading}>↻ Refresh</button></header>
      {error && <p className="new-admission-dashboard-error" role="alert">{error}</p>}
      <section className="new-admission-progress-card"><header><div><p>APPLICATION JOURNEY</p><h2>{application?.application_number || "No application started"}</h2></div>{application && <Badge status={application.status} />}</header><ol>{steps.map((step, index) => <li className={index < currentStage ? "complete" : index === currentStage ? "current" : ""} key={step}><i>{index < currentStage ? "✓" : index + 1}</i><span>{step}</span></li>)}</ol><div className="new-admission-status-metrics"><span><b>{summary.uploaded || 0}/{summary.required || 5}</b><small>Documents uploaded</small></span><span><b>{summary.verified || 0}/{summary.required || 5}</b><small>Documents verified</small></span><span><b>{summary.under_verification || 0}</b><small>Under review</small></span><span><b>{summary.reupload_required || 0}</b><small>Action needed</small></span></div><footer><div><b>{application ? "Application saved" : "Ready to begin"}</b><small>{application ? `Your next step: ${nextAction.label}.` : "Start your admission to receive an application number."}</small></div><button onClick={() => navigate(nextAction.path)}>{nextAction.label} →</button></footer></section>
      {application && <section className="new-admission-dashboard-saved-details" aria-label="Saved application details"><header><div><p>SAVED APPLICATION DETAILS</p><h2>What you have filled</h2></div><button type="button" onClick={() => document.getElementById("filled-application-form")?.scrollIntoView({ behavior: "smooth" })}>View all filled fields</button></header><div><span><small>Student</small><b>{[savedStudent.firstName, savedStudent.middleName, savedStudent.lastName].filter(Boolean).join(" ") || application.student_name || "Not filled"}</b></span><span><small>Class applying for</small><b>{savedAdmission.class || application.desired_class || "Not filled"}</b></span><span><small>Parent mobile</small><b>{savedGuardian.mobile || application.parent_mobile || "Not filled"}</b></span><span><small>Application number</small><b>{application.application_number}</b></span></div></section>}
      <span id="application-table" className="new-admission-dashboard-anchor" />
      <section className="new-admission-dashboard-table-card"><header><div><p>APPLICATIONS</p><h2>Your New Admission</h2></div><span>{loading ? "Loading…" : `${tableRows.length} application`}</span></header><div className="new-admission-dashboard-table-scroll"><table><thead><tr><th>Student Name</th><th>Admission No.</th><th>Class</th><th>Mobile</th><th>Documents</th><th>Document Verification</th><th>Admission Status</th><th>Action</th></tr></thead><tbody>{loading && <tr><td colSpan="8" className="new-admission-dashboard-empty">Loading your saved application…</td></tr>}{!loading && !tableRows.length && <tr><td colSpan="8" className="new-admission-dashboard-empty">No application is saved for this parent account. Start a new admission to receive an application number.</td></tr>}{!loading && tableRows.map((item) => <tr key={item.application_number}><td><b>{item.student_name || "Application in progress"}</b></td><td>{item.application_number}</td><td>{item.desired_class || "—"}</td><td>{item.parent_mobile || "—"}</td><td>{summary.uploaded || 0}/{summary.required || 5} uploaded<br /><small>{summary.verified || 0}/{summary.required || 5} verified</small></td><td><Badge status={item.documents_status} document /></td><td><Badge status={item.status} /></td><td><button className="new-admission-view" onClick={() => navigate(nextAction.path)}>{nextAction.label}</button></td></tr>)}</tbody></table></div></section>
      <AdmissionStageCards application={application} documents={liveStatus?.documents || []} />
      <span id="document-status" className="new-admission-dashboard-anchor" />
      {liveStatus?.documents?.length > 0 && <section className="new-admission-document-list"><header><div><p>DOCUMENT STATUS</p><h2>Verification updates</h2></div><small>Click a document to preview, replace, or delete it.</small></header>{liveStatus.documents.map((document) => <article key={document.id}><button type="button" className="new-admission-document-open" onClick={() => void openDocumentPreview(document)}><div><b>{document.document_key.replaceAll("-", " ")}</b><small>{document.file_name}</small>{document.reason && <small className="new-admission-document-reason">Admin remark: {document.reason}</small>}</div><Badge status={document.status} document /><span>Open preview →</span></button></article>)}</section>}
    </section>
    <DocumentPreviewModal preview={preview} deleting={deletingDocument} onClose={() => setPreview(null)} onDownload={downloadPreview} onReplace={() => { setPreview(null); navigate("/application/documents"); }} onDelete={() => void deletePreviewDocument()} />
  </main>;
}
