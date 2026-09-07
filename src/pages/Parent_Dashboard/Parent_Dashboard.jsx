import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdmissionData,
  getAdmissionDocumentLabel,
  getAdmissionStatus,
  getApplicationStatusLabel,
  getDocumentStatusLabel,
  getNewAdmissionId,
  saveAdmissionDraft,
} from "../../services/admission";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import AccountMenu from "../../components/AccountMenu";
import "./Parent_Dashboard.css";

const steps = [
  ["✓", "OTP Verified", "complete"],
  ["2", "Admission Details", "current"],
  ["3", "Student Details", "pending"],
  ["4", "Parent Details", "pending"],
  ["5", "Documents", "pending"],
  ["6", "Verification", "pending"],
  ["7", "Approval", "pending"],
];

function getLocalDate() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function getNextAcademicSession() {
  const year = new Date().getFullYear() + 1;
  return `${year}–${String(year + 1).slice(-2)}`;
}

const nextAcademicSession = getNextAcademicSession();
// Admissions begin at Class 5. Class 4 is only available as a student's
// current class when they are applying for Class 5.
const admissionClassOptions = ["Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11"];
const currentClassOptions = ["Class 4", ...admissionClassOptions];
const classOrder = currentClassOptions;
const classRank = Object.fromEntries(classOrder.map((className, index) => [className, index + 4]));

const currentClassChoices = (selectedClass) =>
  currentClassOptions.filter((className) => selectedClass === "Select class" || classRank[className] <= classRank[selectedClass]);

const initialForm = {
  session: nextAcademicSession,
  date: getLocalDate(),
  class: "Select class",
  stream: "Select stream",
  penNumber: "",
  previousSchool: "",
  currentClass: "Select current class",
  board: "Select board",
  boardOther: "",
  medium: "English",
};

function statusClassName(status) {
  return String(status || "unknown").replaceAll("_", "-");
}

function statusIcon(status) {
  if (status === "approved") return "✓";
  if (status === "reupload_required") return "!";
  return "◷";
}

