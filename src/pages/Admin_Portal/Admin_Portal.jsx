import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { downloadAdminDocument, getAdminDocuments, reviewAdminDocument } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import AdminUsers from "./AdminUsers";
import NewAdmissionTable from "./NewAdmissionTable";
import "./Admin_Portal.css";
import "./NewAdmissionTable.css";

const screens = [
  ["▤", "Admissions", "admissions"],
  ["▣", "Documents", "documents"],
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
    <Link className="admin-brand" to="/admin/admissions"><span>S</span><div><strong>Sheerwood</strong><small>Admissions Admin</small></div></Link>
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

  return <section className="new-admission-admin-panel">
    <header className="new-admission-table-header"><div><p>STAGE 6 OF 7</p><h2>Document verification</h2><span>Verify required documents before approving an admission.</span></div><button type="button" onClick={loadDocuments}>↻ Refresh</button></header>
    {error && <p className="new-admission-table-error" role="alert">{error}</p>}
    <div className="new-admission-table-scroll"><table className="new-admission-admin-table"><thead><tr><th>Application</th><th>Student</th><th>Document</th><th>File</th><th>Status</th><th>Admin action</th></tr></thead><tbody>
      {loading && <tr><td colSpan="6" className="new-admission-empty">Loading documents…</td></tr>}
      {!loading && !documents.length && <tr><td colSpan="6" className="new-admission-empty">No documents have been uploaded.</td></tr>}
      {!loading && documents.map((document) => <tr key={document.id}><td>{document.application_number}</td><td>{document.student}</td><td><b>{document.document}</b></td><td>{document.file}</td><td><StatusBadge status={document.status_code} /><small>{document.reason}</small></td><td><div className="new-admission-actions"><button type="button" onClick={() => download(document)} disabled={busyId === document.id}>Download</button><button type="button" onClick={() => review(document, "under_verification")} disabled={busyId === document.id}>Review</button><button type="button" className="approve" onClick={() => review(document, "verified")} disabled={busyId === document.id}>Verify</button><button type="button" onClick={() => review(document, "reupload_required")} disabled={busyId === document.id}>Re-upload</button><button type="button" className="reject" onClick={() => review(document, "rejected")} disabled={busyId === document.id}>Reject</button></div></td></tr>)}
    </tbody></table></div>
  </section>;
}

export default function AdminPortal() {
  const navigate = useNavigate();
  const { screen = "admissions" } = useParams();
  const [notice, setNotice] = useState("");
  const currentScreen = screens.some(([, , value]) => value === screen) ? screen : "admissions";
  const content = currentScreen === "documents"
    ? <DocumentQueue setNotice={setNotice} />
    : currentScreen === "users"
      ? <AdminUsers setNotice={setNotice} />
      : <NewAdmissionTable onOpenDocuments={() => navigate("/admin/documents")} setNotice={setNotice} />;

  return <main className="admin-page"><Sidebar screen={currentScreen} /><section className="admin-content"><header className="admin-feature-heading"><div><p>ADMISSION OPERATIONS</p><h1>{currentScreen === "documents" ? "Document Verification" : currentScreen === "users" ? "Users & Roles" : "New Admission Dashboard"}</h1><small>Manage verification and admission approvals using live application data.</small></div></header>{notice && <div className="admin-notice admin-global-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}{content}</section></main>;
}
