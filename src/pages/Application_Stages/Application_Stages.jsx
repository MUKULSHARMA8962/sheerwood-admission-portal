import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./Application_Stages.css";
import "../DocumentUploadStatus.css";

const steps = ["Admission Details", "Student Information", "Parent / Guardian", "Residential", "Academic", "Documents", "Review & Submit"];

const stageConfig = {
  residential: { title: "Residential Information", index: 3, previous: "/parent-guardian", next: "/application/academic" },
  academic: { title: "Academic Background", index: 4, previous: "/application/residential", next: "/application/documents" },
  documents: { title: "Document Upload", index: 5, previous: "/application/academic", next: "/application/review" },
  review: { title: "Review Application", index: 6, previous: "/application/documents", next: "/fee-payment" },
};

const quickAnswers = {
  "What documents are required?": "Please keep the birth certificate, Aadhaar card, passport photo, previous report card and transfer certificate ready.",
  "What is the age criteria for Class 1?": "For Class 1, students should be 5 years old by 31 March of the admission year.",
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

function AddressFields({ title, prefix, form, update, useCurrentLocation }) {
  const isPermanentAddress = prefix === "permanent";
  const fieldName = (field) => `${prefix}${field}`;

  return <section className="residential-address-section"><h2>{title}</h2><div className="stage-fields address-section-fields"><Field label="Address Line 1" required><input name={fieldName("Address1")} value={form[fieldName("Address1")]} onChange={update} required /></Field><Field label="Address Line 2"><input name={fieldName("Address2")} value={form[fieldName("Address2")]} onChange={update} /></Field>{isPermanentAddress && <div className="map-card"><span>●</span><b>Permanent Address</b><small>{form.locationLabel || "Use your device location"}</small><button type="button" onClick={useCurrentLocation}>⌖ Use current location</button></div>}{isPermanentAddress && <Field label="Current Location"><input value={form.locationLabel} placeholder="Tap “Use current location”" readOnly /></Field>}<Field label="City" required><input name={fieldName("City")} value={form[fieldName("City")]} onChange={update} required /></Field><Field label="State" required><select name={fieldName("State")} value={form[fieldName("State")]} onChange={update}><option>Karnataka</option><option>Delhi</option><option>Maharashtra</option></select></Field><Field label="PIN Code" required><input name={fieldName("Pin")} value={form[fieldName("Pin")]} onChange={update} inputMode="numeric" required /></Field><Field label="Country" required><select name={fieldName("Country")} value={form[fieldName("Country")]} onChange={update}><option>India</option><option>Other</option></select></Field>{isPermanentAddress && <Field label="Emergency Contact Number" required><input name="emergency" value={form.emergency} onChange={update} inputMode="numeric" required /></Field>}</div></section>;
}

function ResidentialForm({ form, update, useCurrentLocation }) {
  return <div className="residential-addresses"><AddressFields title="Permanent Address" prefix="permanent" form={form} update={update} useCurrentLocation={useCurrentLocation} /><AddressFields title="Correspondence Address" prefix="correspondence" form={form} update={update} useCurrentLocation={useCurrentLocation} /></div>;
}

function AcademicForm({ setMessage }) {
  const reportRef = useRef(null);
  const transferRef = useRef(null);
  return <div className="stage-fields academic-fields"><div className="upload-group"><b>Upload Academic Documents <em>*</em></b><input ref={reportRef} type="file" hidden onChange={(event) => { if (event.target.files?.[0]) setMessage(`${event.target.files[0].name} uploaded.`); }} /><button type="button" onClick={() => reportRef.current?.click()}>report_card.pdf <span>⇧</span></button><input ref={transferRef} type="file" hidden onChange={(event) => { if (event.target.files?.[0]) setMessage(`${event.target.files[0].name} uploaded.`); }} /><button type="button" onClick={() => transferRef.current?.click()}>transfer_cert.pdf <span>⇧</span></button></div></div>;
}

function DocumentsForm({ setMessage }) {
  const fileRef = useRef(null);
  const [documents, setDocuments] = useState([
    { title: "Birth Certificate", file: "birth_certificate.pdf", status: "Verified" },
    { title: "Aadhaar Card", file: "aadhaar_card.pdf", status: "Verified" },
    { title: "Passport Size Photo", file: "passport_photo.jpg", status: "Verified" },
    { title: "Transfer Certificate", file: "Upload document", status: "Required" },
  ]);
  const chooseFile = (index) => { fileRef.current.dataset.index = index; fileRef.current.click(); };
  const uploaded = (event) => { const file = event.target.files?.[0]; const index = Number(event.target.dataset.index); if (!file) return; setDocuments((current) => current.map((document, documentIndex) => documentIndex === index ? { ...document, file: file.name, status: "Uploaded" } : document)); setMessage(`${file.name} uploaded and sent for verification.`); };
  return <><p className="document-intro">Upload Required Documents <small>Documents marked verified have already been approved by the admissions team.</small></p><div className="document-list">{documents.map((document, index) => <button className={document.status.toLowerCase()} type="button" key={document.title} onClick={() => chooseFile(index)}><span>▣</span><b>{document.title}</b><em>{document.file}</em><i>{document.status === "Verified" ? "✓" : document.status === "Uploaded" ? "↟" : "⇧"}</i><small>{document.status}</small></button>)}</div><input ref={fileRef} type="file" hidden onChange={uploaded} /></>;
}

function ReviewForm({ navigate }) {
  return <><p className="review-intro">Review Your Application</p><div className="review-list">{steps.slice(0, -1).map((step) => <button type="button" key={step} onClick={() => navigate(step === "Admission Details" ? "/admission-details" : step === "Student Information" ? "/student-information" : step === "Parent / Guardian" ? "/parent-guardian" : `/application/${step === "Residential" ? "residential" : step === "Academic" ? "academic" : "documents"}`)}><span>{step}</span><b>✓ Completed</b><i>›</i></button>)}</div></>;
}

const initialForm = { permanentAddress1: "123, Greenfield Avenue", permanentAddress2: "Near City Center Mall", permanentCity: "Bangalore", permanentState: "Karnataka", permanentPin: "560000", permanentCountry: "India", correspondenceAddress1: "", correspondenceAddress2: "", correspondenceCity: "", correspondenceState: "Karnataka", correspondencePin: "", correspondenceCountry: "India", emergency: "9876543210", locationLabel: "" };

export default function ApplicationStages() {
  const { stage } = useParams();
  const navigate = useNavigate();
  const config = stageConfig[stage] || stageConfig.residential;
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Your browser does not support location services. Please enter the address manually.");
      return;
    }

    setMessage("Requesting your current location…");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const latitude = coords.latitude.toFixed(6);
      const longitude = coords.longitude.toFixed(6);
      const coordinates = `${latitude}, ${longitude}`;

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
        if (!response.ok) throw new Error("Could not find an address");
        const { address = {}, display_name: displayName } = await response.json();
        const addressLine1 = [address.house_number, address.road].filter(Boolean).join(", ");
        const addressLine2 = [address.neighbourhood, address.suburb].filter(Boolean).join(", ");
        const city = address.city || address.town || address.village || address.county;

        setForm((current) => ({ ...current, permanentAddress1: addressLine1 || current.permanentAddress1, permanentAddress2: addressLine2 || current.permanentAddress2, permanentCity: city || current.permanentCity, permanentState: address.state || current.permanentState, permanentPin: address.postcode || current.permanentPin, permanentCountry: address.country || current.permanentCountry, locationLabel: displayName ? displayName.split(",").slice(0, 2).join(", ") : coordinates }));
        setMessage("Current location added to the address fields.");
      } catch {
        setForm((current) => ({ ...current, locationLabel: coordinates }));
        setMessage("Location coordinates captured. Please complete the address fields manually.");
      }
    }, () => setMessage("Location permission was not granted. Please enter the address manually."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };
  const save = (event) => { event.preventDefault(); if (stage === "review") { navigate(config.next); return; } navigate(config.next); };
  const renderForm = () => { if (stage === "academic") return <AcademicForm setMessage={setMessage} />; if (stage === "documents") return <DocumentsForm setMessage={setMessage} />; if (stage === "review") return <ReviewForm navigate={navigate} />; return <ResidentialForm form={form} update={update} useCurrentLocation={useCurrentLocation} />; };
  return <main className="stage-page"><PortalHeader /><section className="stage-shell"><div className="stage-main"><div className="stage-title"><div><p>NEW APPLICATION</p><h1>{config.title}</h1><small>{stage === "review" ? "Review every section before you submit your application." : "Complete this section to continue your admission application."}</small></div><button onClick={() => navigate("/dashboard")}>← Back to dashboard</button></div><Progress index={config.index} />{message && <div className="stage-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}<form className={`stage-form ${stage}`} onSubmit={save}>{renderForm()}<div className="stage-actions"><button type="button" className="stage-back" onClick={() => navigate(config.previous)}>← Back</button><button className="stage-next" type="submit">{stage === "review" ? "Submit Application" : "Save & Next"} <span>→</span></button></div></form></div><HelpPanel onAsk={setMessage} onOpenAssistant={() => navigate("/ai-assistant")} /></section></main>;
}
