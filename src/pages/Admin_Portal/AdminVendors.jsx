import { useCallback, useEffect, useState } from "react";
import { createAdminVendor, getAdminVendors, updateAdminVendorStatus } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import "./AdminConfiguration.css";

const blankVendor = { full_name: "", email: "", vendor_id: "" };

export default function AdminVendors({ setNotice }) {
  const { session } = useCognitoAuth();
  const [vendors, setVendors] = useState([]);
  const [vendor, setVendor] = useState(blankVendor);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyVendorId, setBusyVendorId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminVendors(session.accessToken);
      setVendors(Array.isArray(data) ? data : []);
    } catch (reason) {
      setError(reason.message || "Vendor accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void load(); }, [load]);

  async function createVendor(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createAdminVendor(session.accessToken, vendor);
      setVendor(blankVendor);
      setNotice(`${created.full_name}'s vendor login was created and a Cognito invitation email was sent.`);
      await load();
    } catch (reason) {
      setError(reason.message || "Vendor login could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item) {
    const enabled = !item.is_enabled;
    if (!enabled && !window.confirm(`Block ${item.full_name}'s vendor login? They will no longer be able to sign in or use their referral link.`)) return;
    setBusyVendorId(item.vendor_id);
    setError("");
    try {
      const updated = await updateAdminVendorStatus(session.accessToken, item.vendor_id, enabled);
      setVendors((items) => items.map((entry) => entry.vendor_id === item.vendor_id ? { ...entry, is_enabled: updated.is_enabled } : entry));
      setNotice(`${item.full_name}'s vendor login is now ${updated.status.toLowerCase()}.`);
    } catch (reason) {
      setError(reason.message || "Vendor status could not be updated.");
    } finally {
      setBusyVendorId("");
    }
  }

  function copyLink(item) {
    const link = `${window.location.origin}/apply?source=vendor&referral_code=${encodeURIComponent(item.referral_code)}`;
    navigator.clipboard?.writeText(link).then(() => setNotice(`${item.vendor_id}'s referral link copied.`)).catch(() => setError("Could not copy the referral link. Please copy it manually."));
  }

  return <section className="admin-configuration">
    <header><div><p>VENDOR ACCESS</p><h2>Vendor logins &amp; referral links</h2><small>Create a Cognito login for each vendor and control whether they can sign in or accept attributed referrals.</small></div><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
    {error && <p className="admin-inline-error">{error}</p>}
    <form className="admin-vendor-create" onSubmit={createVendor}><input value={vendor.full_name} onChange={(event) => setVendor((current) => ({ ...current, full_name: event.target.value }))} placeholder="Vendor / organisation name" required /><input type="email" value={vendor.email} onChange={(event) => setVendor((current) => ({ ...current, email: event.target.value }))} placeholder="Vendor email" required /><input value={vendor.vendor_id} onChange={(event) => setVendor((current) => ({ ...current, vendor_id: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))} placeholder="Referral ID, e.g. ABC001" minLength="3" required /><button type="submit" disabled={saving}>{saving ? "Creating…" : "Create vendor login"}</button></form>
    <section className="admin-vendor-list"><header><span>VENDOR</span><span>REFERRAL LINK</span><span>LEADS</span><span>STATUS</span><span>ACTION</span></header>{loading ? <p>Loading vendor accounts…</p> : vendors.length ? vendors.map((item) => <article key={item.vendor_id}><div><b>{item.full_name}</b><small>{item.email} · {item.vendor_id}</small></div><button type="button" className="admin-vendor-link" onClick={() => copyLink(item)}>Copy referral link</button><span>{item.applications} total · {item.submitted} submitted · {item.approved} approved</span><em className={item.is_enabled ? "active" : "blocked"}>{item.is_enabled ? "Active" : "Blocked"}</em><button type="button" className={item.is_enabled ? "block" : "enable"} onClick={() => void changeStatus(item)} disabled={busyVendorId === item.vendor_id}>{busyVendorId === item.vendor_id ? "Saving…" : item.is_enabled ? "Block login" : "Enable login"}</button></article>) : <p>No vendor logins have been created yet.</p>}</section>
  </section>;
}