function LiveApplicationStatus({ liveStatus, isLoading, error, onRefresh }) {
  const documents = liveStatus?.documents || [];
  const summary = liveStatus?.document_summary || { uploaded: 0, approved: 0, pending: 0, reupload_required: 0 };
  const applicationStatus = liveStatus?.application?.status;

  return <section className="admission-form-block admission-live-status" aria-labelledby="live-status-heading">
    <header className="admission-form-block-header">
      <div>
        <p>LIVE APPLICATION STATUS</p>
        <h2 id="live-status-heading">Document verification &amp; admission approval</h2>
      </div>
      <div className="live-status-header-actions">
        <span className={`live-application-status is-${statusClassName(applicationStatus)}`}>
          {liveStatus ? getApplicationStatusLabel(applicationStatus) : "Waiting for first save"}
        </span>
        <button type="button" onClick={onRefresh} disabled={isLoading}>{isLoading ? "Refreshing…" : "Refresh"}</button>
      </div>
    </header>

    {error && <p className="live-status-error" role="status">{error} We will try again automatically.</p>}
    {!liveStatus && !error && <p className="live-status-empty">{isLoading ? "Checking the latest application status…" : "Save your draft once to see real-time document and admission updates here."}</p>}

    {liveStatus && <>
      <p className="live-status-description">Status is read directly from your saved application. It refreshes automatically every 15 seconds.</p>
      <div className="live-status-summary" aria-label="Document verification summary">
        <span><b>{summary.uploaded}</b><small>Uploaded</small></span>
        <span><b>{summary.approved}</b><small>Verified</small></span>
        <span><b>{summary.pending}</b><small>Under review</small></span>
        <span><b>{summary.reupload_required}</b><small>Action needed</small></span>
      </div>

      {documents.length > 0 ? <div className="live-document-list" role="list" aria-label="Uploaded document statuses">
        {documents.map((document) => <article className={`is-${statusClassName(document.status)}`} key={document.id} role="listitem">
          <i aria-hidden="true">{statusIcon(document.status)}</i>
          <div className="live-document-name"><b>{getAdmissionDocumentLabel(document.document_key)}</b><small title={document.file_name}>{document.file_name}</small></div>
          <span className="live-document-status">{getDocumentStatusLabel(document.status)}</span>
          {document.reason && <p><b>Admin note:</b> {document.reason}</p>}
        </article>)}
      </div> : <p className="live-status-empty">No documents are saved in the database yet. Upload them in the Documents step to send them for verification.</p>}
    </>}
  </section>;
}

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { session } = useCognitoAuth();
  const [form, setForm] = useState(() => {
    const savedForm = { ...initialForm, ...getAdmissionData().admissionDetails };
    // A saved Class 4 application is no longer valid after removing Class 4
    // from the admission dropdown.
    return admissionClassOptions.includes(savedForm.class)
      ? savedForm
      : { ...savedForm, class: "Select class", stream: "Select stream" };
  });
  const [message, setMessage] = useState("");
  const applicationId = getNewAdmissionId();
  const [liveStatus, setLiveStatus] = useState(null);
  const [isLiveStatusLoading, setIsLiveStatusLoading] = useState(true);
  const [liveStatusError, setLiveStatusError] = useState("");

  const loadLiveStatus = useCallback(async () => {
    if (!session?.accessToken) {
      setIsLiveStatusLoading(false);
      return;
    }

    setIsLiveStatusLoading(true);
    try {
      const nextStatus = await getAdmissionStatus(session.accessToken, applicationId);
      setLiveStatus(nextStatus);
      setLiveStatusError("");
    } catch (error) {
      setLiveStatusError(error.message || "Live status is temporarily unavailable.");
    } finally {
      setIsLiveStatusLoading(false);
    }
  }, [applicationId, session?.accessToken]);

  useEffect(() => {
    void loadLiveStatus();
    const refreshTimer = window.setInterval(loadLiveStatus, 15_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadLiveStatus]);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "class") {
        if (value !== "Class 11") next.stream = "Select stream";
        if (classRank[current.currentClass] > classRank[value]) next.currentClass = "Select current class";
      }

      return next;
    });
  }

  async function saveDraft() {
    try {
      await saveAdmissionDraft(session?.accessToken, { admissionDetails: form, ...form });
      setMessage("Your admission details have been saved as a draft.");
      void loadLiveStatus();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function continueApplication() {
    if (form.class === "Select class") {
      setMessage("Please select the class you are applying for.");
      return;
    }
    if (form.class === "Class 11" && form.stream === "Select stream") {
      setMessage("Please select a stream for Class 11.");
      return;
    }
    if (form.currentClass === "Select current class") {
      setMessage("Please select the student's current class.");
      return;
    }
    if (classRank[form.currentClass] > classRank[form.class]) {
      setMessage("Current Class must be the same as or lower than Class Applying For.");
      return;
    }
    saveAdmissionDraft(session?.accessToken, { admissionDetails: form, ...form })
      .then(() => {
        void loadLiveStatus();
        sessionStorage.setItem("sheerwood-applying-class", form.class);
        navigate("/student-information", { state: { applyingClass: form.class, stream: form.stream } });
      })
      .catch((error) => setMessage(error.message));
  }

  return (
    <main className="admission-page">
      <header className="admission-header">
        <Link className="admission-brand" to="/new-user-dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <AccountMenu />
      </header>

      <section className="admission-shell">
        <div className="admission-main">
          <div className="admission-title"><div><p className="admission-kicker">STEP 2 OF 7 · NEW APPLICATION</p><h1>Admission Details</h1><p>Tell us about the class and school background for this application.</p></div></div>

          <ol className="application-steps" aria-label="Application progress">
            {steps.map(([number, label, status]) => (
              <li className={status} key={label}>
                <span>{number}</span><b>{label}</b>
              </li>
            ))}
          </ol>

          {message && <div className="form-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}

          <form className="admission-form" onSubmit={(event) => { event.preventDefault(); continueApplication(); }}>
            <section className="admission-form-block" aria-labelledby="application-information-heading">
              <header className="admission-form-block-header"><div><p>APPLICATION INFORMATION</p><h2 id="application-information-heading">Admission application</h2></div><small>Fields marked <em>*</em> are required.</small></header>
              <div className="admission-fields">
                <label>Academic Session<input value={form.session} readOnly /></label>
                <label>Class Applying For <em>*</em><select name="class" value={form.class} onChange={update} required><option value="Select class" disabled>Select class</option>{admissionClassOptions.map((className) => <option key={className} value={className}>{className}</option>)}</select></label>
                {form.class === "Class 11" && <label>Stream <em>*</em><select name="stream" value={form.stream} onChange={update} required><option value="Select stream" disabled>Select stream</option><option value="PCMB">PCMB</option><option value="PCM">PCM</option><option value="PCB">PCB</option><option value="Commerce with Mathematics">Commerce with Mathematics</option><option value="Commerce without Mathematics">Commerce without Mathematics</option><option value="Humanities">Humanities</option></select></label>}
                <label>Application Date<input name="date" type="date" value={form.date} readOnly /></label>
                <label>Application ID<input value={applicationId} readOnly /></label>
                <label>PEN Number <small>(Personal Education Number)</small><input name="penNumber" value={form.penNumber} onChange={update} placeholder="Enter PEN number" /></label>
              </div>
            </section>

            <section className="admission-form-block" aria-labelledby="academic-background-heading">
              <header className="admission-form-block-header"><div><p>ACADEMIC BACKGROUND</p><h2 id="academic-background-heading">Previous school details</h2></div></header>
              <div className="admission-fields">
                <label>Previous School<input name="previousSchool" value={form.previousSchool} onChange={update} placeholder="Enter previous school name" /></label>
                <label>Current Class <em>*</em><select name="currentClass" value={form.currentClass} onChange={update} required><option value="Select current class" disabled>Select current class</option>{currentClassChoices(form.class).map((className) => <option key={className} value={className}>{className}</option>)}</select></label>
                <label>Board<select name="board" value={form.board} onChange={update}><option value="Select board" disabled>Select board</option><option value="CBSE">CBSE</option><option value="ICSE">ICSE</option><option value="State Board">State Board</option><option value="IB">IB</option><option value="Other">Other</option></select></label>
                {form.board === "Other" && <label>Specify Board <em>*</em><input name="boardOther" value={form.boardOther} onChange={update} placeholder="Enter board name" required /></label>}
                <label>Medium<select name="medium" value={form.medium} onChange={update}><option value="English">English</option><option value="Hindi">Hindi</option><option value="Other">Other</option></select></label>
              </div>
            </section>
            <LiveApplicationStatus liveStatus={liveStatus} isLoading={isLiveStatusLoading} error={liveStatusError} onRefresh={loadLiveStatus} />
            <div className="form-actions"><button type="button" className="save-draft" onClick={saveDraft}>Save Draft</button><button className="next-step" type="submit">Next <span>→</span></button></div>
          </form>
        </div>

        <aside className="admission-help">
          <section className="help-assistant"><div><span>✦</span><p><b>Sheerwood Assistant</b><small><i /> Online</small></p></div><button onClick={() => navigate("/ai-assistant")}>Ask a question →</button></section>
          <section className="help-card"><h2>Quick Help</h2><button onClick={() => setMessage("Please keep the student's Aadhaar Card, Birth Certificate issued by the Nagar Nigam/Municipal Department, and most recent mark sheet ready. The original Transfer Certificate is submitted after admission is confirmed.")}>What documents are required?</button><button onClick={() => setMessage("For Class 3, the child should be between 7.5 and 8 years old as of the academic year start date.")}>What is the age criteria for Class 3?</button><button onClick={() => setMessage("The entrance test is online, with English and Mathematics papers. Each paper is one hour.")}>How is the entrance test conducted?</button><button onClick={() => setMessage("Admissions close as and when seats are filled. Please contact the admissions team to confirm current availability.")}>When do admissions close?</button></section>
        </aside>
      </section>
    </main>
  );
}
