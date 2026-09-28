import { useCallback, useEffect, useState } from "react";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import { getVendorDashboard } from "../services/api";
import SchoolCrest from "../components/SchoolCrest";
import "./VendorDashboard.css";

export default function VendorDashboard() {
  const { session, signOut } = useCognitoAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setError("");
    try {
      setData(await getVendorDashboard(session.accessToken));
    } catch (reason) {
      setError(reason.message || "Vendor dashboard could not be loaded.");
    }
  }, [session?.accessToken]);

  useEffect(() => { void load(); }, [load]);
  const referralLink = data ? `${window.location.origin}${data.referral_path}` : "";

  return <main className="vendor-page"><header><div className="vendor-brand"><SchoolCrest /><div><strong>Sherwood</strong><small>Vendor Portal</small></div></div><button type="button" onClick={signOut}>↪ Logout</button></header><section className="vendor-shell">{error ? <section className="vendor-error"><h1>Access unavailable</h1><p>{error}</p></section> : !data ? <p className="vendor-loading">Loading your vendor account…</p> : <><div className="vendor-heading"><div><p>WELCOME, {data.vendor.full_name}</p><h1>Referral <em>overview</em></h1><span>Share your approved tracking link to attribute new admission applications to your account.</span></div><button type="button" onClick={() => void load()}>↻ Refresh</button></div><section className="vendor-link-card"><div><p>YOUR REFERRAL LINK</p><strong>{referralLink}</strong></div><button type="button" onClick={() => navigator.clipboard?.writeText(referralLink)}>Copy link</button></section><section className="vendor-metrics"><article><span>Total applications</span><strong>{data.summary.applications}</strong></article><article><span>Submitted</span><strong>{data.summary.submitted}</strong></article><article><span>Approved</span><strong>{data.summary.approved}</strong></article></section><section className="vendor-leads"><header><div><p>ATTRIBUTED APPLICATIONS</p><h2>Your leads</h2></div><span>{data.applications.length} visible</span></header>{data.applications.length ? <div className="vendor-table"><table><thead><tr><th>Application</th><th>Student</th><th>Class</th><th>Submitted</th><th>Status</th></tr></thead><tbody>{data.applications.map((application) => <tr key={application.application_number}><td>{application.application_number}</td><td>{application.student_name || "Applicant"}</td><td>{application.desired_class || "—"}</td><td>{application.submitted_at ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(application.submitted_at)) : "In progress"}</td><td><span className={application.status}>{String(application.status || "draft").replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div> : <p className="vendor-empty">No applications have been attributed to this referral link yet.</p>}</section></>}</section></main>;
}
