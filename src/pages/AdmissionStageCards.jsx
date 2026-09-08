import { getAdmissionDocumentLabel, getApplicationStatusLabel, getDocumentStatusLabel } from "../services/admission";
import "./AdmissionStageCards.css";

const requiredDocuments = ["report-card", "aadhaar-card", "birth-certificate", "passport", "national-id-card"];

function present(value, fallback = "Not filled") {
  if (value === 0) return "0";
  return String(value || "").trim() || fallback;
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function maskSensitive(value) {
  const raw = String(value || "").replace(/\s/g, "");
  if (!raw) return "Not filled";
  return raw.length <= 4 ? "••••" : `•••• •••• ${raw.slice(-4)}`;
}

function FieldGrid({ fields }) {
  return <dl className="admission-stage-field-grid">
    {fields.map(({ label, value, sensitive = false }) => <div key={label}>
      <dt>{label}</dt><dd>{sensitive ? maskSensitive(value) : present(value)}</dd>
    </div>)}
  </dl>;
}

function StageCard({ number, title, caption, children }) {
  return <article className="admission-stage-card">
    <header><span>{number}</span><div><p>STAGE {number} OF 7</p><h3>{title}</h3><small>{caption}</small></div></header>
    {children}
  </article>;
}

function guardiansFrom(formData) {
  return formData?.guardians && typeof formData.guardians === "object" ? formData.guardians : {};
}

export default function AdmissionStageCards({ application, documents = [] }) {
  if (!application) return null;

  const formData = application.form_data && typeof application.form_data === "object" ? application.form_data : {};
  const admission = formData.admissionDetails && typeof formData.admissionDetails === "object" ? formData.admissionDetails : formData;
  const student = formData.student && typeof formData.student === "object" ? formData.student : {};
  const guardians = guardiansFrom(formData);
  const documentsByKey = new Map(documents.map((document) => [document.document_key, document]));
  const otp = formData.otpVerification && typeof formData.otpVerification === "object" ? formData.otpVerification : {};
  const reuploadReason = application.reupload_reason || documents.find((document) => document.reason)?.reason || "";
  const parentContact = Object.values(guardians).find((guardian) => guardian?.mobile || guardian?.email) || {};

  return <section className="admission-stage-cards" id="filled-application-form" aria-labelledby="filled-form-heading">
    <header className="admission-stage-cards-heading"><div><p>FILLED APPLICATION FORM</p><h2 id="filled-form-heading">Stage-wise saved details</h2><small>These values come directly from your saved admission application.</small></div><span>Application {application.application_number}</span></header>
    <div className="admission-stage-cards-grid">
      <StageCard number="1" title="OTP Verified" caption="Sign-in verification">
        <FieldGrid fields={[
          { label: "Mobile / Email", value: otp.contact || parentContact.mobile || parentContact.email },
          { label: "OTP", value: otp.status === "verified" ? "Verified securely" : "Verification pending" },
          { label: "Verified on", value: otp.verifiedAt ? formatDate(otp.verifiedAt) : "Not available" },
        ]} />
      </StageCard>

      <StageCard number="2" title="Admission Details" caption="Academic and school information">
        <FieldGrid fields={[
          { label: "Academic Session", value: admission.session },
          { label: "Class Applying For", value: admission.class || application.desired_class },
          { label: "Stream", value: (admission.class || application.desired_class) === "Class 11" ? admission.stream : "Not applicable" },
          { label: "Application Date", value: admission.date ? formatDate(admission.date) : application.submitted_on ? formatDate(application.submitted_on) : "" },
          { label: "Application ID", value: application.application_number },
          { label: "PEN Number", value: admission.penNumber },
          { label: "Previous School", value: admission.previousSchool },
          { label: "Current Class", value: admission.currentClass },
          { label: "Board", value: admission.board === "Other" ? admission.boardOther || "Other" : admission.board },
          { label: "Other Board", value: admission.board === "Other" ? admission.boardOther : "Not applicable" },
          { label: "Medium", value: admission.medium },
        ]} />
      </StageCard>

      <StageCard number="3" title="Student Details" caption="Personal and learning information">
        <FieldGrid fields={[
          { label: "First Name", value: student.firstName },
          { label: "Middle Name", value: student.middleName },
          { label: "Last Name", value: student.lastName },
          { label: "Date of Birth", value: student.birthDate ? formatDate(student.birthDate) : "" },
          { label: "Place of Birth", value: student.placeOfBirth },
          { label: "Gender", value: student.gender },
          { label: "Blood Group", value: student.bloodGroup },
          { label: "Mother Tongue", value: student.motherTongue },
          { label: "Nationality", value: student.nationality === "Other" ? student.nationalityOther || "Other" : student.nationality },
          { label: "Country ID / Passport", value: student.nationalityCountryId, sensitive: true },
          { label: "Religion", value: student.religion === "Other" ? student.religionOther || "Other" : student.religion },
          { label: "Category", value: student.category },
          { label: "SLD", value: student.sld },
          { label: "ADHD", value: student.adhd },
          { label: "Single Parent", value: student.singleParent },
          { label: "Responsible Parent", value: student.responsibleParent },
          { label: "Aadhaar Number", value: student.aadhaar, sensitive: true },
          { label: "How did you hear about us", value: student.howHeard === "Others" ? student.howHeardOther || "Others" : student.howHeard },
          { label: "Student Photo", value: formData.studentPhoto?.file || "Not uploaded" },
        ]} />
      </StageCard>

      <StageCard number="4" title="Parent Details" caption="Father, mother, or responsible parent">
        {Object.keys(guardians).length ? <div className="admission-guardian-cards">{Object.entries(guardians).map(([type, guardian]) => <section key={type}><h4>{type}</h4><FieldGrid fields={[
          { label: "Full Name", value: guardian.fullName },
          { label: "Occupation", value: guardian.occupation },
          { label: "Mobile Number", value: guardian.mobile },
          { label: "Email Address", value: guardian.email },
          { label: "Aadhaar Number", value: guardian.aadhaar, sensitive: true },
          { label: "Photograph", value: formData.parentPhotos?.[type]?.file || "Not uploaded" },
        ]} /></section>)}</div> : <p className="admission-stage-not-filled">Parent details have not been saved yet.</p>}
      </StageCard>

      <StageCard number="5" title="Documents" caption="Files uploaded for verification">
        <div className="admission-stage-document-grid">{requiredDocuments.map((key) => {
          const document = documentsByKey.get(key);
          return <article key={key}><span>{document ? "▣" : "○"}</span><div><b>{getAdmissionDocumentLabel(key)}</b><small>{document?.file_name || "Not uploaded"}</small></div><em className={`is-${String(document?.status || "pending").replaceAll("_", "-")}`}>{document ? getDocumentStatusLabel(document.status) : "Pending upload"}</em></article>;
        })}</div>
      </StageCard>

      <StageCard number="6" title="Verification" caption="Admissions-team document review">
        <FieldGrid fields={[
          { label: "Document Status", value: getDocumentStatusLabel(application.documents_status) },
          { label: "Admin Remark / Re-upload Reason", value: reuploadReason || application.admin_remark },
          { label: "Verification Date", value: application.verification_date ? formatDate(application.verification_date) : "Not verified yet" },
          { label: "Verified By", value: application.verified_by },
        ]} />
      </StageCard>

      <StageCard number="7" title="Approval" caption="Final admission decision">
        <FieldGrid fields={[
          { label: "Application Status", value: getApplicationStatusLabel(application.status) },
          { label: "Admin Decision", value: application.status === "pending" ? "Awaiting decision" : getApplicationStatusLabel(application.status) },
          { label: "Class Allocation", value: application.class_section },
          { label: "Section Allocation", value: application.section_allocation },
          { label: "Approval Date", value: application.approval_date ? formatDate(application.approval_date) : "Not approved yet" },
          { label: "Admin Remark", value: application.admin_remark },
        ]} />
      </StageCard>
    </div>
  </section>;
}
