import { useState } from "react";
import { Link } from "react-router-dom";
import { askSchoolAI } from "../../services/api";
import "./AI_Assistant.css";

const defaultMessages = [{ role: "user", text: "What documents are required for Class 1 admission?" }, { role: "assistant", text: "Here is the list of documents required:", items: ["Birth Certificate", "Aadhaar Card", "2 Passport Size Photos", "Previous School Report Card (if any)", "Transfer Certificate (if applicable)", "Medical Certificate"] }];

export default function AIAssistant() {
  const [messages, setMessages] = useState(defaultMessages);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  async function send(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);
    try {
      const answer = await askSchoolAI(trimmed, "guest");
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error.message }]);
    } finally {
      setLoading(false);
    }
  }
  return <main className="ai-page"><header className="ai-header"><Link className="ai-brand" to="/dashboard"><span>✦</span><strong>AI Assistant</strong></Link><Link to="/dashboard">← Dashboard</Link></header><section className="ai-shell"><aside className="ai-side"><div><span className="ai-side-icon">✦</span><h1>AI Assistant</h1><p>Always here to help!</p></div><div className="robot" aria-label="Friendly assistant robot"><i>● ●</i><span>⌣</span></div><small>Ask about admissions, documents, fees, or your application status.</small></aside><section className="ai-chat" aria-label="Conversation">{messages.map((message, index) => <article className={message.role === "user" ? "message user" : "message assistant"} key={`${message.role}-${index}`}><span>{message.role === "user" ? "You" : "✦ AI Assistant"}</span><p>{message.text}</p>{message.items && <ul>{message.items.map((item) => <li key={item}>{item}</li>)}</ul>}{message.role === "assistant" && <small>Let me know if you need any more help!</small>}</article>)}{loading && <article className="message assistant ai-thinking"><span>✦ AI Assistant</span><p>Thinking…</p></article>}<form className="ai-input" onSubmit={send}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Type your question..." aria-label="Type your question" disabled={loading} /><button aria-label="Send question" type="submit" disabled={loading}>{loading ? "…" : "→"}</button></form></section></section></main>;
}
