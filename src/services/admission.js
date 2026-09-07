const APPLICATION_ID_KEY = "sheerwood-new-admission-id";
const DOCUMENTS_KEY = "sheerwood-new-admission-documents";

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
  { id: "other", name: "Other Document", status: "Not Uploaded", file: "" },
];

export function getAdmissionDocuments() {
  const savedDocuments = localStorage.getItem(DOCUMENTS_KEY);
  if (savedDocuments) {
    const documents = JSON.parse(savedDocuments).map((document) => {
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
