import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Fee_Payment.css";

const methods = [["▣", "Credit / Debit Card"], ["▥", "Net Banking"], ["◒", "UPI"], ["▤", "Wallets"]];

export default function FeePayment() {
  const navigate = useNavigate();
  const [method, setMethod] = useState("Credit / Debit Card");
  return <main className="fee-page"><header className="fee-header"><Link className="fee-brand" to="/dashboard"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link><span>Secure payment <b>●</b></span></header><section className="fee-shell"><div className="fee-heading"><p>APPLICATION # AIS/2027-28/000124</p><h1>Fee Payment</h1><small>Complete your application fee to submit your admission request.</small></div><div className="fee-content"><section className="fee-summary"><p>Application Fee</p><strong>₹ 1,500</strong><div><b>Breakdown</b><span><i>Application Fee</i><em>₹ 1,000</em></span><span><i>GST (18%)</i><em>₹ 180</em></span><hr /><span className="total"><i>Total Amount</i><em>₹ 1,180</em></span></div></section><section className="payment-methods"><h2>Payment Methods</h2>{methods.map(([icon, label]) => <button className={method === label ? "selected" : ""} key={label} onClick={() => setMethod(label)}><span>{icon}</span>{label}<i>{method === label ? "●" : ""}</i></button>)}</section></div><footer className="fee-actions"><button onClick={() => navigate("/application/review")}>← Back</button><button onClick={() => navigate("/application-success")}>Proceed to Pay <span>→</span></button></footer></section></main>;
}
