import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { decideAdminAdmission, getAdminAdmissions } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import "./NewAdmissionTable.css";

const statusLabels = {
  pending: "Pending",
  submitted: "Pending",
  uploaded: "Uploaded",
  under_verification: "Under Verification",
  documents_verified: "Documents Verified",
  approved: "Approved",
  needs_information: "Needs Information",
  reupload_required: "Re-upload Required",
  rejected: "Rejected",
  draft: "Draft",
};

function label(value) {
  return statusLabels[value] || String(value || "pending").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function parentDisplayName(value) {
  const name = String(value || "").trim();
  const cognitoSubject = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  return !name || cognitoSubject.test(name) ? "Parent details pending" : name;
}

function Badge({ value }) {
  const normalizedValue = value === "submitted" ? "pending" : value;
  return <span className={`new-admission-badge ${String(normalizedValue || "pending").replaceAll("_", "-")}`}>{label(normalizedValue)}</span>;
}

export default function NewAdmissionTable({ onOpenDocuments, setNotice }) {
  const { session } = useCognitoAuth();
  const [applications, setApplications] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const loadApplications = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminAdmissions(session.accessToken);
      setApplications(Array.isArray(data) ? data : []);
    } catch (reason) {
      setError(reason.message || "Admissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  const visibleApplications = useMemo(() => applications.filter((application) => {
    const searchable = [application.application_number, application.student_name, application.parent_name, application.parent_mobile, application.desired_class].join(" ").toLowerCase();
    return searchable.includes(query.trim().toLowerCase());
  }), [applications, query]);

  async function updateAdmission(application, decision, options = {}) {
    if (!session?.accessToken || savingId) return;
    setSavingId(application.id);
    setError("");
    try {
      const updated = await decideAdminAdmission(session.accessToken, application.id, decision, options);
      setApplications((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setNotice(`${application.student_name || "Applicant"}: ${label(decision)} saved.`);
      await loadApplications();
    } catch (reason) {
      setError(reason.message || "The admission could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  function addRemark(application) {
    const remark = window.prompt("Add an admin remark", application.admin_remark || "");
    if (remark === null || !remark.trim()) return;
    void updateAdmission(application, "remark", { adminRemark: remark.trim() });
  }

  function needsInformation(application) {
    const remark = window.prompt("What information is required from the parent?", application.admin_remark || "");
    if (remark === null) return;
    void updateAdmission(application, "needs_information", { adminRemark: remark.trim() });
  }

  function approve(application) {
    const classSection = window.prompt("Class allocation", application.class_section || application.desired_class || "");
    if (classSection === null || !classSection.trim()) return;
    const sectionAllocation = window.prompt("Section allocation (for example, A)", application.section_allocation || "");
    if (sectionAllocation === null || !sectionAllocation.trim()) return;
    void updateAdmission(application, "approved", { classSection: classSection.trim(), sectionAllocation: sectionAllocation.trim() });
  }

  return <section className="new-admission-admin-panel">
    <header className="new-admission-table-header">
      <div><p>NEW ADMISSION</p><h2>Admission applications</h2><span>Verification and approval are saved separately.</span></div>
      <button type="button" onClick={loadApplications} disabled={loading}>↻ Refresh</button>
    </header>
    <input className="new-admission-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search application, student, parent or mobile…" aria-label="Search admissions" />
    {error && <p className="new-admission-table-error" role="alert">{error}</p>}
    <div className="new-admission-table-scroll">
      <table className="new-admission-admin-table">
        <thead><tr><th>Application ID</th><th>Student Name</th><th>Class</th><th>Parent / Mobile</th><th>Documents</th><th>Verification</th><th>Admission Status</th><th>Application Date</th><th>Action</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan="9" className="new-admission-empty">Loading applications…</td></tr>}
          {!loading && !visibleApplications.length && <tr><td colSpan="9" className="new-admission-empty">No real admission records found.</td></tr>}
          {!loading && visibleApplications.map((application) => {
            const summary = application.document_summary || {};
            const isApproved = application.status === "approved";
            const canApprove = application.documents_status === "documents_verified" && !isApproved;
            const isSaving = savingId === application.id;
            return <Fragment key={application.id}>
              <tr key={application.id}>
                <td><b>{application.application_number}</b></td>
                <td>{application.student_name || "Application in progress"}</td>
                <td>{application.desired_class || "—"}</td>
                <td className="new-admission-parent-cell"><b>{parentDisplayName(application.parent_name)}</b><small>Mobile: {application.parent_mobile || "Not saved"}</small></td>
                <td>{summary.uploaded || 0}/{summary.required || 5} uploaded<br /><small>{summary.verified || 0}/{summary.required || 5} verified</small></td>
                <td><Badge value={application.documents_status} /></td>
                <td><Badge value={application.status} /></td>
                <td>{formatDate(application.submitted_on)}</td>
                <td><div className="new-admission-actions">
                  <button type="button" onClick={() => setOpenId(openId === application.id ? null : application.id)}>View</button>
                  <button type="button" onClick={onOpenDocuments}>Verify documents</button>
                  <button type="button" onClick={() => addRemark(application)} disabled={isSaving}>Remark</button>
                  <button type="button" onClick={() => needsInformation(application)} disabled={isSaving}>Needs info</button>
                  <button type="button" className="approve" onClick={() => approve(application)} disabled={!canApprove || isSaving}>{isSaving ? "Saving…" : "Approve"}</button>
                  <button type="button" className="reject" onClick={() => updateAdmission(application, "rejected")} disabled={isSaving}>Reject</button>
                </div></td>
              </tr>
              {openId === application.id && <tr className="new-admission-detail"><td colSpan="9"><b>Admin remark:</b> {application.admin_remark || "No remark added."} <span><b>Re-upload reason:</b> {application.reupload_reason || "—"}</span><span><b>Verified by:</b> {application.verified_by || "—"}</span><span><b>Class / section:</b> {application.class_section || "—"} / {application.section_allocation || "—"}</span><span><b>Approved by:</b> {application.approved_by || "—"}</span></td></tr>}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
