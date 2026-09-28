import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteAdminDocument, downloadAdminDocument, getAdminDocuments, reviewAdminDocument } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import SchoolCrest from "../../components/SchoolCrest";
import AdminUsers from "./AdminUsers";
import AdminVendors from "./AdminVendors";
import AdminSettings from "./AdminSettings";
import AdminDashboard from "./AdminDashboard";
import NewAdmissionTable from "./NewAdmissionTable";
import DocumentPreviewModal from "../DocumentPreviewModal";
import "./Admin_Portal.css";
import "./NewAdmissionTable.css";

const screens = [
  ["▦", "Dashboard", "dashboard"],
  ["▤", "Admissions", "admissions"],
  ["♙", "Teachers", "teachers"],
  ["◉", "Students", "students"],
  ["◈", "Vendors", "vendors"],
  ["⚙", "Settings", "settings"],
  ["◈", "Users & Roles", "users"],
];

function StatusBadge({ status }) {
  const labels = { uploaded: "Uploaded", under_verification: "Under Verification", verified: "Verified", reupload_required: "Re-upload Required", rejected: "Rejected" };
  return <span className={`new-admission-badge ${String(status || "uploaded").replaceAll("_", "-")}`}>{labels[status] || status || "Uploaded"}</span>;
}

function Sidebar({ screen }) {
  const navigate = useNavigate();
  const { signOut } = useCognitoAuth();
  return <aside className="admin-sidebar">
    <Link className="admin-brand" to="/admin/dashboard"><SchoolCrest /><div><strong>Sherwood</strong><small>College Admin</small></div></Link>
    <nav aria-label="Admin portal navigation">{screens.map(([icon, label, target]) => <button className={screen === target ? "active" : ""} key={target} onClick={() => navigate(`/admin/${target}`)}><span>{icon}</span>{label}</button>)}</nav>
    <button className="admin-logout" onClick={signOut}><span>↪</span> Logout</button>
  </aside>;
}

