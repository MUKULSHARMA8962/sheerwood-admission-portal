import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getNewAdmissionId } from "../../services/admission";
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
const classRank = { Nursery: 0, "Class 1": 1, "Class 2": 2, "Class 3": 3, "Class 4": 4, "Class 5": 5, "Class 6": 6, "Class 7": 7, "Class 8": 8, "Class 9": 9, "Class 10": 10, "Class 11": 11 };
const admissionClassOptions = Object.entries(classRank).filter(([, rank]) => rank >= 5);
const currentClassOptions = Object.entries(classRank).filter(([, rank]) => rank >= 5);

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

export default function ParentDashboard() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const applicationId = getNewAdmissionId();

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

  function saveDraft() {
    setMessage("Your admission details have been saved as a draft.");
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
    sessionStorage.setItem("sheerwood-applying-class", form.class);
    navigate("/student-information", { state: { applyingClass: form.class, stream: form.stream } });
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
                <label>Class Applying For <em>*</em><select name="class" value={form.class} onChange={update} required><option disabled>Select class</option>{admissionClassOptions.map(([className]) => <option key={className}>{className}</option>)}</select></label>
                {form.class === "Class 11" && <label>Stream <em>*</em><select name="stream" value={form.stream} onChange={update} required><option disabled>Select stream</option><option>PCMB</option><option>PCM</option><option>PCB</option><option>Commerce with Mathematics</option><option>Commerce without Mathematics</option><option>Humanities</option></select></label>}
                <label>Application Date<input name="date" type="date" value={form.date} readOnly /></label>
                <label>Application ID<input value={applicationId} readOnly /></label>
                <label>PEN Number <small>(Personal Education Number)</small><input name="penNumber" value={form.penNumber} onChange={update} placeholder="Enter PEN number" /></label>
              </div>
            </section>

            <section className="admission-form-block" aria-labelledby="academic-background-heading">
              <header className="admission-form-block-header"><div><p>ACADEMIC BACKGROUND</p><h2 id="academic-background-heading">Previous school details</h2></div></header>
              <div className="admission-fields">
                <label>Previous School<input name="previousSchool" value={form.previousSchool} onChange={update} placeholder="Enter previous school name" /></label>
                <label>Current Class <em>*</em><select name="currentClass" value={form.currentClass} onChange={update} required><option disabled>Select current class</option>{currentClassOptions.filter(([, rank]) => form.class === "Select class" || rank <= classRank[form.class]).map(([className]) => <option key={className}>{className}</option>)}</select></label>
                <label>Board<select name="board" value={form.board} onChange={update}><option disabled>Select board</option><option>CBSE</option><option>ICSE</option><option>State Board</option><option>IB</option><option>Other</option></select></label>
                {form.board === "Other" && <label>Specify Board <em>*</em><input name="boardOther" value={form.boardOther} onChange={update} placeholder="Enter board name" required /></label>}
                <label>Medium<select name="medium" value={form.medium} onChange={update}><option>English</option><option>Hindi</option><option>Other</option></select></label>
              </div>
            </section>
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
