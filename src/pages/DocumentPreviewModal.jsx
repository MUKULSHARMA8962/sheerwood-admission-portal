import "./DocumentPreviewModal.css";

export default function DocumentPreviewModal({ preview, deleting, onClose, onDownload, onReplace, onDelete }) {
  if (!preview) return null;

  const { document, fileUrl, contentType, error, loading } = preview;
  const canPreviewPdf = contentType === "application/pdf";
  const canPreviewImage = contentType?.startsWith("image/");

  return <div className="admission-document-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admission-document-modal" role="dialog" aria-modal="true" aria-labelledby="document-preview-title">
      <header>
        <div><p>DOCUMENT PREVIEW</p><h2 id="document-preview-title">{document.document_key.replaceAll("-", " ")}</h2><small>{document.file_name}</small></div>
        <button type="button" className="admission-document-modal-close" onClick={onClose} aria-label="Close document preview">×</button>
      </header>

      <div className="admission-document-preview-area">
        {loading && <p>Opening your saved document…</p>}
        {error && <p className="admission-document-preview-error">{error}</p>}
        {!loading && !error && canPreviewPdf && <iframe title={document.file_name} src={fileUrl} />}
        {!loading && !error && canPreviewImage && <img src={fileUrl} alt={document.file_name} />}
        {!loading && !error && !canPreviewPdf && !canPreviewImage && <p>This file cannot be previewed in the browser. Download it to read it.</p>}
      </div>

      <footer>
        <button type="button" className="admission-document-download" onClick={onDownload} disabled={!fileUrl}>Download</button>
        <div><button type="button" className="admission-document-replace" onClick={onReplace}>Replace</button><button type="button" className="admission-document-delete" onClick={onDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button></div>
      </footer>
    </section>
  </div>;
}
