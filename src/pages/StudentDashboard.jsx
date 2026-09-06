import { useState } from "react";
import { Link } from "react-router-dom";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import "./StudentDashboard.css";
import "./StudentAuth.css";
import StudentPortalModule from "./StudentPortalModule";

const navigation = [["⌂", "Dashboard"], ["◔", "Attendance"], ["▤", "My Subjects"], ["◷", "Timetable"], ["▱", "Homework"], ["✦", "Exams & Results"], ["▥", "Performance"], ["▣", "Study Material"], ["✉", "Announcements"], ["◫", "Fees"], ["◒", "Leave Request"], ["✧", "AI Assistant"], ["♙", "My Profile"]];
const kpis = [["◔", "Attendance", "92%", "Great progress", "green"], ["▤", "Subjects", "7", "This term", "blue"], ["▱", "Pending Homework", "3", "Due this week", "orange"], ["✦", "Upcoming Exams", "2", "Next: 18 Jun", "purple"], ["↗", "Average Score", "86%", "+4% this month", "mint"]];
const subjects = [["English", "Neha Ma'am", "42/45", "93%", "Good", "green"], ["Mathematics", "Amit Sir", "35/45", "78%", "Watch", "yellow"], ["Science", "Rahul Sir", "44/45", "98%", "Excellent", "green"], ["Hindi", "Priya Ma'am", "31/45", "69%", "Low", "red"]];
const classes = [["09:00", "English", "Neha Sharma", "Room 204", "Completed"], ["10:00", "Mathematics", "Amit Verma", "Room 107", "Now"], ["11:00", "Science", "Rahul Mehta", "Lab 02", "Upcoming"], ["12:00", "Computer", "Arjun Singh", "Lab 01", "Upcoming"]];
const homework = [["Mathematics", "Algebra practice worksheet", "Today, 6:00 PM", "Pending"], ["Science", "Complete cell structure diagram", "Tomorrow, 9:00 AM", "Pending"], ["English", "Read Chapter 8 and write summary", "14 Jun", "Pending"]];

