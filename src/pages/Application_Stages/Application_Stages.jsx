import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAdmissionData, getAdmissionDocuments, saveAdmissionDraft, updateAdmissionDocument, uploadAdmissionDocument } from "../../services/admission";
import AccountMenu from "../../components/AccountMenu";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import "./Application_Stages.css";
import "./ResidentialAddress.css";
import "../DocumentUploadStatus.css";

const steps = ["Admission Details", "Student Information", "Parent / Guardian", "Residential", "Academic", "Documents", "Review & Submit"];

const stageConfig = {
  residential: { title: "Residential Information", index: 3, previous: "/parent-guardian", next: "/application/academic" },
  academic: { title: "Academic Background", index: 4, previous: "/application/residential", next: "/application/documents" },
  documents: { title: "Document Upload", index: 5, previous: "/application/academic", next: "/application/review" },
  review: { title: "Review Application", index: 6, previous: "/application/documents", next: "/fee-payment" },
};

const quickAnswers = {
  "What documents are required?": "Please keep the student's Aadhaar Card, Birth Certificate issued by the Nagar Nigam/Municipal Department, and most recent mark sheet ready. The original Transfer Certificate is submitted after admission is confirmed.",
  "How is the entrance test conducted?": "The entrance test is online, with English and Mathematics papers. Each paper is one hour. The syllabus, date and time are emailed after registration.",
  "When do admissions close?": "Admissions close as and when seats are filled. Please contact the admissions team to confirm current availability.",
};

