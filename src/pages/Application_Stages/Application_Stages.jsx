import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./Application_Stages.css";
import "../DocumentUploadStatus.css";

const steps = ["Admission Details", "Student Information", "Parent / Guardian", "Residential", "Academic", "Medical", "Transport & Hostel", "Documents", "Review & Submit"];

const stageConfig = {
  residential: { title: "Residential Information", index: 3, previous: "/parent-guardian", next: "/application/academic" },
  academic: { title: "Academic Background", index: 4, previous: "/application/residential", next: "/application/medical" },
  medical: { title: "Medical Information", index: 5, previous: "/application/academic", next: "/application/transport" },
  transport: { title: "Transport & Hostel", index: 6, previous: "/application/medical", next: "/application/documents" },
  documents: { title: "Document Upload", index: 7, previous: "/application/transport", next: "/application/review" },
  review: { title: "Review Application", index: 8, previous: "/application/documents", next: "/fee-payment" },
};

const quickAnswers = {
  "What documents are required?": "Please keep the birth certificate, Aadhaar card, passport photo, previous report card and transfer certificate ready.",
  "What is the age criteria for Class 1?": "For Class 1, students should be 5 years old by 31 March of the admission year.",
  "How can I apply for transport?": "Select your preferred pickup point on the Transport & Hostel step.",
  "Is hostel facility available?": "Hostel availability depends on the selected class and campus.",
};

function PortalHeader() {
  return <header className="stage-header"><Link className="stage-brand" to="/dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link><div className="stage-account"><span>Academic session <b>2027–28</b></span><i>SP</i></div></header>;
}

function Progress({ index }) {
  return <ol className="stage-progress" aria-label="Application progress">{steps.map((step, stepIndex) => <li className={stepIndex === index ? "current" : stepIndex < index ? "complete" : ""} key={step}><span>{stepIndex < index ? "✓" : stepIndex + 1}</span><b>{step}</b></li>)}</ol>;
}

function HelpPanel({ onAsk, onOpenAssistant }) {
  return <aside className="stage-help"><section className="stage-assistant"><div><span>✦</span><p><b>Sheerwood Assistant</b><small><i /> Online</small></p></div><button onClick={onOpenAssistant}>Ask a question →</button></section><section className="stage-help-card"><h2>Quick Help</h2>{Object.keys(quickAnswers).map((question) => <button key={question} onClick={() => onAsk(quickAnswers[question])}>{question}</button>)}<input placeholder="Type your question..." aria-label="Ask a question" /></section></aside>;
}

function Field({ label, required, children }) {
  return <label className="stage-field">{label} {required && <em>*</em>}{children}</label>;
}

function ResidentialForm({ form, update }) {
  const [addressTab, setAddressTab] = useState("Permanent Address");
  return <><div className="stage-tabs">{["Permanent Address", "Correspondence Address"].map((tab) => <button key={tab} className={addressTab === tab ? "active" : ""} type="button" onClick={() => setAddressTab(tab)}>{tab}</button>)}</div><div className="stage-fields residential-fields"><Field label="Address Line 1" required><input name="address1" value={form.address1} onChange={update} /></Field><Field label="Address Line 2"><input name="address2" value={form.address2} onChange={update} /></Field><div className="map-card"><span>●</span><b>{addressTab}</b><small>Greenfield Avenue</small></div><Field label="City" required><input name="city" value={form.city} onChange={update} /></Field><Field label="State" required><select name="state" value={form.state} onChange={update}><option>Karnataka</option><option>Delhi</option><option>Maharashtra</option></select></Field><Field label="PIN Code" required><input name="pin" value={form.pin} onChange={update} /></Field><Field label="Country" required><select name="country" value={form.country} onChange={update}><option>India</option><option>Other</option></select></Field><Field label="Emergency Contact Number" required><input name="emergency" value={form.emergency} onChange={update} /></Field></div></>;
}

function AcademicForm({ form, update, setMessage }) {
  const reportRef = useRef(null);
  const transferRef = useRef(null);
  return <div className="stage-fields academic-fields"><Field label="Current School" required><select name="school" value={form.school} onChange={update}><option>Greenfield Public School</option><option>Other school</option></select></Field><Field label="Current Class" required><select name="currentClass" value={form.currentClass} onChange={update}><option>Class 2</option><option>Class 1</option><option>Class 3</option></select></Field><Field label="Board" required><select name="board" value={form.board} onChange={update}><option>CBSE</option><option>ICSE</option><option>State Board</option></select></Field><Field label="Percentage / Grade" required><select name="grade" value={form.grade} onChange={update}><option>85%</option><option>A</option><option>A+</option></select></Field><div className="upload-group"><b>Upload Report Card <em>*</em></b><input ref={reportRef} type="file" hidden onChange={(event) => { if (event.target.files?.[0]) setMessage(`${event.target.files[0].name} uploaded.`); }} /><button type="button" onClick={() => reportRef.current?.click()}>report_card.pdf <span>⇧</span></button><input ref={transferRef} type="file" hidden onChange={(event) => { if (event.target.files?.[0]) setMessage(`${event.target.files[0].name} uploaded.`); }} /><button type="button" onClick={() => transferRef.current?.click()}>transfer_cert.pdf <span>⇧</span></button></div></div>;
}

function MedicalForm({ form, update }) {
  return <div className="stage-fields"><Field label="Blood Group" required><select name="blood" value={form.blood} onChange={update}><option>B+</option><option>A+</option><option>O+</option><option>AB+</option></select></Field><Field label="Any Allergies"><input name="allergies" value={form.allergies} onChange={update} /></Field><Field label="Chronic Medical Condition"><select name="condition" value={form.condition} onChange={update}><option>No</option><option>Yes</option></select></Field><Field label="Disability (If any)"><select name="disability" value={form.disability} onChange={update}><option>No</option><option>Yes</option></select></Field><Field label="Vaccinated Up to Date" required><select name="vaccinated" value={form.vaccinated} onChange={update}><option>Yes</option><option>No</option></select></Field><Field label="Emergency Contact (Doctor)"><input name="doctor" value={form.doctor} onChange={update} /></Field></div>;
}

