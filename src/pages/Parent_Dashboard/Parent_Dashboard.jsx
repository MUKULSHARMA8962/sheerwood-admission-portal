import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getNewAdmissionId } from "../../services/admission";
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

const initialForm = {
  session: "2027–28",
  date: "2027-04-24",
  class: "Select class",
  stream: "Select stream",
  category: "Regular",
  previousSchool: "",
  currentClass: "",
  board: "Select board",
  boardOther: "",
  medium: "English",
  transport: "Yes",
};

export default function ParentDashboard() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const applicationId = getNewAdmissionId();

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
    navigate("/student-information");
  }

  return (
    <main className="admission-page">
      <header className="admission-header">
        <Link className="admission-brand" to="/new-user-dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <div className="admission-account"><span>Academic session <b>2027–28</b></span><i>SP</i></div>
      </header>

      <section className="admission-shell">
        <div className="admission-main">
          <div className="admission-title"><div><p className="admission-kicker">STEP 2 OF 7 · NEW APPLICATION</p><h1>Admission Details</h1><p>Tell us about the class and school background for this application.</p></div><button onClick={() => navigate("/new-user-dashboard")}>← Back to dashboard</button></div>

          <ol className="application-steps" aria-label="Application progress">
            {steps.map(([number, label, status]) => (
              <li className={status} key={label}>
                <span>{number}</span><b>{label}</b>
              </li>
            ))}
          </ol>

          {message && <div className="form-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}

          <form className="admission-form" onSubmit={(event) => { event.preventDefault(); continueApplication(); }}>
            <label>Academic Session <em>*</em><select name="session" value={form.session} onChange={update}><option>2027–28</option><option>2028–29</option></select></label>
            <label>Class Applying For <em>*</em><select name="class" value={form.class} onChange={update} required><option disabled>Select class</option><option>Nursery</option><option>Class 1</option><option>Class 2</option><option>Class 3</option><option>Class 4</option><option>Class 5</option><option>Class 6</option><option>Class 7</option><option>Class 8</option><option>Class 9</option><option>Class 11</option></select></label>
            {form.class === "Class 11" && <label>Stream <em>*</em><select name="stream" value={form.stream} onChange={update} required><option disabled>Select stream</option><option>PCMB</option><option>PCM</option><option>PCB</option><option>Commerce with Mathematics</option><option>Commerce without Mathematics</option><option>Humanities</option></select></label>}
            <label>Admission Category <em>*</em><select name="category" value={form.category} onChange={update}><option>Regular</option><option>Transfer</option><option>Sibling</option></select></label>
            <label>Application Date <em>*</em><input name="date" type="date" value={form.date} onChange={update} /></label>
            <label>Application ID<input value={applicationId} readOnly /></label>
            <label>Previous School<input name="previousSchool" value={form.previousSchool} onChange={update} placeholder="Enter previous school name" /></label>
            <label>Current Class<input name="currentClass" value={form.currentClass} onChange={update} placeholder="For example, Class 4" /></label>
            <label>Board<select name="board" value={form.board} onChange={update}><option disabled>Select board</option><option>CBSE</option><option>ICSE</option><option>State Board</option><option>IB</option><option>Other</option></select></label>
            {form.board === "Other" && <label>Specify Board <em>*</em><input name="boardOther" value={form.boardOther} onChange={update} placeholder="Enter board name" required /></label>}
            <label>Medium<select name="medium" value={form.medium} onChange={update}><option>English</option><option>Hindi</option><option>Other</option></select></label>
            <label>Transport Requirement<select name="transport" value={form.transport} onChange={update}><option>Yes</option><option>No</option></select></label>
            <div className="form-actions"><button type="button" className="save-draft" onClick={saveDraft}>Save Draft</button><button className="next-step" type="submit">Next <span>→</span></button></div>
          </form>
        </div>

        <aside className="admission-help">
          <section className="help-assistant"><div><span>✦</span><p><b>Sheerwood Assistant</b><small><i /> Online</small></p></div><button onClick={() => navigate("/ai-assistant")}>Ask a question →</button></section>
          <section className="help-card"><h2>Quick Help</h2><button onClick={() => setMessage("You will need the student's birth certificate, passport photograph and previous school records.")}>What documents are required?</button><button onClick={() => setMessage("For Class 1, students should be 5 years old by 31 March of the admission year.")}>What is the age criteria for Class 1?</button><button onClick={() => setMessage("Transport routes can be selected after student information is completed.")}>How do I enroll for transport?</button><button onClick={() => setMessage("Our admissions team can help with sibling applications.")}>Is a sibling facility available?</button></section>
        </aside>
      </section>
    </main>
  );
}