export default function StudentDashboard() {
  const { signOut, user } = useCognitoAuth();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("Hi Rahul! I can explain a chapter, make MCQs, or help you plan homework.");

  const askAi = (event) => {
    event.preventDefault();
    if (!question.trim()) return;
    setAiAnswer("Let’s work through that together. I suggest reviewing the key concept first, then trying three practice questions.");
    setQuestion("");
  };

  return <main className="student-dashboard">
    <aside className="student-sidebar">
      <Link className="student-brand" to="/"><span>S</span><div><strong>Sheerwood</strong><small>Student Portal</small></div></Link>
      <nav aria-label="Student dashboard navigation">{navigation.map(([icon, label]) => <button className={activeNav === label ? "active" : ""} key={label} onClick={() => { setActiveNav(label); if (label !== "Dashboard") setNotice(`${label} workspace selected.`); }}><i>{icon}</i><span>{label}</span>{label === "Homework" && <b>3</b>}</button>)}</nav>
      <section className="student-sidebar-help"><span>✧</span><b>AI Study Assistant</b><small>Homework help, MCQs and revision support.</small><button onClick={() => setAiOpen(true)}>Ask AI →</button></section>
      <button className="student-logout" onClick={signOut}>↪ Logout</button>
    </aside>

    <section className="student-workspace">
      <header className="student-topbar"><label className="student-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subjects, homework or notes..." /></label><div className="student-top-actions"><button className="student-ai-top" onClick={() => setAiOpen(true)}>✧ AI Assistant</button><button className="student-bell" onClick={() => setNotice("You have 3 new notifications.")} aria-label="Notifications">♧<i>3</i></button><button className="student-profile"><span>RK</span><div><b>{user?.name || "Student"}</b><small>Class 8-A</small></div></button></div></header>

      <section className="student-content">
        <header className="student-welcome"><div><p>WEDNESDAY, 12 JUNE 2027</p><h1>Good Morning, Rahul <span>👋</span></h1><small>Class 8-A · Roll No. 24 · Class Teacher: <b>Neha Sharma</b></small></div><button onClick={() => setNotice("Your student profile is up to date.")}>♙ View profile</button></header>
        {notice && <div className="student-notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

        {activeNav === "Dashboard" ? <>
        <section className="student-kpis">{kpis.map(([icon, label, value, detail, tone]) => <article className={tone} key={label}><i>{icon}</i><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>)}</section>

        <section className="student-main-grid">
          <article className="student-card attendance-card"><header><div><p>ATTENDANCE OVERVIEW</p><h2>Keep up the great work</h2></div><button onClick={() => setActiveNav("Attendance")}>View details →</button></header><div className="attendance-summary"><div className="student-attendance-ring"><b>92%</b><small>Overall</small></div><ul><li><i className="present" />Present <b>128</b></li><li><i className="absent" />Absent <b>6</b></li><li><i className="leave" />Leave <b>3</b></li><li><i className="late" />Late <b>2</b></li></ul><div className="attendance-trend">{[84, 96, 92, 100, 88, 94, 91].map((value, index) => <span key={index}><i style={{ height: `${value}%` }} /><b>{["M", "T", "W", "T", "F", "S", "S"][index]}</b></span>)}</div></div><div className="subject-attendance"><h3>Subject-wise attendance</h3>{subjects.map(([subject, teacher, count, value, status, tone]) => <div key={subject}><b>{subject}<small>{teacher}</small></b><span>{count}</span><strong>{value}</strong><em className={tone}>{status}</em></div>)}</div></article>
          <article className="student-card classes-card"><header><div><p>TODAY'S CLASSES</p><h2>Wednesday schedule</h2></div><button onClick={() => setActiveNav("Timetable")}>Weekly timetable →</button></header><div className="today-class-list">{classes.map(([time, subject, teacher, room, status]) => <article className={status.toLowerCase()} key={time}><time>{time}</time><i>{subject[0]}</i><div><b>{subject}</b><small>{teacher} · {room}</small></div><em>{status}</em></article>)}</div></article>
        </section>

        <section className="student-mid-grid">
          <article className="student-card performance-card"><header><div><p>PERFORMANCE ANALYTICS</p><h2>Subject-wise progress</h2></div><button onClick={() => setActiveNav("Performance")}>Full report →</button></header><div className="performance-content"><div className="performance-bars">{[["English", 88], ["Mathematics", 72], ["Science", 94], ["Hindi", 81], ["Computer", 91]].map(([subject, score]) => <div key={subject}><span>{subject}</span><i><b style={{ width: `${score}%` }} /></i><strong>{score}%</strong></div>)}</div><aside><span>Overall Average</span><b>86%</b><small>Strongest: Science <i>↑</i></small><small>Improve: Mathematics <em>↓</em></small></aside></div></article>
          <article className="student-card exam-card"><header><div><p>UPCOMING EXAMS</p><h2>Prepare ahead</h2></div><button onClick={() => setActiveNav("Exams & Results")}>View all →</button></header>{[["Unit Test 2", "Mathematics", "18 Jun", "09:00 AM"], ["Weekly Test", "Science", "21 Jun", "10:30 AM"]].map(([name, subject, date, time]) => <article key={name}><i>✦</i><div><b>{name}</b><small>{subject} · Syllabus shared</small></div><span><strong>{date}</strong><small>{time}</small></span></article>)}</article>
        </section>

        <section className="student-bottom-grid">
          <article className="student-card homework-card"><header><div><p>HOMEWORK &amp; ASSIGNMENTS</p><h2>3 tasks pending</h2></div><button onClick={() => setActiveNav("Homework")}>View all →</button></header>{homework.map(([subject, title, due, status]) => <article key={title}><i>{subject[0]}</i><div><b>{title}</b><small>{subject} · Due {due}</small></div><em>{status}</em></article>)}</article>
          <article className="student-card announcements-card"><header><div><p>ANNOUNCEMENTS</p><h2>Latest updates</h2></div><button onClick={() => setActiveNav("Announcements")}>All notices →</button></header>{[["Exam notice", "Unit Test 2 timetable has been published.", "1 hour ago", "orange"], ["School event", "Science exhibition registrations are open.", "Yesterday", "green"], ["Holiday", "School will remain closed on 17 June.", "2 days ago", "blue"]].map(([title, detail, time, tone]) => <article key={title}><i className={tone}>▣</i><div><b>{title}</b><small>{detail}</small></div><time>{time}</time></article>)}</article>
        </section>

        <section className="student-last-grid">
          <article className="student-card materials-card"><header><div><p>RECENT STUDY MATERIAL</p><h2>Continue learning</h2></div><button onClick={() => setActiveNav("Study Material")}>Browse library →</button></header>{[["▣", "Light and Reflection Notes", "Science · PDF"], ["▶", "Linear Equations Explained", "Mathematics · Video"], ["▱", "Reading Comprehension Worksheet", "English · Worksheet"]].map(([icon, title, detail]) => <article key={title}><i>{icon}</i><span><b>{title}</b><small>{detail}</small></span><button onClick={() => setNotice(`${title} opened.`)}>Open →</button></article>)}</article>
          <article className="student-card fee-card"><p>FEE STATUS</p><h2>All fees paid <i>✓</i></h2><span>Next term fee due on <b>10 July 2027</b></span><div><button onClick={() => setNotice("Payment history opened.")}>Payment history</button><button onClick={() => setNotice("Receipt download started.")}>Download receipt</button></div></article>
          <article className="student-card leave-card"><p>LEAVE REQUEST</p><h2>Need a day off?</h2><span>Apply for medical, personal or event leave and track approval status.</span><button onClick={() => setNotice("Leave request form opened.")}>＋ Apply leave</button></article>
        </section>
        </> : <StudentPortalModule section={activeNav} setNotice={setNotice} onAskAI={() => setAiOpen(true)} />}
      </section>
    </section>

    {aiOpen && <section className="student-ai-popup" role="dialog" aria-modal="false" aria-labelledby="student-ai-title"><header><div><i>✧</i><span><b id="student-ai-title">AI Study Assistant</b><small>Online · Ready to help</small></span></div><button onClick={() => setAiOpen(false)} aria-label="Close AI assistant">×</button></header><p>{aiAnswer}</p><div>{["Explain this chapter", "Create 10 MCQs", "Help with homework", "Show weak subjects"].map((prompt) => <button key={prompt} onClick={() => setAiAnswer(`${prompt}: I can help you with that. Tell me the subject or chapter.`)}>{prompt}</button>)}</div><form onSubmit={askAi}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about homework or a subject..." /><button aria-label="Send">→</button></form></section>}
    <button className="student-ai-float" onClick={() => setAiOpen((open) => !open)} aria-expanded={aiOpen}><span>✧</span> Ask Study AI</button>
  </main>;
}