function DocumentQueue({ setNotice }) {
  const { session } = useCognitoAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [deletingDocument, setDeletingDocument] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminDocuments(session.accessToken);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (reason) {
      setError(reason.message || "Documents could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  useEffect(() => () => {
    if (preview?.fileUrl) URL.revokeObjectURL(preview.fileUrl);
  }, [preview?.fileUrl]);

  async function review(document, decision) {
    if (!session?.accessToken || busyId) return;
    const reason = ["reupload_required", "rejected"].includes(decision)
      ? window.prompt("Add a reason for the parent", document.reason || "")
      : "";
    if (reason === null) return;
    setBusyId(document.id);
    setError("");
    try {
      const updated = await reviewAdminDocument(session.accessToken, document.id, decision, reason);
      setDocuments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${document.document}: ${decision.replaceAll("_", " ")} saved.`);
    } catch (reasonError) {
      setError(reasonError.message || "Document review could not be saved.");
    } finally {
      setBusyId(null);
    }
  }

  async function download(document) {
    if (!session?.accessToken || busyId) return;
    setBusyId(document.id);
    try {
      const { blob, fileName } = await downloadAdminDocument(session.accessToken, document.id, document.file);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason.message || "Document could not be downloaded.");
    } finally {
      setBusyId(null);
    }
  }

  async function openPreview(document) {
    if (!session?.accessToken) return;
    setPreview({ document, loading: true, fileUrl: "", contentType: "", error: "" });
    try {
      const { blob } = await downloadAdminDocument(session.accessToken, document.id, document.file);
      setPreview((current) => current?.document?.id === document.id ? {
        ...current,
        loading: false,
        fileUrl: URL.createObjectURL(blob),
        contentType: blob.type || document.content_type,
      } : current);
    } catch (reason) {
      setPreview((current) => current?.document?.id === document.id ? { ...current, loading: false, error: reason.message || "Document could not be opened." } : current);
    }
  }

  function downloadPreview() {
    if (!preview?.fileUrl) return;
    const link = window.document.createElement("a");
    link.href = preview.fileUrl;
    link.download = preview.document.file || "admission-document";
    link.click();
  }

  function reviewFromPreview(decision) {
    const document = preview?.document;
    if (!document) return;
    setPreview(null);
    void review(document, decision);
  }

  async function deletePreviewDocument() {
    if (!preview?.document || !session?.accessToken || !window.confirm(`Delete ${preview.document.file}? This removes it from the application.`)) return;
    setDeletingDocument(true);
    try {
      await deleteAdminDocument(session.accessToken, preview.document.id);
      setDocuments((current) => current.filter((document) => document.id !== preview.document.id));
      setPreview(null);
      setNotice(`${preview.document.document}: deleted.`);
      await loadDocuments();
    } catch (reason) {
      setPreview((current) => current ? { ...current, error: reason.message || "Document could not be deleted." } : current);
    } finally {
      setDeletingDocument(false);
    }
  }

  return <section className="new-admission-admin-panel">
    <header className="new-admission-table-header"><div><p>STAGE 6 OF 7</p><h2>Document verification</h2><span>Verify required documents before approving an admission.</span></div><button type="button" onClick={loadDocuments}>↻ Refresh</button></header>
    {error && <p className="new-admission-table-error" role="alert">{error}</p>}
    <div className="new-admission-table-scroll"><table className="new-admission-admin-table"><thead><tr><th>Application</th><th>Student</th><th>Document</th><th>File</th><th>Status</th><th>Admin action</th></tr></thead><tbody>
      {loading && <tr><td colSpan="6" className="new-admission-empty">Loading documents…</td></tr>}
      {!loading && !documents.length && <tr><td colSpan="6" className="new-admission-empty">No documents have been uploaded.</td></tr>}
      {!loading && documents.map((document) => <tr key={document.id}><td>{document.application_number}</td><td>{document.student}</td><td><b>{document.document}</b></td><td><button type="button" className="new-admission-file-button" onClick={() => void openPreview(document)}>{document.file}</button></td><td><StatusBadge status={document.status_code} /><small>{document.reason}</small></td><td><div className="new-admission-actions"><button type="button" onClick={() => void openPreview(document)} disabled={busyId === document.id}>Open</button><button type="button" onClick={() => download(document)} disabled={busyId === document.id}>Download</button><button type="button" onClick={() => review(document, "under_verification")} disabled={busyId === document.id}>Review</button><button type="button" className="approve" onClick={() => review(document, "verified")} disabled={busyId === document.id}>Verify</button><button type="button" onClick={() => review(document, "reupload_required")} disabled={busyId === document.id}>Edit / Re-upload</button><button type="button" className="reject" onClick={() => review(document, "rejected")} disabled={busyId === document.id}>Reject</button></div></td></tr>)}
    </tbody></table></div>
    <DocumentPreviewModal preview={preview} deleting={deletingDocument} onClose={() => setPreview(null)} onDownload={downloadPreview} onDelete={() => void deletePreviewDocument()} actions={[
      { label: "Mark under review", className: "admission-document-review", onClick: () => reviewFromPreview("under_verification"), disabled: deletingDocument },
      { label: "Verify", className: "admission-document-verify", onClick: () => reviewFromPreview("verified"), disabled: deletingDocument },
      { label: "Edit / Re-upload", className: "admission-document-replace", onClick: () => reviewFromPreview("reupload_required"), disabled: deletingDocument },
      { label: "Reject", className: "admission-document-delete", onClick: () => reviewFromPreview("rejected"), disabled: deletingDocument },
    ]} />
  </section>;
}

export default function AdminPortal() {
  const { screen = "dashboard" } = useParams();
  const navigate = useNavigate();
  const { signOut } = useCognitoAuth();
  const [notice, setNotice] = useState("");
  const currentScreen = screens.some(([, , value]) => value === screen) ? screen : "dashboard";
  const content = currentScreen === "documents"
    ? <DocumentQueue setNotice={setNotice} />
    : currentScreen === "users"
      ? <AdminUsers setNotice={setNotice} />
      : currentScreen === "vendors"
        ? <AdminVendors setNotice={setNotice} />
        : currentScreen === "settings"
          ? <AdminSettings setNotice={setNotice} />
      : currentScreen === "admissions"
        ? <NewAdmissionTable setNotice={setNotice} />
        : <AdminDashboard view={currentScreen === "dashboard" ? "overview" : currentScreen} onNavigate={(target) => navigate(`/admin/${target}`)} />;

  const headings = {
    dashboard: ["SCHOOL OPERATIONS", "Admin Dashboard", "Live overview of admissions, teachers, students and activity."],
    admissions: ["ADMISSION OPERATIONS", "New Admission Dashboard", "Manage verification and admission approvals using live application data."],
    teachers: ["SCHOOL OPERATIONS", "Teacher Dashboard", "Review staff availability, subject allocation and attendance."],
    students: ["SCHOOL OPERATIONS", "Student Dashboard", "Review student enrollment, class allocation and attendance."],
    vendors: ["VENDOR ACCESS", "Vendor Logins", "Create vendor access, distribute referral links, and block accounts when required."],
    settings: ["ADMISSION CONFIGURATION", "Settings", "Set the registration payment amount and manage entrance-test syllabus content."],
    users: ["ACCESS CONTROL", "Users & Roles", "Manage database users and their portal roles."],
  };
  const [eyebrow, heading, description] = headings[currentScreen] || headings.admissions;

  return <main className="admin-page"><Sidebar screen={currentScreen} /><section className="admin-content"><header className="admin-feature-heading"><div><p>{eyebrow}</p><h1>{heading}</h1><small>{description}</small></div><button type="button" className="admin-header-logout" onClick={() => void signOut()}>↪ Logout</button></header>{notice && <div className="admin-notice admin-global-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}{content}</section></main>;
}
