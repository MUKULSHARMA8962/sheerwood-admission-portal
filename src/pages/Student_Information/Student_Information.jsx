import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Student_Information.css";
import AccountMenu from "../../components/AccountMenu";
import SchoolCrest from "../../components/SchoolCrest";
import "./StudentBirthDate.css";
import { getAdmissionData, saveAdmissionDraft, uploadAdmissionDocument } from "../../services/admission";
import { useCognitoAuth } from "../../auth/useCognitoAuth";

const steps = ["OTP Verified", "Admission Details", "Student Details", "Parent Details", "Documents", "Verification", "Approval"];

function getLocalDate() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function getAcademicYearStart() {
  return new Date(new Date().getFullYear() + 1, 3, 1);
}

const ageEligibilityByClass = {
  "Class 3": { minimumMonths: 84, label: "7 years" },
  "Class 4": { minimumMonths: 102, label: "8½ years" },
  "Class 5": { minimumMonths: 114, label: "9½ years" },
  "Class 6": { minimumMonths: 126, label: "10½ years" },
  "Class 7": { minimumMonths: 138, label: "11½ years" },
  "Class 9": { minimumMonths: 150, label: "12½ years" },
  "Class 11": { minimumMonths: 174, label: "14½ years" },
};

function getBirthDateGuideline(applyingClass) {
  const eligibility = ageEligibilityByClass[applyingClass];
  if (!eligibility) return null;

  return {
    // Admissions allows one or two months of flexibility below the stated
    // minimum age, so validate against the more generous two-month margin.
    minMonths: eligibility.minimumMonths - 2,
    ageRange: `${eligibility.label} or above (up to 2 months below is also considered)`,
  };
}

function ageInMonthsOnDate(birthDate, comparisonDate) {
  const [year, month, day] = birthDate.split("-").map(Number);
  let months = (comparisonDate.getFullYear() - year) * 12 + (comparisonDate.getMonth() + 1 - month);
  if (comparisonDate.getDate() < day) months -= 1;
  return months;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

const initialForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  birthDate: "",
  placeOfBirth: "",
  gender: "",
  bloodGroup: "",
  motherTongue: "",
  nationality: "",
  nationalityOther: "",
  nationalityCountryId: "",
  religion: "",
  religionOther: "",
  category: "",
  sld: "",
  adhd: "",
  singleParent: "",
  responsibleParent: "",
  howHeard: "",
  howHeardOther: "",
  aadhaar: "",
};

