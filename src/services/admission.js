const APPLICATION_ID_KEY = "sheerwood-new-admission-id";
const DOCUMENTS_KEY = "sheerwood-new-admission-documents";
const APPLICATION_DATA_KEY = "sheerwood-admission-data";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export function getNewAdmissionId() {
  const existingId = localStorage.getItem(APPLICATION_ID_KEY);
  if (existingId) return existingId;

  const applicationId = `SHW-ADM-2027-${Math.floor(100000 + Math.random() * 900000)}`;
  localStorage.setItem(APPLICATION_ID_KEY, applicationId);
  return applicationId;
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

export function updateAdmissionDocument(documentId, status, reason = "", file) {
  const updatedDocuments = getAdmissionDocuments().map((document) => document.id === documentId ? { ...document, status, reason, ...(file ? { file } : {}) } : document);
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
