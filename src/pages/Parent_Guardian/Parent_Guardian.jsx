import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Parent_Guardian.css";
import "../PhotoRequired.css";
import AccountMenu from "../../components/AccountMenu";
import SchoolCrest from "../../components/SchoolCrest";
import { getAdmissionData, saveAdmissionDraft, uploadAdmissionDocument } from "../../services/admission";
import { useCognitoAuth } from "../../auth/useCognitoAuth";

const steps = ["OTP Verified", "Admission Details", "Student Details", "Parent Details", "Documents", "Verification", "Approval"];

const emptyGuardian = { fullName: "", occupation: "", mobile: "", email: "", aadhaar: "" };
const families = {
  Father: { ...emptyGuardian },
  Mother: { ...emptyGuardian },
};

const fieldLabels = [["fullName", "Full Name"], ["occupation", "Occupation"], ["mobile", "Mobile Number"], ["email", "Email Address"], ["aadhaar", "Aadhaar Number"]];

export default function ParentGuardian() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useCognitoAuth();
  const [family, setFamily] = useState(() => ({ ...families, ...getAdmissionData().guardians }));
  const [photos, setPhotos] = useState({ Father: "", Mother: "" });
  const [message, setMessage] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const fatherUploadRef = useRef(null);
  const motherUploadRef = useRef(null);
  const photoUrlsRef = useRef(new Set());
  const hasEditedRef = useRef(false);
  const parentTypes = location.state?.singleParent === "Yes" ? [location.state.responsibleParent] : ["Father", "Mother"];

  useEffect(() => () => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!hasEditedRef.current || !session?.accessToken) return undefined;
    const saveTimer = window.setTimeout(() => {
      setSavingDraft(true);
      saveAdmissionDraft(session.accessToken, { guardians: family })
        .catch((error) => setMessage(error.message || "Parent details could not be saved."))
        .finally(() => setSavingDraft(false));
    }, 700);
    return () => window.clearTimeout(saveTimer);
  }, [family, session?.accessToken]);

  function update(event, parentType) {
    const { name, value } = event.target;
    hasEditedRef.current = true;
    setFamily((details) => ({ ...details, [parentType]: { ...details[parentType], [name]: value } }));
  }

  async function selectPhoto(event, parentType) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Please choose a JPG or PNG image that is no larger than 5 MB.");
      event.target.value = "";
      return;
    }

    try {
      setMessage(`Uploading ${parentType.toLowerCase()}'s photograph…`);
      await saveAdmissionDraft(session?.accessToken, { guardians: family });
      const uploaded = await uploadAdmissionDocument(session?.accessToken, `${parentType.toLowerCase()}-photo`, file);
      await saveAdmissionDraft(session?.accessToken, {
        parentPhotos: {
          ...(getAdmissionData().parentPhotos || {}),
          [parentType]: { storageId: uploaded.id, file: uploaded.file_name, contentType: uploaded.content_type, sizeBytes: uploaded.size_bytes },
        },
      });

      const nextPhotoUrl = URL.createObjectURL(file);
      setPhotos((currentPhotos) => {
        const previousPhotoUrl = currentPhotos[parentType];
        if (previousPhotoUrl) {
          URL.revokeObjectURL(previousPhotoUrl);
          photoUrlsRef.current.delete(previousPhotoUrl);
        }
        photoUrlsRef.current.add(nextPhotoUrl);
        return { ...currentPhotos, [parentType]: nextPhotoUrl };
      });
      setMessage(`${parentType}'s photograph uploaded and saved securely.`);
    } catch (error) {
      setMessage(error.message);
    }

    event.target.value = "";
  }

  function saveAndContinue(event) {
    event.preventDefault();
    const savedParentPhotos = getAdmissionData().parentPhotos || {};
    for (const parentType of parentTypes) {
      const details = family[parentType];
      if (!details.fullName || !details.mobile || !details.email || !details.aadhaar) {
        setMessage(`Please complete the required ${parentType.toLowerCase()} details.`);
        return;
      }
      if (details.aadhaar.replace(/\D/g, "").length !== 12) {
        setMessage(`Please enter a valid 12-digit Aadhaar Number for ${parentType}.`);
        return;
      }
      if (!savedParentPhotos[parentType]?.file) {
        setMessage(`Please upload the mandatory ${parentType.toLowerCase()}'s photograph.`);
        return;
      }
    }
    saveAdmissionDraft(session?.accessToken, { guardians: family })
      .then(() => navigate("/application/documents"))
      .catch((error) => setMessage(error.message));
  }

  function renderParentSection(parentType) {
    const current = family[parentType];
    const photo = photos[parentType];
    const uploadRef = parentType === "Father" ? fatherUploadRef : motherUploadRef;

    return <section className="guardian-parent-section" key={parentType}>
      <h2>{parentType}'s Details</h2>
      <div className="guardian-fields">
        {fieldLabels.map(([name, label]) => <label key={name}>{name === "aadhaar" ? `${parentType}'s Aadhaar Number` : label} {(name === "fullName" || name === "mobile" || name === "email" || name === "aadhaar") && <em>*</em>}<input name={name} type={name === "email" ? "email" : "text"} inputMode={name === "mobile" || name === "aadhaar" ? "numeric" : undefined} pattern={name === "aadhaar" ? "[0-9 ]{12,14}" : undefined} value={current[name]} onChange={(event) => update(event, parentType)} required={name === "fullName" || name === "mobile" || name === "email" || name === "aadhaar"} /></label>)}
      </div>
      <div className="guardian-photo-row">
        <div><span>{parentType}'s Photograph <em>*</em><mark className="photo-required">Mandatory</mark></span><small>JPG or PNG, maximum 5 MB</small></div>
        <div className="guardian-photo">{photo ? <img src={photo} alt={`${parentType} photo preview`} /> : <span>{current.fullName.split(" ").filter(Boolean).map((name) => name[0]).slice(0, 2).join("") || parentType[0]}</span>}</div>
        <input ref={uploadRef} type="file" accept="image/png,image/jpeg" onChange={(event) => selectPhoto(event, parentType)} hidden />
        <button type="button" className="guardian-change-photo" onClick={() => uploadRef.current?.click()}>{photo ? "● Change Photo" : "● Upload Photo"}</button>
      </div>
    </section>;
  }

  return (
    <main className="guardian-page">
      <header className="guardian-header">
        <Link className="guardian-brand" to="/new-user-dashboard"><SchoolCrest /><div><strong>Sherwood</strong><small>College</small></div></Link>
        <AccountMenu />
      </header>

      <section className="guardian-shell">
        <div className="guardian-main">
          <div className="guardian-title"><div><p className="guardian-kicker">NEW APPLICATION</p><h1>Parent Information</h1><p>Please provide the parent contact details for the student.</p><small>{savingDraft ? "Saving your changes…" : "Changes save automatically."}</small></div><button onClick={() => navigate("/new-user-dashboard")}>← Back to dashboard</button></div>

          <ol className="guardian-steps" aria-label="Application progress">
            {steps.map((step, index) => <li className={index === 3 ? "current" : index < 3 ? "complete" : ""} key={step}><span>{index < 3 ? "✓" : index + 1}</span><b>{step}</b></li>)}
          </ol>

          {message && <div className="guardian-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}

          <form className="guardian-form" onSubmit={saveAndContinue}>
            {parentTypes.map(renderParentSection)}
            <div className="guardian-actions"><button type="button" className="guardian-back" onClick={() => navigate("/student-information")}>← Back</button><button className="guardian-next" type="submit">Save &amp; Next <span>→</span></button></div>
          </form>
        </div>

        <aside className="guardian-help">
          <section className="guardian-assistant"><div><span>✦</span><p><b>Sherwood Assistant</b><small><i /> Online</small></p></div><button onClick={() => navigate("/ai-assistant")}>Ask a question →</button></section>
          <section className="guardian-help-card"><h2>Quick Help</h2><button onClick={() => setMessage("You will need the student's birth certificate, passport photograph and previous school records.")}>What documents are required?</button><button onClick={() => setMessage("The Date of Birth field shows the eligible birth years for the selected class and academic session. For 2027–28, Class 8 accepts 2013 or 2014 births.")}>What is the age criteria?</button><button onClick={() => setMessage("Transport routes can be selected after student information is completed.")}>How do I enroll for transport?</button><button onClick={() => setMessage("Our admissions team can help with sibling applications.")}>Is a sibling facility available?</button><input placeholder="Type your question..." aria-label="Ask a question" /></section>
        </aside>
      </section>
    </main>
  );
}
