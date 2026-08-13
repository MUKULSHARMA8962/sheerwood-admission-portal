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
  { id: "photo", name: "Student Photo", status: "Approved" },
  { id: "birth-certificate", name: "Birth Certificate", status: "Under Verification" },
  { id: "student-id", name: "Student Aadhaar", status: "Approved" },
  { id: "parent-id", name: "Parent ID", status: "Approved" },
  { id: "address-proof", name: "Address Proof", status: "Re-upload Required", reason: "Image is unclear" },
  { id: "report-card", name: "Previous Report Card", status: "Under Verification" },
  { id: "transfer-certificate", name: "Transfer Certificate", status: "Pending" },
];

export function getAdmissionDocuments() {
  const savedDocuments = localStorage.getItem(DOCUMENTS_KEY);
  if (savedDocuments) return JSON.parse(savedDocuments);
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(defaultDocuments));
  return defaultDocuments;
}

export function updateAdmissionDocument(documentId, status, reason = "") {
  const updatedDocuments = getAdmissionDocuments().map((document) => document.id === documentId ? { ...document, status, reason } : document);
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updatedDocuments));
  return updatedDocuments;
}
