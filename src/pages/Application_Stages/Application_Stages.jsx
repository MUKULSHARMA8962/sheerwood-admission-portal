import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdmissionDocumentRecords,
  getAdmissionDocuments,
  saveAdmissionDraft,
  syncAdmissionDocumentsFromDatabase,
  updateAdmissionDocument,
  uploadAdmissionDocument,
} from "../../services/admission";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import { ROUTES } from "../../constants/routes";
import AccountMenu from "../../components/AccountMenu";
import SchoolCrest from "../../components/SchoolCrest";
import "./Application_Stages.css";
import "../DocumentUploadStatus.css";

const steps = ["OTP Verified", "Admission Details", "Student Details", "Parent Details", "Documents", "Verification", "Approval"];

export default function ApplicationStages() {
  const navigate = useNavigate();
  const { session } = useCognitoAuth();
  const fileInput = useRef(null);
  const selectedDocumentId = useRef("");
  const [documents, setDocuments] = useState(getAdmissionDocuments);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  const loadSavedDocuments = useCallback(async () => {
    if (!session?.accessToken) {
      setIsLoadingDocuments(false);
      return;
    }
    setIsLoadingDocuments(true);
    try {
      const records = await getAdmissionDocumentRecords(session.accessToken);
      setDocuments(syncAdmissionDocumentsFromDatabase(records));
    } catch (reason) {
      setMessage(reason.message || "Saved documents could not be loaded.");
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadSavedDocuments(); }, [loadSavedDocuments]);

  function chooseDocument(documentId) {
    selectedDocumentId.current = documentId;
    fileInput.current?.click();
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    const documentId = selectedDocumentId.current;
    if (!file || !documentId) return;
    setMessage(`Uploading ${file.name}…`);
    try {
      await saveAdmissionDraft(session?.accessToken, {});
      const stored = await uploadAdmissionDocument(session?.accessToken, documentId, file);
      const nextDocuments = updateAdmissionDocument(documentId, "Uploaded", "", stored.file_name, {
        storageId: stored.id,
        sizeBytes: stored.size_bytes,
        contentType: stored.content_type,
      });
      setDocuments(nextDocuments);
      await saveAdmissionDraft(session?.accessToken, { uploadedDocuments: nextDocuments });
      await loadSavedDocuments();
      setMessage(`${stored.file_name} uploaded. It is ready for verification.`);
    } catch (reason) {
      setMessage(reason.message || "Document could not be uploaded.");
    } finally {
      event.target.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      await saveAdmissionDraft(session?.accessToken, { uploadedDocuments: documents }, "submitted");
      navigate(ROUTES.feePayment);
    } catch (reason) {
      setMessage(reason.message || "Application could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="stage-page">
    <header className="stage-header"><Link className="stage-brand" to={ROUTES.newUserDashboard}><SchoolCrest /><div><strong>Sherwood</strong><small>College</small></div></Link><AccountMenu /></header>
    <section className="stage-shell"><div className="stage-main"><div className="stage-title"><div><p>STEP 5 OF 7 · NEW APPLICATION</p><h1>Document Upload</h1><small>Upload documents now. The admissions team verifies each document before a final decision.</small></div><button onClick={() => navigate(ROUTES.newUserDashboard)}>← Dashboard</button></div>
      <ol className="stage-progress" aria-label="Application progress">{steps.map((step, index) => <li className={index === 4 ? "current" : index < 4 ? "complete" : ""} key={step}><span>{index < 4 ? "✓" : index + 1}</span><b>{step}</b></li>)}</ol>
      {message && <div className="stage-message" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}
      <form className="stage-form documents" onSubmit={submit}><p className="document-intro">{isLoadingDocuments ? "Loading your saved documents…" : "Upload a document or replace it here. These statuses are read directly from your saved application."}</p><div className="document-list">{documents.map((document) => <button className={document.status.toLowerCase().replaceAll(" ", "-")} type="button" key={document.id} onClick={() => chooseDocument(document.id)}><span>▣</span><b>{document.name}</b><em>{document.file || "Not uploaded"}</em><i>{document.status === "Verified" ? "✓" : document.file ? "◷" : "⇧"}</i><small>{document.status}</small></button>)}</div><input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={upload} /><div className="stage-actions"><button type="button" className="stage-back" onClick={() => navigate(ROUTES.parentGuardian)}>← Back</button><button className="stage-next" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit application & continue to fee"} <span>→</span></button></div></form>
    </div></section>
  </main>;
}
