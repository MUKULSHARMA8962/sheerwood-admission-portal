import "./DocumentPreviewModal.css";

export default function DocumentPreviewModal({ preview, deleting, onClose, onDownload, onReplace, onDelete, actions = [] }) {
  if (!preview) return null;

  const { document, fileUrl, contentType, error, loading } = preview;
  const documentTitle = document.document || document.document_key.replaceAll("-", " ");
  const fileName = document.file_name || document.file || "admission-document";
  const canPreviewPdf = contentType === "application/pdf";
  const canPreviewImage = contentType?.startsWith("image/");

  return <div className="admission-document-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admission-document-modal" role="dialog" aria-modal="true" aria-labelledby="document-preview-title">
      <header>
        <div><p>DOCUMENT PREVIEW</p><h2 id="document-preview-title">{documentTitle}</h2><small>{fileName}</small></div>
        <button type="button" className="admission-document-modal-close" onClick={onClose} aria-label="Close document preview">×</button>
      </header>

      <div className="admission-document-preview-area">
        {loading && <p>Opening your saved document…</p>}
        {error && <p className="admission-document-preview-error">{error}</p>}
        {!loading && !error && canPreviewPdf && <iframe title={fileName} src={fileUrl} />}
        {!loading && !error && canPreviewImage && <img src={fileUrl} alt={fileName} />}
        {!loading && !error && !canPreviewPdf && !canPreviewImage && <p>This file cannot be previewed in the browser. Download it to read it.</p>}
      </div>

      <footer>
        <button type="button" className="admission-document-download" onClick={onDownload} disabled={!fileUrl}>Download</button>
        <div>{actions.map((action) => <button type="button" key={action.label} className={action.className || "admission-document-replace"} onClick={action.onClick} disabled={action.disabled}>{action.label}</button>)}{onReplace && <button type="button" className="admission-document-replace" onClick={onReplace}>Replace</button>}{onDelete && <button type="button" className="admission-document-delete" onClick={onDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>}</div>
      </footer>
    </section>
  </div>;
}
