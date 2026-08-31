import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Parent_Guardian.css";

const steps = ["Admission Details", "Student Information", "Parent / Guardian", "Residential Background", "Academic Background", "Documents", "Review & Submit"];

const families = {
  Father: { fullName: "Rajesh Sharma", organization: "TCS", mobile: "9876543210", email: "rajesh.sharma@example.com" },
  Mother: { fullName: "Priya Sharma", organization: "Sheerwood Public School", mobile: "9876543211", email: "priya.sharma@example.com" },
};

const fieldLabels = [["fullName", "Full Name"], ["organization", "Organization"], ["mobile", "Mobile Number"], ["email", "Email Address"]];

export default function ParentGuardian() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Father");
  const [family, setFamily] = useState(families);
  const [photos, setPhotos] = useState({ Father: "", Mother: "" });
  const [message, setMessage] = useState("");
  const fatherUploadRef = useRef(null);
  const motherUploadRef = useRef(null);
  const photoUrlsRef = useRef(new Set());
  const current = family[activeTab];
  const photo = photos[activeTab];

  useEffect(() => () => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function update(event) {
    const { name, value } = event.target;
    setFamily((details) => ({ ...details, [activeTab]: { ...details[activeTab], [name]: value } }));
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Please choose a JPG or PNG image that is no larger than 5 MB.");
      event.target.value = "";
      return;
    }

    const nextPhotoUrl = URL.createObjectURL(file);
    setPhotos((currentPhotos) => {
      const previousPhotoUrl = currentPhotos[activeTab];
      if (previousPhotoUrl) {
        URL.revokeObjectURL(previousPhotoUrl);
        photoUrlsRef.current.delete(previousPhotoUrl);
      }
      photoUrlsRef.current.add(nextPhotoUrl);
      return { ...currentPhotos, [activeTab]: nextPhotoUrl };
    });
    setMessage(`${activeTab}'s photograph updated successfully.`);
  }

  function saveAndContinue(event) {
    event.preventDefault();
    if (!current.fullName || !current.mobile || !current.email) {
      setMessage(`Please complete the required ${activeTab.toLowerCase()} details.`);
      return;
    }
    navigate("/application/residential");
  }

  return (
    <main className="guardian-page">
      <header className="guardian-header">
        <Link className="guardian-brand" to="/dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <div className="guardian-account"><span>Academic session <b>2027–28</b></span><i>SP</i></div>
      </header>

      <section className="guardian-shell">
        <div className="guardian-main">
          <div className="guardian-title"><div><p className="guardian-kicker">NEW APPLICATION</p><h1>Parent / Guardian Information</h1><p>Please provide the primary contact details for the student.</p></div><button onClick={() => navigate("/dashboard")}>← Back to dashboard</button></div>

          <ol className="guardian-steps" aria-label="Application progress">
            {steps.map((step, index) => <li className={index === 2 ? "current" : index < 2 ? "complete" : ""} key={step}><span>{index < 2 ? "✓" : index + 1}</span><b>{step}</b></li>)}
          </ol>

          <div className="guardian-tabs" role="tablist" aria-label="Parent information type">
            {Object.keys(families).map((tab) => <button className={activeTab === tab ? "active" : ""} key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => { setActiveTab(tab); setMessage(""); }}>{tab} Information</button>)}
          </div>

          {message && <div className="guardian-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}

          <form className="guardian-form" onSubmit={saveAndContinue}>
            <div className="guardian-fields">
              {fieldLabels.map(([name, label]) => <label key={name}>{label} {(name === "fullName" || name === "mobile" || name === "email") && <em>*</em>}<input name={name} type={name === "email" ? "email" : "text"} inputMode={name === "mobile" ? "numeric" : undefined} value={current[name]} onChange={update} required={name === "fullName" || name === "mobile" || name === "email"} /></label>)}
            </div>
            <div className="guardian-photo-row">
              <div><span>{activeTab}'s Photograph</span><small>JPG or PNG, maximum 5 MB</small></div>
              <div className="guardian-photo">{photo ? <img src={photo} alt={`${activeTab} photo preview`} /> : <span>{current.fullName.split(" ").filter(Boolean).map((name) => name[0]).slice(0, 2).join("") || activeTab[0]}</span>}</div>
              <input ref={activeTab === "Father" ? fatherUploadRef : motherUploadRef} type="file" accept="image/png,image/jpeg" onChange={selectPhoto} hidden />
              <button type="button" className="guardian-change-photo" onClick={() => (activeTab === "Father" ? fatherUploadRef : motherUploadRef).current?.click()}>{photo ? "● Change Photo" : "● Upload Photo"}</button>
            </div>
            <div className="guardian-actions"><button type="button" className="guardian-back" onClick={() => navigate("/student-information")}>← Back</button><button className="guardian-next" type="submit">Save &amp; Next <span>→</span></button></div>
          </form>
        </div>

        <aside className="guardian-help">
          <section className="guardian-assistant"><div><span>✦</span><p><b>Sheerwood Assistant</b><small><i /> Online</small></p></div><button onClick={() => navigate("/ai-assistant")}>Ask a question →</button></section>
          <section className="guardian-help-card"><h2>Quick Help</h2><button onClick={() => setMessage("You will need the student's birth certificate, passport photograph and previous school records.")}>What documents are required?</button><button onClick={() => setMessage("For Class 1, the student should be 5 years old by 31 March.")}>What is the age criteria for Class 1?</button><button onClick={() => setMessage("Transport routes can be selected after student information is completed.")}>How do I enroll for transport?</button><button onClick={() => setMessage("Our admissions team can help with sibling applications.")}>Is a sibling facility available?</button><input placeholder="Type your question..." aria-label="Ask a question" /></section>
        </aside>
      </section>
    </main>
  );
}
