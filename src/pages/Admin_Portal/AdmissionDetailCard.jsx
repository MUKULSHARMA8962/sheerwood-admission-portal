import { getApplicationStatusLabel, getDocumentStatusLabel } from "../../services/admission";
import AdmissionStageCards from "../AdmissionStageCards";
import "./AdmissionDetailCard.css";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function vendorName(application) {
  const names = { EDU001: "Edustoke", EZY001: "Ezyschooling", GLO001: "Global Education", HIP001: "Edhippo" };
  return application.vendor_name || names[application.vendor_id] || String(application.lead_source || "Direct / unknown").replaceAll("_", " ");
}

export default function AdmissionDetailCard({ application, onClose, onApprove, onApproveWithException, onReject, onPrint, saving, documentBusyId, onOpenDocument, onReviewDocument, onDeleteDocument }) {
  if (!application) return null;
  const requiredDocuments = application.document_summary?.required || 5;
  const verifiedDocuments = application.document_summary?.verified || 0;
  const pendingDocuments = Math.max(requiredDocuments - verifiedDocuments, 0);
  const isFinal = ["approved", "rejected"].includes(application.status);
  const isExceptionalApproval = Number(application.approval_exception) === 1;
  const canApprove = application.documents_status === "documents_verified" && !isFinal;
  const canApproveWithException = !isFinal && !canApprove;
  const approvalHint = isExceptionalApproval
    ? `Approved with exception. Reason: ${application.approval_exception_reason || application.admin_remark || "Not recorded"}.`
    : application.status === "approved"
      ? "This admission is already approved."
      : application.status === "rejected"
        ? "This admission has been rejected."
    : canApprove
      ? "All required documents are verified. You can approve this admission."
      : `Approve Admission unlocks after all required documents are verified (${verifiedDocuments}/${requiredDocuments} verified, ${pendingDocuments} remaining). An exception requires a recorded reason.`;

  return <div className="admin-admission-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-admission-detail-card" role="dialog" aria-modal="true" aria-labelledby="admin-admission-detail-title">
      <header className="admin-admission-detail-header">
        <div><p>APPLICANT DETAILS</p><h2 id="admin-admission-detail-title">{application.student_name || "Application in progress"}</h2><small>{application.application_number} · {application.desired_class || "Class not selected"}</small></div>
        <div className="admin-admission-detail-header-actions"><span>{getApplicationStatusLabel(application.status)}</span><button type="button" onClick={onClose} aria-label="Close applicant details">×</button></div>
      </header>

      <section className="admin-admission-detail-summary" aria-label="Application summary">
        <div><small>Parent</small><b>{application.parent_name || "Parent details pending"}</b><span>{application.parent_mobile || "Mobile not saved"}</span></div>
        <div><small>Vendor</small><b>{vendorName(application)}</b><span>{application.vendor_id || "No vendor ID"} · {application.campaign_id || "No campaign"}</span></div>
        <div><small>Documents</small><b>{application.document_summary?.uploaded || 0}/{application.document_summary?.required || 5} uploaded</b><span>{application.document_summary?.verified || 0}/{application.document_summary?.required || 5} verified</span></div>
        <div><small>Verification</small><b>{getApplicationStatusLabel(application.documents_status)}</b><span>{application.verification_date ? formatDate(application.verification_date) : "Awaiting review"}</span></div>
        <div><small>{isExceptionalApproval ? "Exception reason" : "Form submitted"}</small><b>{isExceptionalApproval ? "Approved with exception" : application.submitted_at ? "Yes" : "No"}</b><span>{isExceptionalApproval ? application.approval_exception_reason || application.admin_remark || "Not recorded" : application.submitted_at ? formatDate(application.submitted_at) : "Not submitted"}</span></div>
      </section>

      <div className="admin-admission-detail-body">
        <section className="admin-admission-detail-documents" aria-labelledby="admin-detail-documents-title"><header><div><p>DOCUMENT VERIFICATION</p><h3 id="admin-detail-documents-title">Uploaded documents</h3><small>Open a file to preview it, then verify, request a replacement, reject, or delete it.</small></div><span>{application.documents?.length || 0} uploaded</span></header>{application.documents?.length ? <div className="admin-admission-detail-document-list">{application.documents.map((document) => {
          const status = document.status_code || document.status;
          const busy = documentBusyId === document.id;
          return <article key={document.id}><div><b>{document.document_key.replaceAll("-", " ")}</b><small>{document.file_name}</small>{document.reason && <em>Remark: {document.reason}</em>}</div><span className={`admin-admission-detail-document-status is-${String(status || "pending").replaceAll("_", "-")}`}>{getDocumentStatusLabel(status)}</span><div className="admin-admission-detail-document-actions"><button type="button" onClick={() => onOpenDocument(document)} disabled={busy}>Open</button><button type="button" className="verify" onClick={() => onReviewDocument(document, "verified")} disabled={busy}>Verify</button><button type="button" onClick={() => onReviewDocument(document, "reupload_required")} disabled={busy}>Re-upload</button><button type="button" className="reject" onClick={() => onReviewDocument(document, "rejected")} disabled={busy}>Reject</button><button type="button" className="delete" onClick={() => onDeleteDocument(document)} disabled={busy}>Delete</button></div></article>;
        })}</div> : <p className="admin-admission-detail-no-documents">No documents are uploaded yet.</p>}</section>
        <AdmissionStageCards application={application} documents={application.documents || []} />
      </div>
      <footer><p className={canApprove || isExceptionalApproval ? "admin-admission-detail-approval-hint ready" : "admin-admission-detail-approval-hint"}>{approvalHint}</p><div><button type="button" className="admin-admission-detail-print" onClick={onPrint}>Print application</button><button type="button" className="admin-admission-detail-approve" onClick={onApprove} disabled={!canApprove || saving}>{saving ? "Saving…" : "Approve Admission"}</button>{canApproveWithException && <button type="button" className="admin-admission-detail-exception" onClick={onApproveWithException} disabled={saving}>{saving ? "Saving…" : "Approve with exception"}</button>}<button type="button" className="admin-admission-detail-reject" onClick={onReject} disabled={isFinal || saving}>Reject Application</button><button type="button" className="admin-admission-detail-close" onClick={onClose}>Close details</button></div></footer>
    </section>
  </div>;
}