function PortalHeader() {
  return <header className="stage-header"><Link className="stage-brand" to="/dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link><AccountMenu /></header>;
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

function AddressFields({ title, prefix, form, update, useCurrentLocation, sameAsPermanent, toggleSameAsPermanent }) {
  const isPermanentAddress = prefix === "permanent";
  const fieldName = (field) => `${prefix}${field}`;

  return <section className="residential-address-section"><h2>{title}</h2>{!isPermanentAddress && <label className="same-address-toggle"><input type="checkbox" checked={sameAsPermanent} onChange={toggleSameAsPermanent} /><span>Correspondence Address is the same as Permanent Address</span></label>}<div className="stage-fields address-section-fields"><Field label="Address Line 1" required><input name={fieldName("Address1")} value={form[fieldName("Address1")]} onChange={update} disabled={sameAsPermanent} required /></Field><Field label="Address Line 2"><input name={fieldName("Address2")} value={form[fieldName("Address2")]} onChange={update} disabled={sameAsPermanent} /></Field>{isPermanentAddress && <div className="map-card"><span>●</span><b>Permanent Address</b><small>{form.locationLabel || "Use your device location"}</small><button type="button" onClick={useCurrentLocation}>⌖ Use current location</button></div>}{isPermanentAddress && <Field label="Current Location"><input value={form.locationLabel} placeholder="Tap “Use current location”" readOnly /></Field>}<Field label="City" required><input name={fieldName("City")} value={form[fieldName("City")]} onChange={update} disabled={sameAsPermanent} required /></Field><Field label="State" required><select name={fieldName("State")} value={form[fieldName("State")]} onChange={update} disabled={sameAsPermanent}><option>Karnataka</option><option>Delhi</option><option>Maharashtra</option></select></Field><Field label="PIN Code" required><input name={fieldName("Pin")} value={form[fieldName("Pin")]} onChange={update} disabled={sameAsPermanent} inputMode="numeric" required /></Field><Field label="Country" required><select name={fieldName("Country")} value={form[fieldName("Country")]} onChange={update} disabled={sameAsPermanent}><option>India</option><option>Other</option></select></Field>{isPermanentAddress && <Field label="Emergency Contact Number" required><input name="emergency" value={form.emergency} onChange={update} inputMode="numeric" required /></Field>}</div></section>;
}

function ResidentialForm({ form, update, useCurrentLocation, toggleSameAsPermanent }) {
  return <div className="residential-addresses"><AddressFields title="Permanent Address" prefix="permanent" form={form} update={update} useCurrentLocation={useCurrentLocation} /><AddressFields title="Correspondence Address" prefix="correspondence" form={form} update={update} useCurrentLocation={useCurrentLocation} sameAsPermanent={form.sameAsPermanent} toggleSameAsPermanent={toggleSameAsPermanent} /></div>;
}

function AcademicForm({ setMessage, accessToken }) {
  const fileRef = useRef(null);
  const selectedDocument = useRef("");
  const [documents, setDocuments] = useState(getAdmissionDocuments);

  function chooseFile(documentId) {
    selectedDocument.current = documentId;
    fileRef.current?.click();
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    const documentId = selectedDocument.current;
    if (!file || !documentId) return;
    try {
      setMessage(`Uploading ${file.name}…`);
      await saveAdmissionDraft(accessToken, {});
      const uploaded = await uploadAdmissionDocument(accessToken, documentId, file);
      const updatedDocuments = updateAdmissionDocument(documentId, "Submitted", "", uploaded.file_name, {
        storageId: uploaded.id,
        sizeBytes: uploaded.size_bytes,
        contentType: uploaded.content_type,
      });
      setDocuments(updatedDocuments);
      await saveAdmissionDraft(accessToken, { academicDocuments: updatedDocuments });
      setMessage(`${uploaded.file_name} uploaded and saved securely.`);
    } catch (error) {
      setMessage(error.message);
    }
    event.target.value = "";
  }

  return <div className="stage-fields academic-fields"><div className="upload-group"><b>Upload Academic Documents</b>{documents.map((document) => <button type="button" key={document.id} onClick={() => chooseFile(document.id)}><span>{document.file || `Upload ${document.name}`}{["report-card", "aadhaar-card", "birth-certificate"].includes(document.id) && <em> *</em>}</span><span>⇧</span></button>)}<input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={uploadFile} /></div></div>;
}

function DocumentsForm({ setMessage, accessToken }) {
  const fileRef = useRef(null);
  const [documents, setDocuments] = useState(getAdmissionDocuments);
  const chooseFile = (index) => { fileRef.current.dataset.index = index; fileRef.current.click(); };
  const uploaded = async (event) => {
    const file = event.target.files?.[0];
    const index = Number(event.target.dataset.index);
    if (!file) return;
    const document = documents[index];
    try {
      setMessage(`Uploading ${file.name}…`);
      await saveAdmissionDraft(accessToken, {});
      const storedDocument = await uploadAdmissionDocument(accessToken, document.id, file);
      const updatedDocuments = updateAdmissionDocument(document.id, "Submitted", "", storedDocument.file_name, {
        storageId: storedDocument.id,
        sizeBytes: storedDocument.size_bytes,
        contentType: storedDocument.content_type,
      });
      setDocuments(updatedDocuments);
      await saveAdmissionDraft(accessToken, { uploadedDocuments: updatedDocuments });
      setMessage(`${storedDocument.file_name} uploaded and saved securely.`);
    } catch (error) {
      setMessage(error.message);
    }
    event.target.value = "";
  };
  return <><p className="document-intro">Upload Required Documents <small>Uploaded documents are submitted for admin approval. Documents not uploaded remain marked Not Uploaded.</small></p><div className="document-list">{documents.map((document, index) => <button className={document.status.toLowerCase().replaceAll(" ", "-")} type="button" key={document.id} onClick={() => chooseFile(index)}><span>▣</span><b>{document.name}</b><em>{document.file || "Not uploaded"}</em><i>{document.status === "Approved" ? "✓" : document.status === "Submitted" ? "◷" : "⇧"}</i><small>{document.status === "Submitted" ? "Waiting for approval" : document.status}</small></button>)}</div><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={uploaded} /></>;
}

function ReviewForm({ navigate }) {
  return <><p className="review-intro">Review Your Application</p><div className="review-list">{steps.slice(0, -1).map((step) => <button type="button" key={step} onClick={() => navigate(step === "Admission Details" ? "/admission-details" : step === "Student Information" ? "/student-information" : step === "Parent / Guardian" ? "/parent-guardian" : `/application/${step === "Residential" ? "residential" : step === "Academic" ? "academic" : "documents"}`)}><span>{step}</span><b>✓ Completed</b><i>›</i></button>)}</div></>;
}

const addressFieldSuffixes = ["Address1", "Address2", "City", "State", "Pin", "Country"];
const initialForm = { permanentAddress1: "123, Greenfield Avenue", permanentAddress2: "Near City Center Mall", permanentCity: "Bangalore", permanentState: "Karnataka", permanentPin: "560000", permanentCountry: "India", correspondenceAddress1: "", correspondenceAddress2: "", correspondenceCity: "", correspondenceState: "Karnataka", correspondencePin: "", correspondenceCountry: "India", sameAsPermanent: false, emergency: "9876543210", locationLabel: "" };

export default function ApplicationStages() {
  const { stage } = useParams();
  const navigate = useNavigate();
  const config = stageConfig[stage] || stageConfig.residential;
  const { session } = useCognitoAuth();
  const [form, setForm] = useState(() => ({ ...initialForm, ...getAdmissionData().residential }));
  const [message, setMessage] = useState("");
  const update = (event) => setForm((current) => {
    const { name, value } = event.target;
    const next = { ...current, [name]: value };
    if (current.sameAsPermanent && name.startsWith("permanent")) {
      const suffix = name.replace("permanent", "");
      if (addressFieldSuffixes.includes(suffix)) next[`correspondence${suffix}`] = value;
    }
    return next;
  });
  const toggleSameAsPermanent = (event) => setForm((current) => {
    if (!event.target.checked) return { ...current, sameAsPermanent: false };
    const correspondenceAddress = addressFieldSuffixes.reduce((address, suffix) => ({ ...address, [`correspondence${suffix}`]: current[`permanent${suffix}`] }), {});
    return { ...current, ...correspondenceAddress, sameAsPermanent: true };
  });
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

        setForm((current) => {
          const permanentAddress = { permanentAddress1: addressLine1 || current.permanentAddress1, permanentAddress2: addressLine2 || current.permanentAddress2, permanentCity: city || current.permanentCity, permanentState: address.state || current.permanentState, permanentPin: address.postcode || current.permanentPin, permanentCountry: address.country || current.permanentCountry };
          const correspondenceAddress = current.sameAsPermanent ? addressFieldSuffixes.reduce((address, suffix) => ({ ...address, [`correspondence${suffix}`]: permanentAddress[`permanent${suffix}`] }), {}) : {};
          return { ...current, ...permanentAddress, ...correspondenceAddress, locationLabel: displayName ? displayName.split(",").slice(0, 2).join(", ") : coordinates };
        });
        setMessage("Current location added to the address fields.");
      } catch {
        setForm((current) => ({ ...current, locationLabel: coordinates }));
        setMessage("Location coordinates captured. Please complete the address fields manually.");
      }
    }, () => setMessage("Location permission was not granted. Please enter the address manually."), { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };
  const save = async (event) => { event.preventDefault(); try { await saveAdmissionDraft(session?.accessToken, stage === "residential" ? { residential: form } : {}, stage === "review" ? "submitted" : "draft"); navigate(config.next); } catch (error) { setMessage(error.message); } };
  const renderForm = () => { if (stage === "academic") return <AcademicForm setMessage={setMessage} accessToken={session?.accessToken} />; if (stage === "documents") return <DocumentsForm setMessage={setMessage} accessToken={session?.accessToken} />; if (stage === "review") return <ReviewForm navigate={navigate} />; return <ResidentialForm form={form} update={update} useCurrentLocation={useCurrentLocation} toggleSameAsPermanent={toggleSameAsPermanent} />; };
  return <main className="stage-page"><PortalHeader /><section className="stage-shell"><div className="stage-main"><div className="stage-title"><div><p>NEW APPLICATION</p><h1>{config.title}</h1><small>{stage === "review" ? "Review every section before you submit your application." : "Complete this section to continue your admission application."}</small></div><button onClick={() => navigate("/dashboard")}>← Back to dashboard</button></div><Progress index={config.index} />{message && <div className="stage-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}<form className={`stage-form ${stage}`} onSubmit={save}>{renderForm()}<div className="stage-actions"><button type="button" className="stage-back" onClick={() => navigate(config.previous)}>← Back</button><button className="stage-next" type="submit">{stage === "review" ? "Submit Application" : "Save & Next"} <span>→</span></button></div></form></div><HelpPanel onAsk={setMessage} onOpenAssistant={() => navigate("/ai-assistant")} /></section></main>;
}