export default function StudentInformation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useCognitoAuth();
  const uploadRef = useRef(null);
  const [form, setForm] = useState(() => ({ ...initialForm, ...getAdmissionData().student }));
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState("");
  const [birthDateError, setBirthDateError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const hasEditedRef = useRef(false);
  const applyingClass = location.state?.applyingClass || sessionStorage.getItem("sheerwood-applying-class") || "";
  const birthDateGuideline = getBirthDateGuideline(applyingClass);
  const academicYearStart = getAcademicYearStart();

  function validateBirthDate(value) {
    if (!value) return "Please enter the student's Date of Birth.";
    if (value > getLocalDate()) return "Date of Birth cannot be in the future.";
    if (!birthDateGuideline) return "Please select Class Applying For first, then return to validate the Date of Birth.";

    const ageInMonths = ageInMonthsOnDate(value, academicYearStart);
    if (ageInMonths < birthDateGuideline.minMonths) {
      return `The student does not meet the minimum age guideline for ${applyingClass}.`;
    }
    return "";
  }

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  useEffect(() => {
    if (!hasEditedRef.current || !session?.accessToken) return undefined;
    const saveTimer = window.setTimeout(() => {
      setSavingDraft(true);
      saveAdmissionDraft(session.accessToken, { student: form })
        .catch((error) => setMessage(error.message || "Student details could not be saved."))
        .finally(() => setSavingDraft(false));
    }, 700);
    return () => window.clearTimeout(saveTimer);
  }, [form, session?.accessToken]);

  function update(event) {
    const { name, value } = event.target;
    hasEditedRef.current = true;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "birthDate") setBirthDateError(validateBirthDate(value));
  }

  async function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Please choose a JPG or PNG image that is no larger than 5 MB.");
      event.target.value = "";
      return;
    }
    try {
      setMessage("Uploading student photograph…");
      await saveAdmissionDraft(session?.accessToken, { student: form });
      const uploaded = await uploadAdmissionDocument(session?.accessToken, "student-photo", file);
      await saveAdmissionDraft(session?.accessToken, {
        studentPhoto: { storageId: uploaded.id, file: uploaded.file_name, contentType: uploaded.content_type, sizeBytes: uploaded.size_bytes },
      });
      setPhoto(URL.createObjectURL(file));
      setMessage("Student photograph uploaded and saved securely.");
    } catch (error) {
      setMessage(error.message);
    }
    event.target.value = "";
  }

  function saveAndContinue(event) {
    event.preventDefault();
    const dateValidationMessage = validateBirthDate(form.birthDate);
    setBirthDateError(dateValidationMessage);
    if (dateValidationMessage) {
      setMessage("Please correct the Date of Birth as per the age guideline.");
      return;
    }
    const requiredFields = [
      ["firstName", "First Name"],
      ["lastName", "Last Name"],
      ["placeOfBirth", "Place of Birth"],
      ["gender", "Gender"],
      ["bloodGroup", "Blood Group"],
      ["motherTongue", "Mother Tongue"],
      ["nationality", "Nationality"],
      ["category", "Category"],
      ["sld", "Specific Learning Disability (SLD)"],
      ["adhd", "Attention Deficit Hyperactive Disorder (ADHD)"],
      ["singleParent", "Single Parent"],
      ["howHeard", "How did you come to know about our School?"],
    ];
    const missingField = requiredFields.find(([field]) => !form[field].trim());
    if (missingField) {
      setMessage(`Please complete ${missingField[1]}.`);
      return;
    }
    if (form.nationality === "Other" && !form.nationalityOther.trim()) {
      setMessage("Please specify the student's nationality.");
      return;
    }
    if (form.nationality === "Other" && !form.nationalityCountryId.trim()) {
      setMessage("Please enter the student's Country ID or Passport Number.");
      return;
    }
    if (form.religion === "Other" && !form.religionOther.trim()) {
      setMessage("Please specify the student's religion.");
      return;
    }
    if (form.singleParent === "Yes" && !form.responsibleParent) {
      setMessage("Please select the responsible parent.");
      return;
    }
    if (form.howHeard === "Others" && !form.howHeardOther.trim()) {
      setMessage("Please specify how you heard about the school.");
      return;
    }
    if (form.aadhaar.replace(/\D/g, "").length !== 12) {
      setMessage("Please enter a valid 12-digit Aadhaar Number.");
      return;
    }
    saveAdmissionDraft(session?.accessToken, { student: form })
      .then(() => navigate("/parent-guardian", { state: { singleParent: form.singleParent, responsibleParent: form.responsibleParent } }))
      .catch((error) => setMessage(error.message));
  }

  return (
    <main className="student-page">
      <header className="student-header">
        <Link className="student-brand" to="/new-user-dashboard"><SchoolCrest /><div><strong>Sherwood</strong><small>College</small></div></Link>
        <AccountMenu />
      </header>

      <section className="student-shell">
        <div className="student-main">
          <div className="student-title"><div><p className="student-kicker">NEW APPLICATION</p><h1>Student Information</h1><p>Tell us about the student applying for admission.</p><small>{savingDraft ? "Saving your changes…" : "Changes save automatically."}</small></div><button onClick={() => navigate("/new-user-dashboard")}>← Back to dashboard</button></div>

          <ol className="student-steps" aria-label="Application progress">
            {steps.map((step, index) => <li className={index === 2 ? "current" : index < 2 ? "complete" : ""} key={step}><span>{index < 2 ? "✓" : index + 1}</span><b>{step}</b></li>)}
          </ol>

          {message && <div className="student-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}

          <form className="student-form" onSubmit={saveAndContinue} noValidate>
            <h2>Personal Details</h2>
            <div className="student-fields">
              <label>First Name <em>*</em><input name="firstName" value={form.firstName} onChange={update} required /></label>
              <label>Middle Name<input name="middleName" value={form.middleName} onChange={update} /></label>
              <label>Last Name <em>*</em><input name="lastName" value={form.lastName} onChange={update} required /></label>
              <label className={`birth-date-field${birthDateError ? " has-error" : ""}`}>Date of Birth <em>*</em><input name="birthDate" type="date" value={form.birthDate} onChange={update} onBlur={(event) => setBirthDateError(validateBirthDate(event.target.value))} max={getLocalDate()} required /><small className="birth-date-guideline">{birthDateGuideline ? `For ${applyingClass}: ${birthDateGuideline.ageRange} as on ${formatDate(academicYearStart)}.` : "Select Class Applying For to view the age guideline."}</small>{birthDateError && <small className="birth-date-error" role="alert">{birthDateError}</small>}</label>
              <label>Place of Birth <em>*</em><input name="placeOfBirth" value={form.placeOfBirth} onChange={update} placeholder="Enter place of birth" required /></label>
              <label>Gender <em>*</em><select name="gender" value={form.gender} onChange={update} required><option value="" disabled>Select gender</option><option>Female</option><option>Male</option></select></label>
              <label>Blood Group <em>*</em><select name="bloodGroup" value={form.bloodGroup} onChange={update} required><option value="" disabled>Select blood group</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></label>
              <label>Mother Tongue <em>*</em><input name="motherTongue" value={form.motherTongue} onChange={update} placeholder="Enter mother tongue" required /></label>
              <label>Nationality <em>*</em><select name="nationality" value={form.nationality} onChange={update} required><option value="" disabled>Select nationality</option><option>Indian</option><option>Other</option></select></label>
              {form.nationality === "Other" && <><label>Specify Nationality <em>*</em><input name="nationalityOther" value={form.nationalityOther} onChange={update} placeholder="Enter nationality" required /></label><label>Country ID / Passport Number <em>*</em><input name="nationalityCountryId" value={form.nationalityCountryId} onChange={update} placeholder="Enter country ID or passport number" required /></label></>}
              <label>Religion<select name="religion" value={form.religion} onChange={update}><option value="">Select religion</option><option>Hindu</option><option>Muslim</option><option>Christian</option><option>Sikh</option><option>Other</option></select></label>
              {form.religion === "Other" && <label>Specify Religion <em>*</em><input name="religionOther" value={form.religionOther} onChange={update} placeholder="Enter religion" required /></label>}
              <label>Category <em>*</em><select name="category" value={form.category} onChange={update} required><option value="" disabled>Select category</option><option>General</option><option>SC</option><option>ST</option><option>OBC</option><option>Others</option></select></label>
              <label>Specific Learning Disability (SLD) <em>*</em><select name="sld" value={form.sld} onChange={update} required><option value="" disabled>Select option</option><option>No</option><option>Yes</option></select></label>
              <label>Attention Deficit Hyperactive Disorder (ADHD) <em>*</em><select name="adhd" value={form.adhd} onChange={update} required><option value="" disabled>Select option</option><option>No</option><option>Yes</option></select></label>
              <label>Single Parent <em>*</em><select name="singleParent" value={form.singleParent} onChange={update} required><option value="" disabled>Select option</option><option>No</option><option>Yes</option></select></label>
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
          <section className="student-assistant"><div><span>✦</span><p><b>Sherwood Assistant</b><small><i /> Online</small></p></div><button onClick={() => navigate("/ai-assistant")}>Ask a question →</button></section>
          <section className="student-help-card"><h2>Quick Help</h2><button onClick={() => setMessage("Please keep the student's Aadhaar Card, Birth Certificate issued by the Nagar Nigam/Municipal Department, and most recent mark sheet ready. The original Transfer Certificate is submitted after admission is confirmed.")}>What documents are required?</button><button onClick={() => setMessage("For Class 3, the child should be 7 years or above as of the academic year start date. One to two months below the stated age is also considered.")}>What is the age criteria for Class 3?</button><button onClick={() => setMessage("The entrance test is online, with English and Mathematics papers. Each paper is one hour.")}>How is the entrance test conducted?</button><button onClick={() => setMessage("Admissions close as and when seats are filled. Please contact the admissions team to confirm current availability.")}>When do admissions close?</button><input placeholder="Type your question..." aria-label="Ask a question" /></section>
        </aside>
      </section>
    </main>
  );
}
