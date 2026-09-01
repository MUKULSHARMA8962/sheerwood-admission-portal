import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Student_Information.css";

const steps = [
  "Admission Details",
  "Student Information",
  "Parent / Guardian",
  "Residential Background",
  "Academic Background",
  "Documents",
  "Review & Submit",
];

function getLocalDate() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const initialForm = {
  firstName: "Aadhya",
  middleName: "Kumar",
  lastName: "Sharma",
  birthDate: "2020-01-10",
  placeOfBirth: "",
  gender: "Female",
  bloodGroup: "B+",
  motherTongue: "",
  nationality: "Indian",
  nationalityOther: "",
  religion: "Hindu",
  religionOther: "",
  category: "General",
  sld: "No",
  adhd: "No",
  singleParent: "No",
  responsibleParent: "",
  howHeard: "",
  howHeardOther: "",
  aadhaar: "1254 5678 9012",
};

export default function StudentInformation() {
  const navigate = useNavigate();
  const uploadRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Please choose a JPG or PNG image that is no larger than 5 MB.");
      event.target.value = "";
      return;
    }
    setPhoto(URL.createObjectURL(file));
    setMessage("Student photo updated successfully.");
  }

  function saveAndContinue(event) {
    event.preventDefault();
    if (form.birthDate > getLocalDate()) {
      setMessage("Date of Birth cannot be in the future.");
      return;
    }
    if (form.aadhaar.replace(/\D/g, "").length !== 12) {
      setMessage("Please enter a valid 12-digit Aadhaar Number.");
      return;
    }
    navigate("/parent-guardian", { state: { singleParent: form.singleParent, responsibleParent: form.responsibleParent } });
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
              <label>Date of Birth <em>*</em><input name="birthDate" type="date" value={form.birthDate} onChange={update} max={getLocalDate()} required /></label>
              <label>Place of Birth <em>*</em><input name="placeOfBirth" value={form.placeOfBirth} onChange={update} placeholder="Enter place of birth" required /></label>
              <label>Gender <em>*</em><select name="gender" value={form.gender} onChange={update}><option>Female</option><option>Male</option></select></label>
              <label>Blood Group <em>*</em><select name="bloodGroup" value={form.bloodGroup} onChange={update} required><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></label>
              <label>Mother Tongue <em>*</em><input name="motherTongue" value={form.motherTongue} onChange={update} placeholder="Enter mother tongue" required /></label>
              <label>Nationality <em>*</em><select name="nationality" value={form.nationality} onChange={update}><option>Indian</option><option>Other</option></select></label>
              {form.nationality === "Other" && <label>Specify Nationality <em>*</em><input name="nationalityOther" value={form.nationalityOther} onChange={update} placeholder="Enter nationality" required /></label>}
              <label>Religion<select name="religion" value={form.religion} onChange={update}><option>Hindu</option><option>Muslim</option><option>Christian</option><option>Sikh</option><option>Other</option></select></label>
              {form.religion === "Other" && <label>Specify Religion <em>*</em><input name="religionOther" value={form.religionOther} onChange={update} placeholder="Enter religion" required /></label>}
              <label>Category <em>*</em><select name="category" value={form.category} onChange={update}><option>General</option><option>SC</option><option>ST</option><option>OBC</option><option>Others</option></select></label>
              <label>Specific Learning Disability (SLD) <em>*</em><select name="sld" value={form.sld} onChange={update}><option>No</option><option>Yes</option></select></label>
              <label>Attention Deficit Hyperactive Disorder (ADHD) <em>*</em><select name="adhd" value={form.adhd} onChange={update}><option>No</option><option>Yes</option></select></label>
              <label>Single Parent <em>*</em><select name="singleParent" value={form.singleParent} onChange={update}><option>No</option><option>Yes</option></select></label>
              {form.singleParent === "Yes" && <label>Responsible Parent <em>*</em><select name="responsibleParent" value={form.responsibleParent} onChange={update} required><option value="" disabled>Select parent</option><option>Father</option><option>Mother</option></select></label>}
              <label>Aadhaar Number <em>*</em><input name="aadhaar" value={form.aadhaar} onChange={update} inputMode="numeric" pattern="[0-9 ]{12,14}" placeholder="1234 5678 9012" required /></label>
              <label>How did you come to know about our School? <em>*</em><select name="howHeard" value={form.howHeard} onChange={update} required><option value="" disabled>Select an option</option><option>Sibling Studying</option><option>Social Media</option><option>Media</option><option>Parents</option><option>Alumni</option><option>Google</option><option>Others</option></select></label>
              {form.howHeard === "Others" && <label>Specify how you heard about us <em>*</em><input name="howHeardOther" value={form.howHeardOther} onChange={update} placeholder="Enter details" required /></label>}
            </div>

            <div className="student-photo-row"><div><span>Student Photo</span><small>JPG or PNG, maximum 5 MB</small></div><div className="student-photo">{photo ? <img src={photo} alt="Student photo preview" /> : <span>{form.firstName.slice(0, 1)}{form.lastName.slice(0, 1)}</span>}</div><input ref={uploadRef} type="file" accept="image/png,image/jpeg" onChange={selectPhoto} hidden /><button type="button" className="change-photo" onClick={() => uploadRef.current?.click()}>{photo ? "● Change Photo" : "● Upload Photo"}</button></div>

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
