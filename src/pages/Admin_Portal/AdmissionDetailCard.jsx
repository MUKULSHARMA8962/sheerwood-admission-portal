import { getApplicationStatusLabel, getDocumentStatusLabel } from "../../services/admission";
import AdmissionStageCards from "../AdmissionStageCards";
import "./AdmissionDetailCard.css";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default function AdmissionDetailCard({ application, onClose, onApprove, onReject, saving, documentBusyId, onOpenDocument, onReviewDocument, onDeleteDocument }) {
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

      <div className="admin-admission-detail-body">
        <section className="admin-admission-detail-documents" aria-labelledby="admin-detail-documents-title"><header><div><p>DOCUMENT VERIFICATION</p><h3 id="admin-detail-documents-title">Uploaded documents</h3><small>Open a file to preview it, then verify, request a replacement, reject, or delete it.</small></div><span>{application.documents?.length || 0} uploaded</span></header>{application.documents?.length ? <div className="admin-admission-detail-document-list">{application.documents.map((document) => {
          const status = document.status_code || document.status;
          const busy = documentBusyId === document.id;
          return <article key={document.id}><div><b>{document.document_key.replaceAll("-", " ")}</b><small>{document.file_name}</small>{document.reason && <em>Remark: {document.reason}</em>}</div><span className={`admin-admission-detail-document-status is-${String(status || "pending").replaceAll("_", "-")}`}>{getDocumentStatusLabel(status)}</span><div className="admin-admission-detail-document-actions"><button type="button" onClick={() => onOpenDocument(document)} disabled={busy}>Open</button><button type="button" className="verify" onClick={() => onReviewDocument(document, "verified")} disabled={busy}>Verify</button><button type="button" onClick={() => onReviewDocument(document, "reupload_required")} disabled={busy}>Re-upload</button><button type="button" className="reject" onClick={() => onReviewDocument(document, "rejected")} disabled={busy}>Reject</button><button type="button" className="delete" onClick={() => onDeleteDocument(document)} disabled={busy}>Delete</button></div></article>;
        })}</div> : <p className="admin-admission-detail-no-documents">No documents are uploaded yet.</p>}</section>
        <AdmissionStageCards application={application} documents={application.documents || []} />
      </div>
      <footer><button type="button" className="admin-admission-detail-approve" onClick={onApprove} disabled={!canApprove || saving}>{saving ? "Saving…" : "Approve Admission"}</button><button type="button" className="admin-admission-detail-reject" onClick={onReject} disabled={saving}>Reject Application</button><button type="button" className="admin-admission-detail-close" onClick={onClose}>Close details</button></footer>
    </section>
  </div>;
}
