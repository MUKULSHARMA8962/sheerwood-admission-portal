import { getApplicationStatusLabel } from "../../services/admission";
import AdmissionStageCards from "../AdmissionStageCards";
import "./AdmissionDetailCard.css";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default function AdmissionDetailCard({ application, onClose, onOpenDocuments, onApprove, onReject, saving }) {
  if (!application) return null;
  const canApprove = application.documents_status === "documents_verified" && application.status !== "approved";

  return <div className="admin-admission-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-admission-detail-card" role="dialog" aria-modal="true" aria-labelledby="admin-admission-detail-title">
      <header className="admin-admission-detail-header">
        <div><p>APPLICANT DETAILS</p><h2 id="admin-admission-detail-title">{application.student_name || "Application in progress"}</h2><small>{application.application_number} · {application.desired_class || "Class not selected"}</small></div>
        <div className="admin-admission-detail-header-actions"><span>{getApplicationStatusLabel(application.status)}</span><button type="button" onClick={onClose} aria-label="Close applicant details">×</button></div>
      </header>

      <section className="admin-admission-detail-summary" aria-label="Application summary">
        <div><small>Parent</small><b>{application.parent_name || "Parent details pending"}</b><span>{application.parent_mobile || "Mobile not saved"}</span></div>
        <div><small>Documents</small><b>{application.document_summary?.uploaded || 0}/{application.document_summary?.required || 5} uploaded</b><span>{application.document_summary?.verified || 0}/{application.document_summary?.required || 5} verified</span></div>
        <div><small>Verification</small><b>{getApplicationStatusLabel(application.documents_status)}</b><span>{application.verification_date ? formatDate(application.verification_date) : "Awaiting review"}</span></div>
        <div><small>Application date</small><b>{formatDate(application.submitted_on)}</b><span>{application.admin_remark || "No admin remark"}</span></div>
      </section>

      <div className="admin-admission-detail-body"><AdmissionStageCards application={application} documents={application.documents || []} /></div>
      <footer><button type="button" className="admin-admission-detail-documents" onClick={onOpenDocuments}>Open Document Verification</button><button type="button" className="admin-admission-detail-approve" onClick={onApprove} disabled={!canApprove || saving}>{saving ? "Saving…" : "Approve Admission"}</button><button type="button" className="admin-admission-detail-reject" onClick={onReject} disabled={saving}>Reject Application</button><button type="button" className="admin-admission-detail-close" onClick={onClose}>Close details</button></footer>
    </section>
  </div>;
}
