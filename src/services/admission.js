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
  uploaded: "Uploaded",
  under_verification: "Under Verification",
  verified: "Verified",
  reupload_required: "Re-upload required",
  rejected: "Rejected",
};

const applicationStatusLabels = {
  draft: "Draft — not submitted",
  new_application: "Application started",
  submitted: "Pending",
  pending: "Pending",
  document_verification: "Under Verification",
  pending_approval: "Documents Verified",
  uploaded: "Documents uploaded",
  under_verification: "Under Verification",
  documents_verified: "Documents Verified",
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
  return documentStatusLabels[status === "submitted" ? "uploaded" : status === "approved" ? "verified" : status] || readableStatus(status) || "Not Uploaded";
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
      if (document.status === "Submitted") return { ...document, status: document.file ? "Uploaded" : "Not Uploaded" };
      if (document.status === "Approved") return { ...document, status: document.file ? "Verified" : "Not Uploaded" };
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

const databaseDocumentStatusLabels = {
  uploaded: "Uploaded",
  under_verification: "Under Verification",
  verified: "Verified",
  reupload_required: "Re-upload Required",
  rejected: "Rejected",
};

// The browser cache only makes the upload screen feel immediate. The database
// remains the source of truth so a parent sees the same document state after
// signing in from another browser or device.
export function syncAdmissionDocumentsFromDatabase(records = []) {
  const recordsByKey = new Map(records.map((record) => [record.document_key, record]));
  const documents = defaultDocuments.map((document) => {
    const record = recordsByKey.get(document.id);
    if (!record) return { ...document };

    return {
      ...document,
      status: databaseDocumentStatusLabels[record.status] || readableStatus(record.status),
      file: record.file_name || "",
      reason: record.reason || "",
      storageId: record.id,
      sizeBytes: record.size_bytes,
      contentType: record.content_type,
    };
  });
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
  return documents;
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

export async function getAdmissionDocumentRecords(accessToken) {
  if (!accessToken) return [];

  async function requestDocuments(applicationNumber) {
    const response = await fetch(`${API_BASE_URL}/applications/${encodeURIComponent(applicationNumber)}/documents`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 404) return null;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Saved documents could not be loaded.");
    return Array.isArray(result) ? result : [];
  }

  let records = await requestDocuments(getNewAdmissionId());
  if (records) return records;

  // A new browser can have a generated local ID. Resolve the parent's latest
  // record before deciding that no documents exist.
  const currentStatus = await getCurrentAdmissionStatus(accessToken);
  if (!currentStatus?.application?.application_number) return [];
  records = await requestDocuments(currentStatus.application.application_number);
  return records || [];
}

export async function getAdmissionDocumentFile(accessToken, applicationNumber, documentKey) {
  if (!accessToken || !applicationNumber || !documentKey) throw new Error("Please sign in again before opening this document.");
  const response = await fetch(`${API_BASE_URL}/applications/${encodeURIComponent(applicationNumber)}/documents/${encodeURIComponent(documentKey)}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.detail || "Document could not be opened.");
  }
  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

export async function deleteAdmissionDocument(accessToken, applicationNumber, documentKey) {
  if (!accessToken || !applicationNumber || !documentKey) throw new Error("Please sign in again before deleting this document.");
  const response = await fetch(`${API_BASE_URL}/applications/${encodeURIComponent(applicationNumber)}/documents/${encodeURIComponent(documentKey)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.detail || "Document could not be deleted.");
  }
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
