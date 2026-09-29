import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdmissionData,
  getCurrentAdmissionStatus,
  getStoredAdmissionId,
  saveAdmissionDraft,
  syncAdmissionDataFromDatabase,
} from "../services/admission";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import AccountMenu from "../components/AccountMenu";
import SchoolCrest from "../components/SchoolCrest";
import "./AdmissionDetails.css";

const steps = [
  ["✓", "OTP Verified", "complete"],
  ["2", "Admission Details", "current"],
  ["3", "Student Details", "pending"],
  ["4", "Parent Details", "pending"],
  ["5", "Documents", "pending"],
  ["6", "Verification", "pending"],
  ["7", "Approval", "pending"],
];

function getLocalDate() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function getNextAcademicSession() {
  const year = new Date().getFullYear() + 1;
  return `${year}–${String(year + 1).slice(-2)}`;
}

const nextAcademicSession = getNextAcademicSession();
// Offer only the classes confirmed by the admissions team. Current-class
// choices remain available for the grade a student is presently studying in.
const admissionClassOptions = ["Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 11"];
const currentClassOptions = ["Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
// Class 11 applicants may currently be studying any of Classes 2–10. Keep
// Class 11 in the ranking even though it is not a current-class choice.
const classOrder = [...currentClassOptions, "Class 11"];
const classRank = Object.fromEntries(classOrder.map((className, index) => [className, index + 2]));

const currentClassChoices = (selectedClass) => {
  // A Class 11 applicant can be studying in any of the listed current classes.
  // Handle it directly so the dropdown is never empty for Class 11.
  if (selectedClass === "Class 11") return currentClassOptions;
  return currentClassOptions.filter((className) => selectedClass === "Select class" || classRank[className] <= classRank[selectedClass]);
};

const initialForm = {
  session: nextAcademicSession,
  date: getLocalDate(),
  class: "Select class",
  stream: "Select stream",
  penNumber: "",
  previousSchool: "",
  currentClass: "Select current class",
  board: "Select board",
  boardOther: "",
  medium: "English",
};

export default function AdmissionDetails() {
  const navigate = useNavigate();
  const { session, user } = useCognitoAuth();
  const [form, setForm] = useState(() => {
    const savedForm = { ...initialForm, ...getAdmissionData().admissionDetails };
    const currentDate = getLocalDate();
    // Do not retain a saved selection for a class that is not currently open
    // for admission.
    return admissionClassOptions.includes(savedForm.class)
      ? { ...savedForm, date: currentDate }
      : { ...savedForm, date: currentDate, class: "Select class", stream: "Select stream" };
  });
  const [message, setMessage] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const applicationId = getStoredAdmissionId();
  const hydratedApplicationRef = useRef("");
  const hasEditedRef = useRef(false);
  const otpVerification = useRef(getAdmissionData().otpVerification || {
    contact: user?.email || "",
    status: "verified",
    verifiedAt: new Date().toISOString(),
  }).current;
  const syncSavedApplication = useCallback(async () => {
    if (!session?.accessToken) {
      return;
    }

    try {
      const nextStatus = await getCurrentAdmissionStatus(session.accessToken);
      const savedApplication = nextStatus?.application;
      const savedData = savedApplication?.form_data;
      if (savedApplication?.application_number && savedData && hydratedApplicationRef.current !== savedApplication.application_number) {
        syncAdmissionDataFromDatabase(savedData);
        const savedAdmissionDetails = savedData.admissionDetails && typeof savedData.admissionDetails === "object" ? savedData.admissionDetails : {};
        setForm((current) => ({ ...current, ...initialForm, ...savedAdmissionDetails, date: getLocalDate() }));
        hydratedApplicationRef.current = savedApplication.application_number;
      }
    } catch {
      // The form remains usable with locally saved values if the application
      // cannot be restored at this point.
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void syncSavedApplication();
  }, [syncSavedApplication]);

  useEffect(() => {
    if (!hasEditedRef.current || !session?.accessToken) return undefined;
    const saveTimer = window.setTimeout(() => {
      setSavingDraft(true);
      saveAdmissionDraft(session.accessToken, { otpVerification, admissionDetails: form, ...form })
        .then(() => void syncSavedApplication())
        .catch((error) => setMessage(error.message || "Admission details could not be saved."))
        .finally(() => setSavingDraft(false));
    }, 700);
    return () => window.clearTimeout(saveTimer);
  }, [form, otpVerification, session?.accessToken, syncSavedApplication]);

  function update(event) {
    const { name, value } = event.target;
    hasEditedRef.current = true;
    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "class") {
        if (value !== "Class 11") next.stream = "Select stream";
        if (classRank[current.currentClass] > classRank[value]) next.currentClass = "Select current class";
      }

      return next;
    });
  }

  async function saveDraft() {
    try {
      await saveAdmissionDraft(session?.accessToken, { otpVerification, admissionDetails: form, ...form });
      setMessage("Your admission details have been saved as a draft.");
      void syncSavedApplication();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function continueApplication() {
    if (form.class === "Select class") {
      setMessage("Please select the class you are applying for.");
      return;
    }
    if (form.class === "Class 11" && form.stream === "Select stream") {
      setMessage("Please select a stream for Class 11.");
      return;
    }
    if (form.currentClass === "Select current class") {
      setMessage("Please select the student's current class.");
      return;
    }
    if (classRank[form.currentClass] > classRank[form.class]) {
      setMessage("Current Class must be the same as or lower than Class Applying For.");
      return;
    }
    if (!form.penNumber.trim()) {
      setMessage("Please enter the student's PEN Number.");
      return;
    }
    saveAdmissionDraft(session?.accessToken, { otpVerification, admissionDetails: form, ...form })
      .then(() => {
        void syncSavedApplication();
        sessionStorage.setItem("sheerwood-applying-class", form.class);
        navigate("/student-information", { state: { applyingClass: form.class, stream: form.stream } });
      })
      .catch((error) => setMessage(error.message));
  }

  return (
    <main className="admission-page">
      <header className="admission-header">
        <Link className="admission-brand" to="/new-user-dashboard"><SchoolCrest /><div><strong>Sherwood</strong><small>College</small></div></Link>
        <AccountMenu />
      </header>

      <section className="admission-shell">
        <div className="admission-main">
          <div className="admission-title"><div><p className="admission-kicker">STEP 2 OF 7 · NEW APPLICATION</p><h1>Admission Details</h1><p>Tell us about the class and school background for this application.</p><small>{savingDraft ? "Saving your changes…" : "Changes save automatically."}</small></div></div>

          <ol className="application-steps" aria-label="Application progress">
            {steps.map(([number, label, status]) => (
              <li className={status} key={label}>
                <span>{number}</span><b>{label}</b>
              </li>
            ))}
          </ol>

          {message && <div className="form-message" role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}>×</button></div>}

          <form className="admission-form" onSubmit={(event) => { event.preventDefault(); continueApplication(); }}>
            <section className="admission-form-block" aria-labelledby="application-information-heading">
              <header className="admission-form-block-header"><div><p>APPLICATION INFORMATION</p><h2 id="application-information-heading">Admission application</h2></div><small>Fields marked <em>*</em> are required.</small></header>
              <div className="admission-fields">
                <label>Academic Session<input value={form.session} readOnly /></label>
                <label>Class Applying For <em>*</em><select name="class" value={form.class} onChange={update} required><option value="Select class" disabled>Select class</option>{admissionClassOptions.map((className) => <option key={className} value={className}>{className}</option>)}</select></label>
                {form.class === "Class 11" && <label>Stream <em>*</em><select name="stream" value={form.stream} onChange={update} required><option value="Select stream" disabled>Select stream</option><option value="PCMB">PCMB</option><option value="PCM">PCM</option><option value="PCB">PCB</option><option value="Commerce with Mathematics">Commerce with Mathematics</option><option value="Commerce without Mathematics">Commerce without Mathematics</option><option value="Humanities">Humanities</option></select></label>}
                <label>Application Date<input name="date" type="date" value={form.date} readOnly /></label>
                <label>Application ID<input value={applicationId || "Assigned after first save"} readOnly /></label>
                <label>PEN Number <em>*</em><small>(Personal Education Number)</small><input name="penNumber" value={form.penNumber} onChange={update} placeholder="Enter PEN number" required /></label>
              </div>
            </section>

            <section className="admission-form-block" aria-labelledby="academic-background-heading">
              <header className="admission-form-block-header"><div><p>ACADEMIC BACKGROUND</p><h2 id="academic-background-heading">Previous school details</h2></div></header>
              <div className="admission-fields">
                <label>Previous School<input name="previousSchool" value={form.previousSchool} onChange={update} placeholder="Enter previous school name" /></label>
                <label>Current Class <em>*</em><select name="currentClass" value={form.currentClass} onChange={update} required><option value="Select current class" disabled>Select current class</option>{currentClassChoices(form.class).map((className) => <option key={className} value={className}>{className}</option>)}</select></label>
                <label>Board<select name="board" value={form.board} onChange={update}><option value="Select board" disabled>Select board</option><option value="CBSE">CBSE</option><option value="ICSE">ICSE</option><option value="State Board">State Board</option><option value="IB">IB</option><option value="Other">Other</option></select></label>
                {form.board === "Other" && <label>Specify Board <em>*</em><input name="boardOther" value={form.boardOther} onChange={update} placeholder="Enter board name" required /></label>}
                <label>Medium<select name="medium" value={form.medium} onChange={update}><option value="English">English</option><option value="Hindi">Hindi</option><option value="Other">Other</option></select></label>
              </div>
            </section>
            <div className="form-actions"><button type="button" className="save-draft" onClick={saveDraft}>Save Draft</button><button className="next-step" type="submit">Next <span>→</span></button></div>
          </form>
        </div>

        <aside className="admission-help">
          <section className="help-assistant"><div><span>✦</span><p><b>Sherwood Assistant</b><small><i /> Online</small></p></div><button onClick={() => navigate("/ai-assistant")}>Ask a question →</button></section>
          <section className="help-card"><h2>Quick Help</h2><button onClick={() => setMessage("Please keep the student's Aadhaar Card, Birth Certificate issued by the Nagar Nigam/Municipal Department, and most recent mark sheet ready. The original Transfer Certificate is submitted after admission is confirmed.")}>What documents are required?</button><button onClick={() => setMessage("For the 2027–28 session, Class 3 applicants should be born in 2018 or 2019. The Date of Birth field shows the correct range for every class.")}>What is the age criteria for Class 3?</button><button onClick={() => setMessage("The entrance test is online, with English and Mathematics papers. Each paper is one hour.")}>How is the entrance test conducted?</button><button onClick={() => setMessage("Admissions close as and when seats are filled. Please contact the admissions team to confirm current availability.")}>When do admissions close?</button></section>
        </aside>
      </section>
    </main>
  );
}
