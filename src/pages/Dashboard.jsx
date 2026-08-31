import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import "./DashboardToggle.css";
import "./AdmissionDashboard.css";
import "./ParentAiFloating.css";
import "./NewAdmissionAction.css";

const navigation = [
  ["⌂", "Dashboard", "/dashboard"],
  ["▣", "New Admission", "/admission-details"],
  ["▤", "Applications", "/track-application"],
  ["✦", "AI Assistant", "/ai-assistant", "New"],
  ["▧", "Documents", "/application/documents"],
  ["▥", "Payments", "/fee-payment"],
  ["♙", "Profile"],
  ["?", "Help Center", "/ai-assistant"],
  ["▱", "Reports", "/track-application"],
  ["⚙", "Settings"],
];

const stats = [
  ["▤", "Applications", "1,245", "Total", "leaf"],
  ["◷", "In Progress", "320", "25.8%", "blue"],
  ["➤", "Submitted", "925", "74.2%", "purple"],
  ["✓", "Approved", "210", "22.7%", "mint"],
];

const recentApplications = [
  ["AS", "Aarav Sharma", "Class 5", "In Progress", "2 hours ago"],
  ["AG", "Ananya Gupta", "Class 3", "Submitted", "1 day ago"],
  ["VS", "Vivaan Singh", "Class 1", "Draft", "2 days ago"],
  ["MP", "Myra Patel", "Class 2", "Approved", "3 days ago"],
];

const quickActions = [
  ["▣", "New Admission", "Start a new admission", "/admission-details"],
  ["⇧", "Upload Documents", "Upload required documents", "/application/documents"],
  ["▥", "Fee Payment", "Make online payment", "/fee-payment"],
  ["⌕", "Track Application", "Check your application status", "/track-application"],
];

const journey = [
  ["Admission Details", "Fill basic admission details and select class for admission.", "100%", "/admission-details", "♙"],
  ["Student Information", "Provide student personal, contact and identity information.", "100%", "/student-information", "♧"],
  ["Parent / Guardian", "Enter parent or guardian contact details.", "100%", "/parent-guardian", "♟"],
  ["Residential Information", "Provide address and residential details.", "100%", "/application/residential", "⌂"],
  ["Academic Background", "Provide previous academic records and details.", "60%", "/application/academic", "▤"],
  ["Document Upload", "Upload all required documents.", "30%", "/application/documents", "▣"],
  ["Review Application", "Review all details before final submission.", "0%", "/application/review", "▧"],
  ["Fee Payment", "Pay the required admission fees online.", "0%", "/fee-payment", "▥"],
];

const documentChecklist = [
  ["✓", "Birth Certificate", "Verified", "verified"],
  ["✓", "Aadhaar Card", "Verified", "verified"],
  ["✓", "Passport Photograph", "Verified", "verified"],
  ["⇧", "Transfer Certificate", "Upload required", "required"],
];

const suggestions = ["What documents are required?", "How can I apply?", "What is the age criteria?", "Fee structure details", "How can I track my application?"];

