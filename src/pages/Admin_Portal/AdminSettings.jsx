import { useCallback, useEffect, useState } from "react";
import { deleteAdminSyllabus, getAdminSettings, getAdminSyllabus, saveAdminSyllabus, updateRegistrationFee } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import "./AdminConfiguration.css";

const blankSyllabus = { subject: "", details: "", sort_order: 0, active: true };

export default function AdminSettings({ setNotice }) {
  const { session } = useCognitoAuth();
  const [fee, setFee] = useState("");
  const [syllabus, setSyllabus] = useState([]);
  const [editor, setEditor] = useState(blankSyllabus);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [settings, items] = await Promise.all([getAdminSettings(session.accessToken), getAdminSyllabus(session.accessToken)]);
      setFee(String(settings.registration_fee_amount ?? ""));
      setSyllabus(Array.isArray(items) ? items : []);
    } catch (reason) {
      setError(reason.message || "Configuration could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void load(); }, [load]);

  async function saveFee(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateRegistrationFee(session.accessToken, fee);
      setFee(String(updated.registration_fee_amount));
      setNotice(`Registration fee updated to ₹${Number(updated.registration_fee_amount).toLocaleString("en-IN")}.`);
    } catch (reason) {
      setError(reason.message || "Registration fee could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSyllabus(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await saveAdminSyllabus(session.accessToken, editor);
      setSyllabus((items) => editor.id ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved].sort((a, b) => a.sort_order - b.sort_order));
      setEditor(blankSyllabus);
      setNotice(`Entrance-test syllabus ${editor.id ? "updated" : "added"}.`);
    } catch (reason) {
      setError(reason.message || "Syllabus item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSyllabus(item) {
    if (!window.confirm(`Delete the ${item.subject} syllabus item?`)) return;
    setError("");
    try {
      await deleteAdminSyllabus(session.accessToken, item.id);
      setSyllabus((items) => items.filter((entry) => entry.id !== item.id));
      if (editor.id === item.id) setEditor(blankSyllabus);
      setNotice(`${item.subject} syllabus item deleted.`);
    } catch (reason) {
      setError(reason.message || "Syllabus item could not be deleted.");
    }
  }

  return <section className="admin-configuration">
    <header><div><p>ADMISSION CONFIGURATION</p><h2>Registration fee &amp; entrance test</h2><small>Changes apply to future payment attempts and newly approved applications.</small></div><button type="button" onClick={() => void load()} disabled={loading}>↻ Refresh</button></header>
    {error && <p className="admin-inline-error">{error}</p>}
    <div className="admin-configuration-grid">
      <form className="admin-config-card" onSubmit={saveFee}>
        <p>REGISTRATION FEE</p><h3>Set application payment amount</h3><small>Parents see this amount before Easebuzz checkout. Existing payment attempts keep their original amount.</small>
        <label>Amount in rupees<input type="number" min="1" max="10000000" value={fee} onChange={(event) => setFee(event.target.value)} required /></label>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save registration fee"}</button>
      </form>
      <form className="admin-config-card admin-syllabus-editor" onSubmit={saveSyllabus}>
        <p>ENTRANCE-TEST SYLLABUS</p><h3>{editor.id ? "Edit syllabus item" : "Add syllabus item"}</h3>
        <label>Subject<input value={editor.subject} onChange={(event) => setEditor((item) => ({ ...item, subject: event.target.value }))} placeholder="e.g. Mathematics" required /></label>
        <label>Topics / instructions<textarea value={editor.details} onChange={(event) => setEditor((item) => ({ ...item, details: event.target.value }))} placeholder="Topics covered in the entrance test" required /></label>
        <div className="admin-config-editor-row"><label>Display order<input type="number" min="0" value={editor.sort_order} onChange={(event) => setEditor((item) => ({ ...item, sort_order: event.target.value }))} /></label><label className="admin-config-check"><input type="checkbox" checked={Boolean(editor.active)} onChange={(event) => setEditor((item) => ({ ...item, active: event.target.checked }))} /> Include in parent email</label></div>
        <div className="admin-config-actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : editor.id ? "Save changes" : "Add syllabus"}</button>{editor.id && <button type="button" className="outline" onClick={() => setEditor(blankSyllabus)}>Cancel edit</button>}</div>
      </form>
    </div>
    <section className="admin-syllabus-list"><header><div><p>EMAIL CONTENT</p><h3>Current entrance-test syllabus</h3></div><span>{syllabus.length} items</span></header>{loading ? <p>Loading configuration…</p> : syllabus.length ? syllabus.map((item) => <article key={item.id}><div><b>{item.subject}</b><small>{item.details}</small></div><span className={item.active ? "active" : "inactive"}>{item.active ? "Included" : "Hidden"}</span><em>Order {item.sort_order}</em><div><button type="button" onClick={() => setEditor({ ...item })}>Edit</button><button type="button" className="delete" onClick={() => void removeSyllabus(item)}>Delete</button></div></article>) : <p>No syllabus items have been added yet.</p>}</section>
  </section>;
}
