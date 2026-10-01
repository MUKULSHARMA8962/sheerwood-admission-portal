import { useCallback, useEffect, useMemo, useState } from "react";
import { decideAdminAdmission, deleteAdminAdmission, deleteAdminDocument, downloadAdminDocument, getAdminAdmissionPayments, getAdminAdmissions, reviewAdminDocument } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import AdmissionDetailCard from "./AdmissionDetailCard";
import PaymentDetailsModal from "./PaymentDetailsModal";
import DocumentPreviewModal from "../DocumentPreviewModal";
import { applicationPrintHtml, blobToDataUrl } from "./printApplication";
import "./NewAdmissionTable.css";

const statusLabels = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  submitted: "Pending",
  uploaded: "Uploaded",
  under_verification: "Under Verification",
  verified: "Verified",
  documents_verified: "Documents Verified",
  approved: "Approved",
  approve_with_exception: "Approved with exception",
  needs_information: "Needs Information",
  reupload_required: "Re-upload Required",
  rejected: "Rejected",
  draft: "Draft",
};
const pageSizeOptions = [20, 50, 100, 200, 300, 400, 500, 1000];

function label(value) {
  return statusLabels[value] || String(value || "pending").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function sourceLabel(value) {
  return String(value || "Direct / unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function vendorName(application) {
  const names = { EDU001: "Edustoke", EZY001: "Ezyschooling", GLO001: "Global Education", HIP001: "Edhippo" };
  return application.vendor_name || names[application.vendor_id] || sourceLabel(application.lead_source);
}

function parentDisplayName(value) {
  const name = String(value || "").trim();
  const cognitoSubject = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  return !name || cognitoSubject.test(name) ? "Parent details pending" : name;
}

function Badge({ value, exceptionalApproval = false }) {
  const normalizedValue = value === "submitted" ? "pending" : value;
  const displayValue = exceptionalApproval && normalizedValue === "approved" ? "approve_with_exception" : normalizedValue;
  return <span className={`new-admission-badge ${String(normalizedValue || "pending").replaceAll("_", "-")}`}>{label(displayValue)}</span>;
}

export default function NewAdmissionTable({ setNotice }) {
  const { session } = useCognitoAuth();
  const [applications, setApplications] = useState([]);
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentBusyId, setDocumentBusyId] = useState(null);

  const loadApplications = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminAdmissions(session.accessToken);
      const normalized = Array.isArray(data) ? data : [];
      setApplications(normalized);
      return normalized;
    } catch (reason) {
      setError(reason.message || "Admissions could not be loaded.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  useEffect(() => () => {
    if (documentPreview?.fileUrl) URL.revokeObjectURL(documentPreview.fileUrl);
  }, [documentPreview?.fileUrl]);

  const visibleApplications = useMemo(() => applications.filter((application) => {
    const searchable = [application.application_number, application.student_name, application.parent_name, application.parent_mobile, application.desired_class, application.lead_source, application.vendor_id, application.campaign_id].join(" ").toLowerCase();
    const matchesSearch = searchable.includes(query.trim().toLowerCase());
    const matchesVendor = vendorFilter === "all" || application.vendor_id === vendorFilter;
    return matchesSearch && matchesVendor;
  }), [applications, query, vendorFilter]);

  useEffect(() => { setPage(1); }, [query, vendorFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(visibleApplications.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstVisibleRow = visibleApplications.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisibleRow = Math.min(currentPage * pageSize, visibleApplications.length);
  const paginatedApplications = useMemo(() => visibleApplications.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, pageSize, visibleApplications]);

  const vendorOptions = useMemo(() => {
    const sources = new Map([["DIRECT", "Direct Website"]]);
    applications.forEach((application) => {
      const id = application.vendor_id || "DIRECT";
      sources.set(id, vendorName(application));
    });
    return [["all", "All vendors"], ...Array.from(sources.entries()).sort(([first], [second]) => first.localeCompare(second))];
  }, [applications]);

  async function updateAdmission(application, decision, options = {}) {
    if (!session?.accessToken || savingId) return;
    setSavingId(application.id);
    setError("");
    try {
      const updated = await decideAdminAdmission(session.accessToken, application.id, decision, options);
      setApplications((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setSelectedApplication((current) => current?.id === updated.id ? { ...current, ...updated } : current);
      setNotice(`${application.student_name || "Applicant"}: ${label(decision)} saved.`);
      const refreshed = await loadApplications();
      const refreshedApplication = refreshed.find((item) => item.id === application.id);
      if (refreshedApplication) setSelectedApplication(refreshedApplication);
    } catch (reason) {
      setError(reason.message || "The admission could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  function approve(application) {
    const classSection = window.prompt("Class allocation", application.class_section || application.desired_class || "");
    if (classSection === null || !classSection.trim()) return;
    const sectionAllocation = window.prompt("Section allocation (for example, A)", application.section_allocation || "");
    if (sectionAllocation === null || !sectionAllocation.trim()) return;
    void updateAdmission(application, "approved", { classSection: classSection.trim(), sectionAllocation: sectionAllocation.trim() });
  }

  function approveWithException(application) {
    const classSection = window.prompt("Class allocation", application.class_section || application.desired_class || "");
    if (classSection === null || !classSection.trim()) return;
    const sectionAllocation = window.prompt("Section allocation (for example, A)", application.section_allocation || "");
    if (sectionAllocation === null || !sectionAllocation.trim()) return;
    const adminRemark = window.prompt("Reason for exceptional approval (required)", application.approval_exception_reason || "");
    if (adminRemark === null) return;
    if (!adminRemark.trim()) {
      setError("A reason is required to approve an admission with exception.");
      return;
    }
    void updateAdmission(application, "approve_with_exception", {
      classSection: classSection.trim(),
      sectionAllocation: sectionAllocation.trim(),
      adminRemark: adminRemark.trim(),
    });
  }

  async function deleteAdmission(application) {
    if (!session?.accessToken || savingId) return;
    const applicationName = application.student_name || application.application_number || "this application";
    if (!window.confirm(`Delete ${applicationName}? This permanently removes the admission application and all of its uploaded documents.`)) return;

    setSavingId(application.id);
    setError("");
    try {
      await deleteAdminAdmission(session.accessToken, application.id);
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setSelectedApplication((current) => current?.id === application.id ? null : current);
      setNotice(`${applicationName}: admission application deleted.`);
    } catch (reason) {
      setError(reason.message || "The admission application could not be deleted.");
    } finally {
      setSavingId(null);
    }
  }

  async function openPaymentDetails(application) {
    if (!session?.accessToken) return;
    setPaymentDetail({ application, data: null, loading: true, error: "" });
    try {
      const data = await getAdminAdmissionPayments(session.accessToken, application.id);
      setPaymentDetail((current) => current?.application.id === application.id ? { ...current, data, loading: false } : current);
    } catch (reason) {
      setPaymentDetail((current) => current?.application.id === application.id ? { ...current, loading: false, error: reason.message || "Payment details could not be loaded." } : current);
    }
  }

  async function refreshSelectedApplication(applicationNumber) {
    const refreshed = await loadApplications();
    const refreshedApplication = refreshed.find((item) => item.application_number === applicationNumber);
    if (refreshedApplication) setSelectedApplication(refreshedApplication);
  }

  async function openDocumentPreview(document) {
    if (!session?.accessToken) return;
    setDocumentPreview({ document, loading: true, fileUrl: "", contentType: "", error: "" });
    try {
      const { blob } = await downloadAdminDocument(session.accessToken, document.id, document.file_name);
      setDocumentPreview((current) => current?.document?.id === document.id ? {
        ...current,
        loading: false,
        fileUrl: URL.createObjectURL(blob),
        contentType: blob.type || document.content_type,
      } : current);
    } catch (reason) {
      setDocumentPreview((current) => current?.document?.id === document.id ? { ...current, loading: false, error: reason.message || "Document could not be opened." } : current);
    }
  }

  function downloadPreview() {
    if (!documentPreview?.fileUrl) return;
    const link = window.document.createElement("a");
    link.href = documentPreview.fileUrl;
    link.download = documentPreview.document.file_name || "admission-document";
    link.click();
  }

  async function reviewDocument(document, decision) {
    if (!document || !session?.accessToken || documentBusyId) return;
    const reason = ["reupload_required", "rejected"].includes(decision)
      ? window.prompt("Add a reason for the parent", document.reason || "")
      : "";
    if (reason === null) return;
    setDocumentBusyId(document.id);
    try {
      await reviewAdminDocument(session.accessToken, document.id, decision, reason);
      setNotice(`${document.document_key.replaceAll("-", " ")}: ${label(decision)} saved.`);
      setDocumentPreview(null);
      await refreshSelectedApplication(document.application_number);
    } catch (reasonError) {
      setError(reasonError.message || "Document review could not be saved.");
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function deleteDocument(document) {
    if (!document || !session?.accessToken || documentBusyId || !window.confirm(`Delete ${document.file_name}? This removes it from the application.`)) return;
    setDocumentBusyId(document.id);
    try {
      await deleteAdminDocument(session.accessToken, document.id);
      setNotice(`${document.document_key.replaceAll("-", " ")}: deleted.`);
      setDocumentPreview(null);
      await refreshSelectedApplication(document.application_number);
    } catch (reason) {
      setError(reason.message || "Document could not be deleted.");
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function printApplication(application) {
    if (!application || !session?.accessToken) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Allow pop-ups for this site to print the application form.");
      return;
    }
    printWindow.document.write("<p style='font-family:Arial;padding:24px'>Preparing printable application…</p>");
    const photoKeys = new Set(["student-photo", "father-photo", "mother-photo"]);
    try {
      const results = await Promise.all((application.documents || []).filter((document) => photoKeys.has(document.document_key) && String(document.content_type || "").startsWith("image/")).map(async (document) => {
        const { blob } = await downloadAdminDocument(session.accessToken, document.id, document.file_name);
        return [document.document_key, { dataUrl: await blobToDataUrl(blob) }];
      }));
      const photographs = Object.fromEntries(results);
      printWindow.document.open();
      printWindow.document.write(applicationPrintHtml(application, photographs));
      printWindow.document.close();
      printWindow.addEventListener("load", () => printWindow.print(), { once: true });
    } catch (reason) {
      printWindow.close();
      setError(reason.message || "The application could not be prepared for printing.");
    }
  }

  return <section className="new-admission-admin-panel">
    <header className="new-admission-table-header">
      <div><p>NEW ADMISSION</p><h2>Admission applications</h2><span>Verification and approval are saved separately.</span></div>
      <button type="button" onClick={loadApplications} disabled={loading}>↻ Refresh</button>
    </header>
    <div className="new-admission-filter-row">
      <input className="new-admission-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search application, student, parent or mobile…" aria-label="Search admissions" />
      <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} aria-label="Filter by vendor">
        {vendorOptions.map(([value, labelText]) => <option value={value} key={value}>{labelText}</option>)}
      </select>
    </div>
    {error && <p className="new-admission-table-error" role="alert">{error}</p>}
    <div className="new-admission-table-scroll">
      <table className="new-admission-admin-table">
        <thead><tr><th>Application ID</th><th>Student Name</th><th>Lead Source</th><th>Class</th><th>Parent / Mobile</th><th>Documents</th><th>Verification</th><th>Admission Status</th><th>Payment Status</th><th>Form Submitted</th><th>Action</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan="11" className="new-admission-empty">Loading applications…</td></tr>}
          {!loading && !visibleApplications.length && <tr><td colSpan="11" className="new-admission-empty">No real admission records found.</td></tr>}
          {!loading && paginatedApplications.map((application) => {
            const summary = application.document_summary || {};
            return <tr key={application.id}>
                <td><button type="button" className="new-admission-student-button" onClick={() => setSelectedApplication(application)}>{application.application_number}</button></td>
                <td><button type="button" className="new-admission-student-button" onClick={() => setSelectedApplication(application)}>{application.student_name || "Application in progress"}</button></td>
                <td className="new-admission-source-cell"><b>{vendorName(application)}</b><small>{application.vendor_id || "No vendor ID"}</small></td>
                <td>{application.desired_class || "—"}</td>
                <td className="new-admission-parent-cell"><b>{parentDisplayName(application.parent_name)}</b><small>Mobile: {application.parent_mobile || "Not saved"}</small></td>
                <td>{summary.uploaded || 0}/{summary.required || 5} uploaded<br /><small>{summary.verified || 0}/{summary.required || 5} verified</small></td>
                <td><Badge value={application.documents_status} /></td>
                <td><Badge value={application.status} exceptionalApproval={Number(application.approval_exception) === 1} /></td>
                <td><button type="button" className="new-admission-payment-button" onClick={() => void openPaymentDetails(application)} aria-label={`View payment details for ${application.application_number}`}><Badge value={application.registration_fee_status || "pending"} /><small>View transaction</small></button></td>
                <td><b>{application.submitted_at ? "Yes" : "No"}</b><small>{application.submitted_at ? formatDate(application.submitted_at) : "Not submitted"}</small></td>
                <td><div className="new-admission-row-actions"><button type="button" className="new-admission-view" onClick={() => setSelectedApplication(application)}>View details</button><button type="button" className="new-admission-delete" onClick={() => void deleteAdmission(application)} disabled={savingId === application.id}>{savingId === application.id ? "Deleting…" : "Delete"}</button></div></td>
              </tr>;
          })}
        </tbody>
      </table>
    </div>
    {!loading && visibleApplications.length > 0 && <footer className="new-admission-pagination" aria-label="Admission table pagination">
      <label>Rows per page <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <span>{firstVisibleRow}–{lastVisibleRow} of {visibleApplications.length} applications</span>
      <div>
        <button type="button" onClick={() => setPage(1)} disabled={currentPage === 1}>First</button>
        <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</button>
        <b>Page {currentPage} of {totalPages}</b>
        <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</button>
        <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}>Last</button>
      </div>
    </footer>}
    <PaymentDetailsModal detail={paymentDetail} onClose={() => setPaymentDetail(null)} />
    <AdmissionDetailCard application={selectedApplication} onClose={() => setSelectedApplication(null)} onApprove={() => approve(selectedApplication)} onApproveWithException={() => approveWithException(selectedApplication)} onReject={() => updateAdmission(selectedApplication, "rejected")} onPrint={() => void printApplication(selectedApplication)} saving={savingId === selectedApplication?.id} documentBusyId={documentBusyId} onOpenDocument={(document) => void openDocumentPreview(document)} onReviewDocument={(document, decision) => void reviewDocument(document, decision)} onDeleteDocument={(document) => void deleteDocument(document)} />
    <DocumentPreviewModal preview={documentPreview} deleting={documentBusyId === documentPreview?.document?.id} onClose={() => setDocumentPreview(null)} onDownload={downloadPreview} onDelete={() => void deleteDocument(documentPreview?.document)} actions={[
      { label: "Mark under review", className: "admission-document-review", onClick: () => void reviewDocument(documentPreview?.document, "under_verification"), disabled: documentBusyId !== null },
      { label: "Verify", className: "admission-document-verify", onClick: () => void reviewDocument(documentPreview?.document, "verified"), disabled: documentBusyId !== null },
      { label: "Edit / Re-upload", className: "admission-document-replace", onClick: () => void reviewDocument(documentPreview?.document, "reupload_required"), disabled: documentBusyId !== null },
      { label: "Reject", className: "admission-document-delete", onClick: () => void reviewDocument(documentPreview?.document, "rejected"), disabled: documentBusyId !== null },
    ]} />
  </section>;
}
