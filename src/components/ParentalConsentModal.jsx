import { useEffect, useState } from "react";
import "./ParentalConsentModal.css";

const consentAcknowledgements = [
  "I confirm that I am the parent or legal guardian of the child named below.",
  "I have read and understood this notice, including the purposes for which the data will be used.",
  "I consent to the collection and processing of my child's personal data for the stated purposes only.",
  "I understand that I may withdraw consent and that doing so may affect access to the school portal services.",
];

function initialConsentDetails(applicationData = {}) {
  const guardians = applicationData.guardians && typeof applicationData.guardians === "object" ? applicationData.guardians : {};
  const [relationship = "Parent / legal guardian", guardian = {}] = Object.entries(guardians).find(([, details]) => details?.fullName || details?.mobile || details?.email) || [];
  const student = applicationData.student && typeof applicationData.student === "object" ? applicationData.student : {};
  const childName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");

  return {
    parentName: guardian.fullName || "",
    relationship: relationship ? `${relationship.charAt(0).toUpperCase()}${relationship.slice(1)}` : "Parent / legal guardian",
    parentMobile: guardian.mobile || "",
    parentEmail: guardian.email || "",
    childName,
    childDob: student.birthDate || "",
  };
}

export default function ParentalConsentModal({ applicationData, isConfirming, onClose, onConfirm }) {
  const schoolWebsite = window.location.origin;
  const [details, setDetails] = useState(() => initialConsentDetails(applicationData));
  const [acknowledgements, setAcknowledgements] = useState(() => consentAcknowledgements.map(() => false));
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isConfirming) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isConfirming, onClose]);

  const isComplete = acknowledgements.every(Boolean)
    && details.parentName.trim()
    && details.relationship.trim()
    && details.parentMobile.trim()
    && details.parentEmail.trim()
    && details.childName.trim()
    && details.childDob;

  function updateDetail(event) {
    const { name, value } = event.target;
    setDetails((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function toggleAcknowledgement(index) {
    setAcknowledgements((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!isComplete) {
      setError("Complete the parent, child and acknowledgement fields to confirm consent.");
      return;
    }
    setError("");
    try {
      await onConfirm({
        parent_name: details.parentName,
        relationship_to_child: details.relationship,
        parent_mobile: details.parentMobile,
        parent_email: details.parentEmail,
        child_name: details.childName,
        child_dob: details.childDob,
      });
    } catch (reason) {
      setError(reason.message || "Consent could not be confirmed. Please check the OTP and try again.");
    }
  }

  return <div className="consent-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isConfirming) onClose(); }}>
    <section className="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <header className="consent-modal-header">
        <div><p>PARENTAL / GUARDIAN CONSENT</p><h1 id="consent-title">Consent for collection and processing of your child's personal data</h1></div>
        <button type="button" onClick={onClose} disabled={isConfirming} aria-label="Close consent notice">×</button>
      </header>

      <form onSubmit={submit} noValidate>
        <div className="consent-modal-body">
          <section className="consent-notice">
            <p>Dear Parent/Guardian,</p>
            <p>Under the Digital Personal Data Protection Act, 2023, we are required to obtain your verifiable consent before collecting or processing personal data belonging to your child, who is under 18 years of age. Please read the following carefully before providing consent.</p>

            <h2>1. Who is collecting this data</h2>
            <p>Sheerwood International School, having its website at {schoolWebsite}, is the Data Fiduciary responsible for your child's personal data collected through this platform.</p>

            <h2>2. What data we collect</h2>
            <p>We collect the following categories of personal data about your child:</p>
            <ul><li>Full name, date of birth and class/grade</li><li>Parent/guardian contact details, including name, email and mobile number</li><li>Academic records, including attendance, grades, assignments and progress reports</li><li>Health or medical information such as allergies or specific medical conditions, where provided</li><li>Photographs or videos for school activities or communication, where provided</li><li>Login credentials and usage data on the school Learning Management System (LMS)</li></ul>

            <h2>3. Purpose of collection</h2>
            <p>This data is collected and used solely for:</p>
            <ul><li>Providing access to the school's Learning Management System</li><li>Tracking academic progress and attendance</li><li>Communicating with you regarding your child's education</li></ul>
            <p><strong>We do not use your child's data for targeted advertising, behavioural profiling, or any purpose beyond what is listed above.</strong></p>

            <h2>4. How long we retain this data</h2>
            <p>We retain your child's personal data for the duration of enrolment plus 7 years. It is then securely deleted or anonymised unless a longer retention period is required by law.</p>

            <h2>5. Your rights</h2>
            <p>As the parent or guardian providing consent, you have the right to:</p>
            <ul><li>Access the personal data we hold about your child</li><li>Request correction of inaccurate data</li><li>Withdraw your consent at any time</li><li>Request deletion of your child's data, subject to legal retention requirements such as academic record-keeping rules</li></ul>
            <p>To exercise these rights, contact the admissions office at <a href="mailto:admissions@sherwood.edu.in">admissions@sherwood.edu.in</a>.</p>

            <h2>6. Consequences of withdrawing consent</h2>
            <p>If you withdraw consent, your child may lose access to the school portal and related LMS services because their continued provision depends on this data being processed.</p>

            <h2>7. Grievance redressal</h2>
            <p>If you have concerns about how your child's data is handled, contact the Grievance Officer through the admissions office at <a href="mailto:admissions@sherwood.edu.in">admissions@sherwood.edu.in</a>, Sherwood College, Nainital.</p>
          </section>

          <section className="consent-capture" aria-labelledby="consent-capture-title">
            <header><p>DIGITAL CONSENT</p><h2 id="consent-capture-title">Confirm your consent</h2><small>Your Cognito-authenticated account and the confirmation below are recorded with this consent.</small></header>
            <div className="consent-checks">
              {consentAcknowledgements.map((label, index) => <label key={label}><input type="checkbox" checked={acknowledgements[index]} onChange={() => toggleAcknowledgement(index)} /><span>{label}</span></label>)}
            </div>
            <div className="consent-fields">
              <label>Parent/Guardian full name <em>*</em><input name="parentName" value={details.parentName} onChange={updateDetail} autoComplete="name" /></label>
              <label>Relationship to child <em>*</em><input name="relationship" value={details.relationship} onChange={updateDetail} placeholder="e.g. Mother, Father or Legal guardian" /></label>
              <label>Parent/Guardian mobile number <em>*</em><input name="parentMobile" value={details.parentMobile} onChange={updateDetail} inputMode="tel" autoComplete="tel" placeholder="98765 43210" /></label>
              <label>Parent/Guardian email <em>*</em><input name="parentEmail" type="email" value={details.parentEmail} onChange={updateDetail} autoComplete="email" /></label>
              <label>Child's full name <em>*</em><input name="childName" value={details.childName} onChange={updateDetail} /></label>
              <label>Child's date of birth <em>*</em><input name="childDob" type="date" value={details.childDob} onChange={updateDetail} /></label>
            </div>
            {error && <p className="consent-status error" role="alert">{error}</p>}
          </section>
        </div>
        <footer className="consent-modal-footer"><button type="button" className="consent-cancel" onClick={onClose} disabled={isConfirming}>Cancel</button><button type="submit" className="consent-confirm" disabled={!isComplete || isConfirming}>{isConfirming ? "Confirming consent…" : "Confirm consent & proceed to pay →"}</button></footer>
      </form>
    </section>
  </div>;
}
