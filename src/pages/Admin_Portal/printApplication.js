import crestUrl from "../../assets/sheerwood-crest.png";

const hiddenFields = new Set(["storageId", "contentType", "sizeBytes", "file", "uploadedDocuments"]);
const reportLabels = {
  session: "Academic Year",
  communication: "Address for Communication",
  permanent: "Permanent Address",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function label(value) {
  return reportLabels[value] || String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function valueText(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(", ");
  return String(value ?? "").trim() || "Not provided";
}

function reportValue(key, value) {
  if (key === "birthDate" && /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    const [year, month, day] = String(value).split("-");
    return `${day}-${month}-${year}`;
  }
  return valueText(value);
}

function renderFields(values) {
  if (!values || typeof values !== "object") return "";
  return Object.entries(values).filter(([key]) => !hiddenFields.has(key)).map(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = renderFields(value);
      return nested ? `<tr><th colspan="2" class="nested-heading">${escapeHtml(label(key))}</th></tr>${nested}` : "";
    }
    return `<tr><th>${escapeHtml(label(key))}</th><td>${escapeHtml(reportValue(key, value))}</td></tr>`;
  }).join("");
}

function section(title, values) {
  const fields = renderFields(values);
  return fields ? `<section><h2>${escapeHtml(title)}</h2><table><tbody>${fields}</tbody></table></section>` : "";
}

export function applicationPrintHtml(application, photographs) {
  const form = application.form_data && typeof application.form_data === "object" ? application.form_data : {};
  const guardians = form.guardians && typeof form.guardians === "object" ? form.guardians : {};
  const photoHtml = ["student-photo", "father-photo", "mother-photo"].map((key) => {
    const photo = photographs[key];
    const title = key === "student-photo" ? "Student photograph" : key === "father-photo" ? "Father photograph" : "Mother photograph";
    return `<figure>${photo?.dataUrl ? `<img src="${photo.dataUrl}" alt="${title}" />` : '<div class="photo-placeholder">Not uploaded</div>'}<figcaption>${title}</figcaption></figure>`;
  }).join("");
  const documentRows = (application.documents || []).map((document) => `<tr><th>${escapeHtml(label(document.document_key))}</th><td>${escapeHtml(document.file_name || "Not uploaded")} · ${escapeHtml(document.status || "Uploaded")}</td></tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Application ${escapeHtml(application.application_number)}</title><style>
    *{box-sizing:border-box}body{margin:0;color:#173d2d;font-family:Arial,sans-serif;background:#f4f8f5}main{width:210mm;min-height:297mm;padding:15mm;margin:auto;background:#fff}.masthead{display:grid;grid-template-columns:25mm minmax(0,1fr) auto;align-items:center;gap:5mm;padding:0 0 10mm;border-bottom:4px solid #08783f}.report-logo{width:23mm;height:23mm;object-fit:contain}.masthead h1{margin:0;font:600 28px Georgia,serif}.masthead p{margin:4px 0 0;color:#567064;font-size:12px}.application-id{padding:10px 13px;border-radius:8px;color:#fff;background:#08783f;font-size:12px;font-weight:800;white-space:nowrap}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:9mm 0 5mm}.photos figure{margin:0;text-align:center}.photos img,.photo-placeholder{width:35mm;height:43mm;display:block;object-fit:cover;margin:auto;border:1px solid #cfe0d4;border-radius:5px;background:#f5f8f6}.photo-placeholder{display:grid;place-items:center;color:#718078;font-size:11px}.photos figcaption{margin-top:5px;color:#456654;font-size:11px;font-weight:800;text-transform:uppercase}section{margin-top:7mm;break-inside:avoid}h2{padding:8px 10px;margin:0;color:#fff;background:#07502f;font-size:15px;letter-spacing:.4px;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:7px 9px;border:1px solid #dce7df;text-align:left;vertical-align:top;line-height:1.4}th{width:38%;color:#365746;background:#f4f8f5}.nested-heading{width:auto;color:#08783f;background:#eaf6ed}.footer{margin-top:9mm;padding-top:4mm;border-top:1px solid #dce7df;color:#718078;font-size:10px}@media print{body{background:#fff}main{width:auto;min-height:0;padding:0}.masthead{padding-top:0}section{break-inside:avoid}}
  </style></head><body><main><header class="masthead"><img class="report-logo" src="${escapeHtml(crestUrl)}" alt="Sherwood College crest" /><div><h1>Sherwood College</h1><p>Admission Application Form</p></div><div class="application-id">APPLICATION # ${escapeHtml(application.application_number || "—")}</div></header><div class="photos">${photoHtml}</div>${section("Admission details", form.admissionDetails || { "Application date": application.submitted_on, "Class applying for": application.desired_class })}${section("Student details", form.student)}${section("Address details", form.addresses)}${Object.entries(guardians).map(([role, details]) => section(`${role} / guardian details`, details)).join("")}${section("Additional details", Object.fromEntries(Object.entries(form).filter(([key]) => !["admissionDetails", "student", "addresses", "guardians", "studentPhoto", "parentPhotos"].includes(key))))}${documentRows ? `<section><h2>Uploaded documents</h2><table><tbody>${documentRows}</tbody></table></section>` : ""}<p class="footer">Generated from the Sherwood College Admissions Portal. Keep this form confidential.</p></main></body></html>`;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Image could not be prepared for printing."));
    reader.readAsDataURL(blob);
  });
}
