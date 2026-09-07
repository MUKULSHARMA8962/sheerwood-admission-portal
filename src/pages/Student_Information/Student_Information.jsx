import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Student_Information.css";
import AccountMenu from "../../components/AccountMenu";
import "./StudentBirthDate.css";

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

function getAcademicYearStart() {
  return new Date(new Date().getFullYear() + 1, 3, 1);
}

function getBirthDateGuideline(applyingClass) {
  const classNumber = Number(applyingClass?.replace("Class ", ""));
  if (!Number.isInteger(classNumber) || classNumber < 3 || classNumber > 11) return null;

  return {
    minMonths: classNumber * 12 + 54,
    maxMonths: classNumber * 12 + 60,
    ageRange: `${classNumber + 4.5}–${classNumber + 5} years`,
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
  nationalityCountryId: "",
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
  const location = useLocation();
  const uploadRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState("");
  const [message, setMessage] = useState("");
  const [birthDateError, setBirthDateError] = useState("");
  const applyingClass = location.state?.applyingClass || sessionStorage.getItem("sheerwood-applying-class") || "";
  const birthDateGuideline = getBirthDateGuideline(applyingClass);
  const academicYearStart = getAcademicYearStart();

  function validateBirthDate(value) {
    if (!value) return "Please enter the student's Date of Birth.";
    if (value > getLocalDate()) return "Date of Birth cannot be in the future.";
    if (!birthDateGuideline) return "Please select Class Applying For first, then return to validate the Date of Birth.";

    const ageInMonths = ageInMonthsOnDate(value, academicYearStart);
    if (ageInMonths < birthDateGuideline.minMonths || ageInMonths > birthDateGuideline.maxMonths) {
      return `This Date of Birth is not acceptable for ${applyingClass}.`;
    }
    return "";
  }

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "birthDate") setBirthDateError(validateBirthDate(value));
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
      ["motherTongue", "Mother Tongue"],
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
    navigate("/parent-guardian", { state: { singleParent: form.singleParent, responsibleParent: form.responsibleParent } });
  }

  return (
    <main className="student-page">
      <header className="student-header">
        <Link className="student-brand" to="/dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <AccountMenu />
      </header>

      <section className="student-shell">
        <div className="student-main">
          <div className="student-title"><div><p className="student-kicker">NEW APPLICATION</p><h1>Student Information</h1><p>Tell us about the student applying for admission.</p></div><button onClick={() => navigate("/dashboard")}>← Back to dashboard</button></div>

          <ol className="student-steps" aria-label="Application progress">
            {steps.map((step, index) => <li className={index === 1 ? "current" : index < 1 ? "complete" : ""} key={step}><span>{index < 1 ? "✓" : index + 1}</span><b>{step}</b></li>)}
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
              <label>Gender <em>*</em><select name="gender" value={form.gender} onChange={update}><option>Female</option><option>Male</option></select></label>
              <label>Blood Group <em>*</em><select name="bloodGroup" value={form.bloodGroup} onChange={update} required><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></label>
              <label>Mother Tongue <em>*</em><input name="motherTongue" value={form.motherTongue} onChange={update} placeholder="Enter mother tongue" required /></label>
              <label>Nationality <em>*</em><select name="nationality" value={form.nationality} onChange={update}><option>Indian</option><option>Other</option></select></label>
              {form.nationality === "Other" && <><label>Specify Nationality <em>*</em><input name="nationalityOther" value={form.nationalityOther} onChange={update} placeholder="Enter nationality" required /></label><label>Country ID / Passport Number <em>*</em><input name="nationalityCountryId" value={form.nationalityCountryId} onChange={update} placeholder="Enter country ID or passport number" required /></label></>}
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
          <section className="student-help-card"><h2>Quick Help</h2><button onClick={() => setMessage("Please keep the student's Aadhaar Card, Birth Certificate issued by the Nagar Nigam/Municipal Department, and most recent mark sheet ready. The original Transfer Certificate is submitted after admission is confirmed.")}>What documents are required?</button><button onClick={() => setMessage("For Class 3, the child should be between 7.5 and 8 years old as of the academic year start date.")}>What is the age criteria for Class 3?</button><button onClick={() => setMessage("The entrance test is online, with English and Mathematics papers. Each paper is one hour.")}>How is the entrance test conducted?</button><button onClick={() => setMessage("Admissions close as and when seats are filled. Please contact the admissions team to confirm current availability.")}>When do admissions close?</button><input placeholder="Type your question..." aria-label="Ask a question" /></section>
        </aside>
      </section>
    </main>
  );
}
