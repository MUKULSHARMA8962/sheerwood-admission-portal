function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function paymentLabel(value) {
  return String(value || "pending").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PaymentDetailsModal({ detail, onClose }) {
  if (!detail) return null;
  const { application, data, loading, error } = detail;
  const transactions = data?.transactions || [];

  return <div className="admission-payment-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admission-payment-modal" role="dialog" aria-modal="true" aria-labelledby="admission-payment-title">
      <header>
        <div><p>REGISTRATION FEE</p><h2 id="admission-payment-title">Payment details</h2><span>{data?.application_number || application.application_number} · {data?.student_name || application.student_name || "Applicant"}</span></div>
        <button type="button" onClick={onClose} aria-label="Close payment details">×</button>
      </header>
      {loading && <p className="admission-payment-state">Loading payment transactions…</p>}
      {error && <p className="admission-payment-state error" role="alert">{error}</p>}
      {data && <div className="admission-payment-content">
        <dl className="admission-payment-summary"><div><dt>Current payment status</dt><dd className={`is-${String(data.payment_status || "pending").replaceAll("_", "-")}`}>{paymentLabel(data.payment_status)}</dd></div><div><dt>Payment confirmed</dt><dd>{formatDateTime(data.paid_at)}</dd></div><div><dt>Transactions</dt><dd>{transactions.length}</dd></div></dl>
        {transactions.length ? <div className="admission-payment-table-scroll"><table><thead><tr><th>Transaction ID</th><th>Gateway ID</th><th>Amount</th><th>Status</th><th>Initiated</th><th>Paid</th><th>Last Updated</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.txnid}><td><code>{transaction.txnid}</code></td><td><code>{transaction.easebuzz_id || "—"}</code></td><td>{transaction.amount ? `₹${transaction.amount}` : "—"}</td><td><span className={`admission-payment-status is-${String(transaction.status || "pending").replaceAll("_", "-")}`}>{paymentLabel(transaction.status)}</span></td><td>{formatDateTime(transaction.created_at)}</td><td>{formatDateTime(transaction.paid_at)}</td><td>{formatDateTime(transaction.updated_at)}</td></tr>)}</tbody></table></div> : <p className="admission-payment-state">No payment transaction has been started for this application.</p>}
      </div>}
    </section>
  </div>;
}
