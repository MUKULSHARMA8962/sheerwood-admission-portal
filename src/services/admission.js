const APPLICATION_ID_KEY = "sheerwood-new-admission-id";
const DOCUMENTS_KEY = "sheerwood-new-admission-documents";
const APPLICATION_DATA_KEY = "sheerwood-admission-data";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

const admissionDocumentLabels = {
  "report-card": "Report Card",
  "aadhaar-card": "Aadhaar Card",
  "birth-certificate": "Birth Certificate",
  passport: "Passport",
  "national-id-card": "National ID Card",
  "student-photo": "Student Photograph",
  "father-photo": "Father's Photograph",
  "mother-photo": "Mother's Photograph",
};

const documentStatusLabels = {
  submitted: "Waiting for verification",
  approved: "Verified",
  reupload_required: "Re-upload required",
};

const applicationStatusLabels = {
  draft: "Draft — not submitted",
  new_application: "Application started",
  submitted: "Submitted — awaiting review",
  document_verification: "Documents under verification",
  pending_approval: "Pending admission approval",
  needs_information: "Information required",
  approved: "Admission approved",
  rejected: "Admission not approved",
};

function readableStatus(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getAdmissionDocumentLabel(documentKey) {
  return admissionDocumentLabels[documentKey] || readableStatus(documentKey);
}

export function getDocumentStatusLabel(status) {
  return documentStatusLabels[status] || readableStatus(status) || "Awaiting upload";
}

export function getApplicationStatusLabel(status) {
  return applicationStatusLabels[status] || readableStatus(status) || "Application not started";
}

export function getNewAdmissionId() {
  const existingId = localStorage.getItem(APPLICATION_ID_KEY);
  if (existingId) return existingId;

  const applicationId = `SHW-ADM-2027-${Math.floor(100000 + Math.random() * 900000)}`;
  localStorage.setItem(APPLICATION_ID_KEY, applicationId);
  return applicationId;
}

export function setNewAdmissionId(applicationNumber) {
  const normalizedApplicationNumber = String(applicationNumber || "").trim();
  if (!normalizedApplicationNumber) return "";
  localStorage.setItem(APPLICATION_ID_KEY, normalizedApplicationNumber);
  return normalizedApplicationNumber;
}

const defaultDocuments = [
  { id: "report-card", name: "Report Card", status: "Not Uploaded", file: "" },
  { id: "aadhaar-card", name: "Aadhaar Card", status: "Not Uploaded", file: "" },
  { id: "birth-certificate", name: "Birth Certificate", status: "Not Uploaded", file: "" },
  { id: "passport", name: "Passport", status: "Not Uploaded", file: "" },
  { id: "national-id-card", name: "National ID Card", status: "Not Uploaded", file: "" },
];

export function getAdmissionDocuments() {
  const savedDocuments = localStorage.getItem(DOCUMENTS_KEY);
  if (savedDocuments) {
    const documents = JSON.parse(savedDocuments).filter((document) => document.id !== "other").map((document) => {
      if (document.status === "Verified" || document.status === "Under Verification" || document.status === "Pending") {
        return { ...document, status: document.file ? "Submitted" : "Not Uploaded" };
      }
      if (document.status === "Approved" && !document.file) return { ...document, status: "Not Uploaded" };
      return { ...document, file: document.file || "" };
    });
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
    return documents;
  }
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(defaultDocuments));
  return defaultDocuments;
}

export function updateAdmissionDocument(documentId, status, reason = "", file, storage = {}) {
  const updatedDocuments = getAdmissionDocuments().map((document) => document.id === documentId ? { ...document, status, reason, ...(file ? { file } : {}), ...storage } : document);
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updatedDocuments));
  return updatedDocuments;
}

export function getAdmissionData() {
  try {
    return JSON.parse(sessionStorage.getItem(APPLICATION_DATA_KEY) || "{}");
  } catch {
    return {};
  }
}

export async function saveAdmissionDraft(accessToken, data, status = "draft") {
  const mergedData = { ...getAdmissionData(), ...data };
  sessionStorage.setItem(APPLICATION_DATA_KEY, JSON.stringify(mergedData));
  const response = await fetch(`${API_BASE_URL}/applications/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ application_number: getNewAdmissionId(), data: mergedData, documents: getAdmissionDocuments(), status }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || "Application could not be saved.");
  return result;
}

export async function uploadAdmissionDocument(accessToken, documentKey, file) {
  if (!accessToken) throw new Error("Please sign in again before uploading a document.");
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/applications/${encodeURIComponent(getNewAdmissionId())}/documents/${encodeURIComponent(documentKey)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || "Document could not be uploaded.");
  return result;
}

async function requestAdmissionStatus(accessToken, path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || "Live application status could not be loaded.");
  return result;
}

function adoptApplicationNumber(status) {
  const applicationNumber = status?.application?.application_number || status?.application_number;
  if (applicationNumber) setNewAdmissionId(applicationNumber);
  return applicationNumber || "";
}

export async function getCurrentAdmissionStatus(accessToken) {
  if (!accessToken) return null;
  const result = await requestAdmissionStatus(accessToken, "/applications/current/status");
  if (result) adoptApplicationNumber(result);
  return result;
}

export async function getAdmissionStatus(accessToken, applicationNumber = getNewAdmissionId()) {
  if (!accessToken || !applicationNumber) return null;

  const result = await requestAdmissionStatus(accessToken, `/applications/${encodeURIComponent(applicationNumber)}/status`);
  if (result) {
    adoptApplicationNumber(result);
    return result;
  }

  // This browser may have generated a new local ID while the applicant's
  // existing application is stored in RDS. Resolve their latest owned record.
  return getCurrentAdmissionStatus(accessToken);
}