function progressClass(value) {
  return value === "100%" ? "complete" : value === "0%" ? "pending" : "working";
}

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Hello! I’m your AI Assistant. How can I help you today?");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [session, setSession] = useState("2025–26");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [aiFloatingOpen, setAiFloatingOpen] = useState(false);
  const parentName = location.state?.email?.split("@")[0] || "Parent";

  function openItem(label, route) {
    if (route) {
      navigate(route);
      return;
    }
    setNotice(`${label} will be available soon.`);
  }

  function ask(event) {
    event.preventDefault();
    const typedQuestion = question.trim();
    if (!typedQuestion) return;
    setAnswer("I can help with admissions, documents, fees and application status. For detailed help, open the full AI Assistant.");
    setQuestion("");
  }

  return (
    <main className={sidebarOpen ? "parent-dashboard" : "parent-dashboard sidebar-closed"}>
      <aside className="parent-sidebar">
        <Link className="parent-brand" to="/">
          <span className="parent-crest">S</span>
          <span><strong>Sheerwood</strong><small>International School</small></span>
        </Link>
        <nav className="parent-nav" aria-label="Parent portal navigation">
          {navigation.map(([icon, label, route, badge]) => <button className={label === "Dashboard" ? "active" : ""} key={label} onClick={() => openItem(label, route)}><i>{icon}</i><span>{label}</span>{badge && <b>{badge}</b>}</button>)}
        </nav>
        <section className="sidebar-assistant"><p>Need Help?</p><span>Chat with our<br />AI Assistant</span><div className="tiny-robot"><i>● ●</i><b>⌣</b></div><button onClick={() => navigate("/ai-assistant")}>Start Chat</button></section>
        <button className="parent-logout" onClick={() => navigate("/login")}><i>↪</i> Logout</button>
      </aside>

      <section className="parent-workspace">
        <header className="parent-topbar">
          <button className="hamburger" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle navigation" aria-expanded={sidebarOpen}>☰</button>
          <div className="topbar-user">
            <div className="topbar-dropdown">
              <button className="topbar-select" onClick={() => { setSessionMenuOpen((open) => !open); setProfileMenuOpen(false); }} aria-expanded={sessionMenuOpen}><span className="calendar">▣</span><span><small>Academic Session</small><b>{session}⌄</b></span></button>
              {sessionMenuOpen && <div className="topbar-menu session-menu"><button onClick={() => { setSession("2025–26"); setSessionMenuOpen(false); }}>2025–26 <span>Current</span></button><button onClick={() => { setSession("2026–27"); setSessionMenuOpen(false); }}>2026–27</button><button onClick={() => { setSession("2027–28"); setSessionMenuOpen(false); }}>2027–28</button></div>}
            </div>
            <button className="bell" aria-label="Notifications">♧<i>3</i></button>
            <div className="topbar-dropdown profile-dropdown">
              <button className="profile-select" onClick={() => { setProfileMenuOpen((open) => !open); setSessionMenuOpen(false); }} aria-expanded={profileMenuOpen}><span className="top-avatar">RS</span><span><b>Rajesh Sharma⌄</b><small>Parent</small></span></button>
              {profileMenuOpen && <div className="topbar-menu profile-menu"><button onClick={() => { setProfileMenuOpen(false); setNotice("Profile settings will be available soon."); }}>♙ My Profile</button><button onClick={() => { setProfileMenuOpen(false); navigate("/track-application"); }}>▤ Track Application</button><button className="menu-logout" onClick={() => navigate("/login")}>↪ Logout</button></div>}
            </div>
          </div>
        </header>

        <div className="parent-layout">
          <section className="parent-main">
            <header className="welcome-header"><div><h1>Welcome back, {parentName}! <span>👋</span></h1><p>Here’s what’s happening with your admission journey.</p></div><div className="session-chip"><i>✦</i><span>Academic Session<b>{session}⌄</b></span></div></header>
            {notice && <div className="parent-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

            <section className="parent-stat-grid">{stats.map(([icon, label, value, caption, tone]) => <article key={label}><i className={tone}>{icon}</i><div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></article>)}</section>

            <section className="admission-spotlight" aria-labelledby="admission-centre-title">
              <div className="admission-spotlight-main">
                <header><div><p>ACTIVE ADMISSION APPLICATION</p><h2 id="admission-centre-title">New Admission — Aadhya Sharma</h2><small>AIS/2027-28/000124 · Applying for Class 2 · Session {session}</small></div><span className="approval-chip pending"><i>◷</i> Approval pending</span></header>
                <div className="admission-stage-meter"><span className="stage-number">7</span><div><b>Application is almost ready for review</b><small>Complete the last document upload to send this application for final approval.</small><div><i style={{ width: "78%" }} /></div></div><strong>78%</strong></div>
                <div className="admission-spotlight-actions"><button className="admission-primary" onClick={() => navigate("/application/documents")}>Upload document <span>→</span></button><button onClick={() => navigate("/track-application")}>Track approval</button><button onClick={() => navigate("/admission-details")}>Edit application</button></div>
              </div>
              <aside className="admission-document-summary"><header><div><p>DOCUMENT STATUS</p><h3>4 of 5 verified</h3></div><button onClick={() => navigate("/application/documents")}>View all →</button></header><ul>{documentChecklist.map(([icon, name, state, tone]) => <li className={tone} key={name}><i>{icon}</i><span>{name}<small>{state}</small></span>{tone === "required" ? <button onClick={() => navigate("/application/documents")}>Upload</button> : <b>Verified</b>}</li>)}</ul></aside>
            </section>

            <section className="dashboard-double-grid">
              <article className="parent-panel recent-panel"><h2>Recent Applications</h2><div className="recent-table"><div className="recent-row table-label"><span>—</span><span>Student Name</span><span>Class</span><span>Status</span><span>Last Updated</span></div>{recentApplications.map(([initials, name, className, status, updated]) => <div className="recent-row" key={name}><i>{initials}</i><b>{name}</b><span>{className}</span><em className={status.toLowerCase().replace(" ", "-")}>{status}</em><span>{updated}</span></div>)}</div><button className="panel-link" onClick={() => navigate("/track-application")}>View All Applications →</button></article>
              <article className="parent-panel quick-panel"><h2>Quick Actions</h2>{quickActions.map(([icon, title, detail, route]) => <button key={title} onClick={() => navigate(route)}><i>{icon}</i><span><b>{title}</b><small>{detail}</small></span></button>)}</article>
            </section>

            <section className="journey-panel"><header className="journey-panel-header"><div><h2>Admission Journey</h2><small>Track an application or begin a new one.</small></div><button onClick={() => navigate("/login?flow=admission")}>＋ New Admission</button></header><ol className="journey-steps">{journey.map(([title], index) => <li className={index < 5 ? "done" : ""} key={title}><i>{index + 1}</i><span>{title}</span></li>)}</ol></section>

            <section className="journey-card-grid">{journey.map(([title, description, completed, route, icon]) => <article className="journey-card" key={title}><div className="journey-card-heading"><i>{icon}</i><div><h3>{title}</h3><p>{description}</p></div></div><div className="progress-copy"><span>{completed} Completed</span>{completed === "100%" && <b>✓</b>}</div><div className={`progress-line ${progressClass(completed)}`}><i style={{ width: completed }} /></div><button onClick={() => navigate(route)}>{title === "Review Application" ? "Review" : title === "Fee Payment" ? "Pay Now" : "View / Edit"}</button></article>)}</section>
            <footer className="parent-footer">© 2025 Sheerwood International School. All rights reserved.<span>Privacy Policy　|　Terms &amp; Conditions</span></footer>
          </section>

          <aside className="parent-rightbar">
            <section className="right-ai-card"><header><h2>✦ AI Assistant</h2><span>● Online</span></header><div className="right-ai-content"><div className="right-robot"><i>● ●</i><b>⌣</b></div><p>{answer}</p></div><div className="suggestion-list">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setAnswer(suggestion === "What documents are required?" ? "You will need a birth certificate, Aadhaar card, passport photos, and school records." : "I can help you with that. Open the full AI Assistant for a detailed answer.")}>{suggestion}</button>)}</div><form onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Type your question..." /><button aria-label="Ask AI">→</button></form></section>
            <section className="right-panel notices"><header><h2>Important Notices</h2><button onClick={() => setNotice("You have viewed all notices.")}>View All</button></header>{[["▣", "Application Deadline Extended", "The last date to submit applications has been extended to 31st May 2025.", "2 hours ago", "red"], ["▣", "Admission Test Schedule", "Admission test for Classes 1 to 8 will be held on 15th June 2025.", "1 day ago", "blue"], ["▣", "New Academic Session", "Academic session 2025–26 will commence from 1st April 2025.", "3 days ago", "green"]].map(([icon, title, details, time, tone]) => <article key={title}><i className={tone}>{icon}</i><div><b>{title}</b><p>{details}</p></div><time>{time}</time></article>)}</section>
            <section className="right-panel support-card"><h2>Need Help?</h2><p>Our support team is here to help you with your admission process.</p><button onClick={() => setNotice("Support request started.")}>♧ Contact Support</button><i>AI</i></section>
            <section className="right-panel overall-progress"><h2>Application Progress</h2><div><div className="overall-donut"><b>60%</b></div><ul><li><i className="completed" />Completed <b>5 / 10</b></li><li><i className="in-progress" />In Progress <b>2 / 10</b></li><li><i className="pending" />Pending <b>3 / 10</b></li></ul></div></section>
          </aside>
        </div>
      </section>
      {aiFloatingOpen && <section className="parent-ai-floating-popup" role="dialog" aria-modal="false" aria-labelledby="parent-ai-floating-title"><header><div><i>✦</i><span><b id="parent-ai-floating-title">AI Assistant</b><small>● Online</small></span></div><button onClick={() => setAiFloatingOpen(false)} aria-label="Close AI assistant">×</button></header><p>{answer}</p><div>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setAnswer(suggestion === "What documents are required?" ? "You will need a birth certificate, Aadhaar card, passport photos, and school records." : suggestion === "Fee structure details" ? "The application fee and payment options are available in the Fees section. I can guide you through payment." : suggestion === "How can I track my application?" ? "Open Track Application to view progress, document verification and the admission decision." : "I can help with that. Tell me a little more about your admission question.")}>{suggestion}</button>)}</div><form onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about admissions..." /><button aria-label="Send question">→</button></form></section>}
      <button className="parent-ai-floating-button" onClick={() => setAiFloatingOpen((open) => !open)} aria-expanded={aiFloatingOpen}><span>✦</span> Ask Sheerwood AI</button>
    </main>
  );
}
