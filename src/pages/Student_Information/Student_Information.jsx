import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Student_Information.css";

const steps = [
  "Admission Details",
  "Student Information",
  "Parent / Guardian",
  "Residential Background",
  "Academic Background",
  "Medical Information",
  "Transport & Hostel",
  "Documents",
  "Review & Submit",
];

const initialForm = {
  firstName: "Aadhya",
  middleName: "Kumar",
  lastName: "Sharma",
  birthDate: "2020-01-10",
  gender: "Female",
  bloodGroup: "B+",
  nationality: "Indian",
  religion: "Hindu",
  aadhaar: "1254 5678 9012",
};

export default function StudentInformation() {
  const navigate = useNavigate();
  const uploadRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState("");

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhoto(URL.createObjectURL(file));
    setMessage("Student photo updated successfully.");
  }

  function saveAndContinue(event) {
    event.preventDefault();
    navigate("/parent-guardian");
  }

  return (
    <main className="student-page">
      <header className="student-header">
        <Link className="student-brand" to="/dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <div className="student-account"><span>Academic session <b>2027–28</b></span><i>SP</i></div>
      </header>

      <section className="student-shell">
        <div className="student-main">
          <div className="student-title"><div><p className="student-kicker">NEW APPLICATION</p><h1>Student Information</h1><p>Tell us about the student applying for admission.</p></div><button onClick={() => navigate("/dashboard")}>← Back to dashboard</button></div>

          <ol className="student-steps" aria-label="Application progress">
            {steps.map((step, index) => <li className={index === 1 ? "current" : index < 1 ? "complete" : ""} key={step}><span>{index < 1 ? "✓" : index + 1}</span><b>{step}</b></li>)}
          </ol>

          {message && <div className="student-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}

          <form className="student-form" onSubmit={saveAndContinue}>
            <h2>Personal Details</h2>
            <div className="student-fields">
              <label>First Name <em>*</em><input name="firstName" value={form.firstName} onChange={update} required /></label>
              <label>Middle Name<input name="middleName" value={form.middleName} onChange={update} /></label>
              <label>Last Name <em>*</em><input name="lastName" value={form.lastName} onChange={update} required /></label>
              <label>Date of Birth <em>*</em><input name="birthDate" type="date" value={form.birthDate} onChange={update} required /></label>
              <label>Gender <em>*</em><select name="gender" value={form.gender} onChange={update}><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
              <label>Blood Group<input name="bloodGroup" value={form.bloodGroup} onChange={update} placeholder="e.g. B+" /></label>
              <label>Nationality <em>*</em><select name="nationality" value={form.nationality} onChange={update}><option>Indian</option><option>Other</option></select></label>
              <label>Religion<select name="religion" value={form.religion} onChange={update}><option>Hindu</option><option>Muslim</option><option>Christian</option><option>Sikh</option><option>Other</option></select></label>
              <label>Aadhaar Number<input name="aadhaar" value={form.aadhaar} onChange={update} inputMode="numeric" /></label>
            </div>

            <div className="student-photo-row"><div><span>Student Photo</span><small>JPG or PNG, maximum 5 MB</small></div><div className="student-photo">{photo ? <img src={photo} alt="Selected student" /> : <span>{form.firstName.slice(0, 1)}{form.lastName.slice(0, 1)}</span>}</div><input ref={uploadRef} type="file" accept="image/png,image/jpeg" onChange={selectPhoto} hidden /><button type="button" className="change-photo" onClick={() => uploadRef.current?.click()}>● Change Photo</button></div>

            <div className="student-actions"><button type="button" className="student-back" onClick={() => navigate("/admission-details")}>← Back</button><button className="student-next" type="submit">Save &amp; Next <span>→</span></button></div>
          </form>
        </div>

        <aside className="student-help">
          <section className="student-assistant"><div><span>✦</span><p><b>Sheerwood Assistant</b><small><i /> Online</small></p></div><button onClick={() => navigate("/ai-assistant")}>Ask a question →</button></section>
          <section className="student-help-card"><h2>Quick Help</h2><button onClick={() => setMessage("You will need the student's birth certificate, passport photograph and previous school records.")}>What documents are required?</button><button onClick={() => setMessage("For Class 1, the student should be 5 years old by 31 March.")}>What is the age criteria for Class 1?</button><button onClick={() => setMessage("Transport routes can be selected after student information is completed.")}>How do I enroll for transport?</button><button onClick={() => setMessage("Our admissions team can help with sibling applications.")}>Is a sibling facility available?</button><input placeholder="Type your question..." aria-label="Ask a question" /></section>
        </aside>
      </section>
    </main>
  );
}