function TransportForm({ form, update }) {
  return <div className="stage-fields"><Field label="Transport Required" required><select name="transport" value={form.transport} onChange={update}><option>Yes</option><option>No</option></select></Field><Field label="Pickup Point" required><select name="pickup" value={form.pickup} onChange={update}><option>HBR Layout</option><option>Greenfield Gate</option><option>City Center</option></select></Field><Field label="Drop Point" required><select name="drop" value={form.drop} onChange={update}><option>Greenfield School</option><option>HBR Layout</option><option>City Center</option></select></Field><Field label="Hostel Required" required><select name="hostel" value={form.hostel} onChange={update}><option>No</option><option>Yes</option></select></Field><Field label="Diet Preference"><select name="diet" value={form.diet} onChange={update}><option>Vegetarian</option><option>Non-vegetarian</option><option>Jain</option></select></Field><Field label="Special Instructions"><input name="instructions" value={form.instructions} onChange={update} /></Field></div>;
}

function DocumentsForm({ setMessage }) {
  const fileRef = useRef(null);
  const [documents, setDocuments] = useState([
    { title: "Birth Certificate", file: "birth_certificate.pdf", status: "Verified" },
    { title: "Aadhaar Card", file: "aadhaar_card.pdf", status: "Verified" },
    { title: "Passport Size Photo", file: "passport_photo.jpg", status: "Verified" },
    { title: "Transfer Certificate", file: "Upload document", status: "Required" },
    { title: "Medical Certificate", file: "medical_certificate.pdf", status: "Verified" },
  ]);
  const chooseFile = (index) => { fileRef.current.dataset.index = index; fileRef.current.click(); };
  const uploaded = (event) => { const file = event.target.files?.[0]; const index = Number(event.target.dataset.index); if (!file) return; setDocuments((current) => current.map((document, documentIndex) => documentIndex === index ? { ...document, file: file.name, status: "Uploaded" } : document)); setMessage(`${file.name} uploaded and sent for verification.`); };
  return <><p className="document-intro">Upload Required Documents <small>Documents marked verified have already been approved by the admissions team.</small></p><div className="document-list">{documents.map((document, index) => <button className={document.status.toLowerCase()} type="button" key={document.title} onClick={() => chooseFile(index)}><span>▣</span><b>{document.title}</b><em>{document.file}</em><i>{document.status === "Verified" ? "✓" : document.status === "Uploaded" ? "↟" : "⇧"}</i><small>{document.status}</small></button>)}</div><input ref={fileRef} type="file" hidden onChange={uploaded} /></>;
}

function ReviewForm({ navigate }) {
  return <><p className="review-intro">Review Your Application</p><div className="review-list">{steps.slice(0, -1).map((step) => <button type="button" key={step} onClick={() => navigate(step === "Admission Details" ? "/admission-details" : step === "Student Information" ? "/student-information" : step === "Parent / Guardian" ? "/parent-guardian" : `/application/${step === "Residential" ? "residential" : step === "Academic" ? "academic" : step === "Medical" ? "medical" : step === "Transport & Hostel" ? "transport" : "documents"}`)}><span>{step}</span><b>✓ Completed</b><i>›</i></button>)}</div></>;
}

const initialForm = { address1: "123, Greenfield Avenue", address2: "Near City Center Mall", city: "Bangalore", state: "Karnataka", pin: "560000", country: "India", emergency: "9876543210", school: "Greenfield Public School", currentClass: "Class 2", board: "CBSE", grade: "85%", blood: "B+", allergies: "Peanuts", condition: "No", disability: "No", vaccinated: "Yes", doctor: "Dr. Ramesh (9876543210)", transport: "Yes", pickup: "HBR Layout", drop: "Greenfield School", hostel: "No", diet: "Vegetarian", instructions: "N/A" };

export default function ApplicationStages() {
  const { stage } = useParams();
  const navigate = useNavigate();
  const config = stageConfig[stage] || stageConfig.residential;
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const save = (event) => { event.preventDefault(); if (stage === "review") { navigate(config.next); return; } navigate(config.next); };
  const renderForm = () => { if (stage === "academic") return <AcademicForm form={form} update={update} setMessage={setMessage} />; if (stage === "medical") return <MedicalForm form={form} update={update} />; if (stage === "transport") return <TransportForm form={form} update={update} />; if (stage === "documents") return <DocumentsForm setMessage={setMessage} />; if (stage === "review") return <ReviewForm navigate={navigate} />; return <ResidentialForm form={form} update={update} />; };
  return <main className="stage-page"><PortalHeader /><section className="stage-shell"><div className="stage-main"><div className="stage-title"><div><p>NEW APPLICATION</p><h1>{config.title}</h1><small>{stage === "review" ? "Review every section before you submit your application." : "Complete this section to continue your admission application."}</small></div><button onClick={() => navigate("/dashboard")}>← Back to dashboard</button></div><Progress index={config.index} />{message && <div className="stage-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}<form className={`stage-form ${stage}`} onSubmit={save}>{renderForm()}<div className="stage-actions"><button type="button" className="stage-back" onClick={() => navigate(config.previous)}>← Back</button><button className="stage-next" type="submit">{stage === "review" ? "Submit Application" : "Save & Next"} <span>→</span></button></div></form></div><HelpPanel onAsk={setMessage} onOpenAssistant={() => navigate("/ai-assistant")} /></section></main>;
}
