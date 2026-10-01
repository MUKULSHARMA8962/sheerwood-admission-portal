const requiredDocuments = [
  ["report-card", "Report Card"],
  ["aadhaar-card", "Aadhaar Card"],
  ["birth-certificate", "Birth Certificate"],
];

const documentLabels = {
  passport: "Passport",
  "national-id-card": "National ID Card",
  "student-photo": "Student Photograph",
  "father-photo": "Father's Photograph",
  "mother-photo": "Mother's Photograph",
};

function label(key) {
  return documentLabels[key] || String(key || "Document").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status) {
  const normalized = status === "submitted" ? "uploaded" : status;
  return String(normalized || "pending").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DocumentChecklistModal({ application, onClose, onOpenDocument }) {
  if (!application) return null;
  const documents = Array.isArray(application.documents) ? application.documents : [];
  const documentsByKey = new Map(documents.map((document) => [document.document_key, document]));
  const requiredKeys = new Set(requiredDocuments.map(([key]) => key));
  const rows = [
    ...requiredDocuments.map(([key, name]) => ({ key, name, required: true, document: documentsByKey.get(key) })),
    ...documents.filter((document) => !requiredKeys.has(document.document_key)).map((document) => ({ key: document.document_key, name: label(document.document_key), required: false, document })),
  ];

  return <div className="admission-document-list-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admission-document-list-modal" role="dialog" aria-modal="true" aria-labelledby="admission-document-list-title">
      <header><div><p>APPLICATION DOCUMENTS</p><h2 id="admission-document-list-title">Document checklist</h2><span>{application.application_number} · {application.student_name || "Applicant"}</span></div><button type="button" onClick={onClose} aria-label="Close document checklist">×</button></header>
      <div className="admission-document-list-table-scroll"><table><thead><tr><th>Document</th><th>Requirement</th><th>File</th><th>Status</th><th>Remark</th><th>Action</th></tr></thead><tbody>{rows.map(({ key, name, required, document }) => <tr key={key}><td><b>{name}</b></td><td>{required ? "Required" : "Additional"}</td><td>{document?.file_name || "Not uploaded"}</td><td><span className={`admission-document-list-status is-${String(document?.status || "pending").replaceAll("_", "-")}`}>{document ? statusLabel(document.status) : "Not uploaded"}</span></td><td>{document?.reason || "—"}</td><td>{document ? <button type="button" className="admission-document-list-open" onClick={() => onOpenDocument(document)}>Open file</button> : "—"}</td></tr>)}</tbody></table></div>
      <footer><b>{documents.length} uploaded</b><span>{requiredDocuments.filter(([key]) => documentsByKey.has(key)).length}/{requiredDocuments.length} required documents uploaded</span></footer>
    </section>
  </div>;
}
