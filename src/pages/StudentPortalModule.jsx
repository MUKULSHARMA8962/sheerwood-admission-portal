import { useState } from "react";
import "./StudentPortalModule.css";

const subjectCards = [["English", "Neha Sharma", "93%", "A", "1"], ["Mathematics", "Amit Verma", "78%", "B+", "2"], ["Science", "Rahul Mehta", "98%", "A+", "0"], ["Hindi", "Priya Kapoor", "69%", "B", "1"], ["Computer", "Arjun Singh", "96%", "A", "0"], ["Social Science", "Kavita Rao", "89%", "A", "1"]];
const materials = [["▣", "Light and Reflection Notes", "Science · PDF · 2.4 MB"], ["▶", "Linear Equations Explained", "Mathematics · Video · 12 min"], ["▱", "Reading Comprehension Worksheet", "English · Worksheet"], ["▣", "Climate Revision Pack", "Social Science · PDF"], ["▶", "HTML Basics", "Computer · Video · 16 min"]];
const pageCopy = { Attendance: ["ATTENDANCE", "Attendance overview", "Your attendance is tracked school-wide and subject-wise."], "My Subjects": ["ACADEMICS", "My subjects", "Explore notes, assignments, attendance and performance for every subject."], Timetable: ["CLASS SCHEDULE", "Weekly timetable", "Class 8-A · Room and teacher information for the current week."], Homework: ["HOMEWORK", "Homework & assignments", "Keep track of assignments, due dates and submissions."], "Exams & Results": ["ASSESSMENT", "Exams & results", "Upcoming tests, published marks and performance records."], Performance: ["PERFORMANCE", "Performance analytics", "Subject-wise progress and improvement areas."], "Study Material": ["LEARNING LIBRARY", "Study material", "Notes, PDFs, videos, worksheets and revision resources."], Announcements: ["SCHOOL UPDATES", "Announcements", "Important notices from the school and your teachers."], Fees: ["FEE MANAGEMENT", "Fees & receipts", "Payment status, due dates and downloadable receipts."], "Leave Request": ["LEAVE MANAGEMENT", "Leave request", "Apply for leave and track the school's decision."], "AI Assistant": ["STUDY SUPPORT", "AI Study Assistant", "Get chapter explanations, MCQs and homework guidance."], "My Profile": ["STUDENT PROFILE", "My profile", "Your personal, school and parent-contact information."] };

function ModuleHeader({ section, action }) {
  const [eyebrow, title, text] = pageCopy[section];
  return <header className="student-module-heading"><div><p>{eyebrow}</p><h1>{title}</h1><small>{text}</small></div>{action}</header>;
}

function AttendancePage() {
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  return <><ModuleHeader section="Attendance" action={<button className="student-module-button">⇩ Download report</button>} /><section className="student-module-grid attendance-page-grid"><article className="student-card student-module-card"><header><div><p>JUNE 2027</p><h2>Monthly attendance calendar</h2></div><span className="attendance-total">92% Overall</span></header><div className="calendar-legend"><span><i className="present" /> Present</span><span><i className="absent" /> Absent</span><span><i className="leave" /> Leave</span><span><i className="late" /> Late</span></div><div className="attendance-calendar">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <b key={day}>{day}</b>)}{days.map((day) => <i className={day === 7 || day === 19 ? "absent" : day === 14 ? "leave" : day === 23 ? "late" : "present"} key={day}>{day}</i>)}</div></article><article className="student-card attendance-side-card"><p>ATTENDANCE SUMMARY</p><div><strong>139</strong><span>Total school days</span></div><ul><li><i className="present" />Present <b>128</b></li><li><i className="absent" />Absent <b>6</b></li><li><i className="leave" />Leave <b>3</b></li><li><i className="late" />Late <b>2</b></li></ul></article></section><section className="student-card student-module-card module-table-card"><header><div><p>SUBJECT-WISE ATTENDANCE</p><h2>Attendance by subject</h2></div></header><div className="student-module-table"><div className="table-head"><span>Subject</span><span>Teacher</span><span>Present / Total</span><span>Attendance</span><span>Status</span></div>{[["English", "Neha Ma'am", "42 / 45", "93%", "Good", "green"], ["Mathematics", "Amit Sir", "35 / 45", "78%", "Watch", "yellow"], ["Science", "Rahul Sir", "44 / 45", "98%", "Excellent", "green"], ["Hindi", "Priya Ma'am", "31 / 45", "69%", "Low", "red"]].map(([subject, teacher, count, score, status, tone]) => <div key={subject}><b>{subject}</b><span>{teacher}</span><span>{count}</span><strong>{score}</strong><em className={tone}>{status}</em></div>)}</div><div className="low-attendance-alert"><i>!</i><span><b>Low Attendance Alert</b><small>Hindi attendance is below 75%. Please attend upcoming classes regularly.</small></span></div></section></>;
}

function SubjectsPage({ setNotice }) {
  return <><ModuleHeader section="My Subjects" action={<button className="student-module-button">⌕ Search subjects</button>} /><section className="student-subject-grid">{subjectCards.map(([subject, teacher, attendance, grade, pending]) => <article className="student-card" key={subject}><i>{subject[0]}</i><p>{subject.toUpperCase()}</p><h2>{subject}</h2><span>{teacher}</span><div><b>{attendance}<small>Attendance</small></b><b>{grade}<small>Grade</small></b><b>{pending}<small>Pending</small></b></div><button onClick={() => setNotice(`${subject} subject workspace opened.`)}>View subject →</button></article>)}</section></>;
}

function TimetablePage() {
  const periods = [["09:00", "English", "Neha Sharma", "204"], ["10:00", "Mathematics", "Amit Verma", "107"], ["11:00", "Science", "Rahul Mehta", "Lab 02"], ["12:00", "Computer", "Arjun Singh", "Lab 01"], ["01:30", "Social Science", "Kavita Rao", "302"]];
  return <><ModuleHeader section="Timetable" action={<button className="student-module-button">⇩ Download timetable</button>} /><section className="student-card student-module-card timetable-module"><header><div><p>WEEKLY SCHEDULE</p><h2>Wednesday · Class 8-A</h2></div><span>5 classes today</span></header>{periods.map(([time, subject, teacher, room], index) => <article className={index === 1 ? "now" : ""} key={time}><time>{time}</time><i>{subject[0]}</i><div><b>{subject}</b><small>{teacher} · Room {room}</small></div><em>{index === 1 ? "Now" : index < 1 ? "Completed" : "Upcoming"}</em></article>)}</section></>;
}

function HomeworkPage({ setNotice }) {
  const [filter, setFilter] = useState("All");
  const work = [["Mathematics", "Algebra practice worksheet", "Today, 6:00 PM", "Pending"], ["Science", "Complete cell structure diagram", "Tomorrow, 9:00 AM", "Pending"], ["English", "Read Chapter 8 and write summary", "14 Jun", "Pending"], ["Computer", "HTML tags practice", "10 Jun", "Submitted"]];
  const visible = filter === "All" ? work : work.filter((item) => item[3] === filter);
  return <><ModuleHeader section="Homework" action={<button className="student-module-button" onClick={() => setNotice("Homework planner opened.")}>＋ Add to planner</button>} /><section className="student-card student-module-card homework-module"><header><div><p>ASSIGNMENTS</p><h2>Manage homework</h2></div><div className="module-tabs">{["All", "Pending", "Submitted"].map((tab) => <button className={filter === tab ? "active" : ""} key={tab} onClick={() => setFilter(tab)}>{tab}</button>)}</div></header>{visible.map(([subject, title, due, status]) => <article key={title}><i>{subject[0]}</i><div><b>{title}</b><small>{subject} · Due {due} · Attachment available</small></div><em className={status.toLowerCase()}>{status}</em><button onClick={() => setNotice(`${title} opened.`)}>{status === "Pending" ? "Start →" : "View →"}</button></article>)}</section></>;
}

function ExamsPage() {
  return <><ModuleHeader section="Exams & Results" action={<button className="student-module-button">⇩ Download result card</button>} /><section className="student-module-grid exam-module-grid"><article className="student-card student-module-card"><header><div><p>UPCOMING EXAMS</p><h2>Prepare ahead</h2></div></header>{[["Unit Test 2", "Mathematics", "18 Jun · 09:00 AM"], ["Weekly Test", "Science", "21 Jun · 10:30 AM"]].map(([exam, subject, time]) => <article className="exam-module-row" key={exam}><i>✦</i><div><b>{exam}</b><small>{subject} · Syllabus shared</small></div><span>{time}</span></article>)}</article><article className="student-card student-module-card"><header><div><p>LATEST RESULTS</p><h2>Unit Test 1</h2></div></header><div className="result-score"><strong>86%</strong><span>Overall percentage</span><b>Grade A</b></div><ul className="result-list"><li>Science <b>94 / 100</b></li><li>English <b>88 / 100</b></li><li>Mathematics <b>72 / 100</b></li></ul></article></section></>;
}

function PerformancePage() {
  return <><ModuleHeader section="Performance" action={<button className="student-module-button">⇩ Download progress report</button>} /><section className="student-card student-module-card performance-module"><header><div><p>SUBJECT-WISE PERFORMANCE</p><h2>Current term progress</h2></div><span>Average 86%</span></header>{[["English", 88], ["Mathematics", 72], ["Science", 94], ["Hindi", 81], ["Computer", 91], ["Social Science", 86]].map(([subject, score]) => <div key={subject}><b>{subject}</b><i><span style={{ width: `${score}%` }} /></i><strong>{score}%</strong></div>)}<footer><span>Strongest subject <b>Science · 94%</b></span><span>Needs improvement <b>Mathematics · 72%</b></span></footer></section></>;
}

function MaterialPage({ setNotice }) {
  return <><ModuleHeader section="Study Material" action={<button className="student-module-button">⌕ Search library</button>} /><section className="student-card student-module-card material-module"><header><div><p>LEARNING LIBRARY</p><h2>Recent material</h2></div><div className="module-tabs"><button className="active">All</button><button>Notes</button><button>Videos</button><button>Worksheets</button></div></header>{materials.map(([icon, title, detail]) => <article key={title}><i>{icon}</i><div><b>{title}</b><small>{detail}</small></div><button onClick={() => setNotice(`${title} opened.`)}>Open →</button></article>)}</section></>;
}

function AnnouncementsPage() {
  return <><ModuleHeader section="Announcements" action={<button className="student-module-button">Mark all read</button>} /><section className="student-card student-module-card announcement-module">{[["Exam Notice", "Unit Test 2 timetable has been published. Please review the syllabus and reporting time.", "1 hour ago", "orange"], ["School Event", "Science exhibition registrations are open until 15 June.", "Yesterday", "green"], ["Holiday", "School will remain closed on 17 June for a public holiday.", "2 days ago", "blue"], ["Teacher Notice", "English reading assignment has been added to your homework.", "3 days ago", "purple"]].map(([title, text, time, tone]) => <article key={title}><i className={tone}>▣</i><div><b>{title}</b><small>{text}</small><span>{time}</span></div><button>View →</button></article>)}</section></>;
}

function FeesPage({ setNotice }) {
  return <><ModuleHeader section="Fees" action={<button className="student-module-button" onClick={() => setNotice("Payment history opened.")}>Payment history</button>} /><section className="student-module-grid fee-module-grid"><article className="student-card fee-overview"><p>TERM FEE</p><strong>₹ 32,500</strong><span>Paid in full · Receipt #SIS-2027-8821</span><i>✓</i></article><article className="student-card fee-overview"><p>NEXT DUE DATE</p><strong>10 July</strong><span>Term 2 fee · ₹ 32,500</span><button onClick={() => setNotice("Payment page opened.")}>Pay now →</button></article><article className="student-card fee-overview"><p>RECEIPTS</p><strong>3</strong><span>Download all payment receipts</span><button onClick={() => setNotice("Receipt download started.")}>Download →</button></article></section></>;
}

function LeavePage({ setNotice }) {
  const [submitted, setSubmitted] = useState(false);
  return <><ModuleHeader section="Leave Request" action={null} /><section className="student-module-grid leave-module-grid"><form className="student-card leave-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); setNotice("Leave request submitted for teacher approval."); }}><h2>Apply for leave</h2><label>Leave type<select defaultValue="Medical leave"><option>Medical leave</option><option>Personal leave</option><option>School event</option></select></label><div><label>From date<input type="date" required /></label><label>To date<input type="date" required /></label></div><label>Reason<textarea placeholder="Tell your class teacher why you need leave..." required /></label><label>Attachment<input type="file" /></label><button type="submit">Submit leave request →</button></form><article className="student-card leave-history"><p>RECENT REQUESTS</p><h2>Leave history</h2>{[["Medical leave", "10 Jun · 1 day", "Approved", "green"], ["Personal leave", "24 May · 2 days", "Approved", "green"], ["School event", "03 May · 1 day", "Rejected", "red"]].map(([type, dates, status, tone]) => <div key={dates}><span><b>{type}</b><small>{dates}</small></span><em className={tone}>{status}</em></div>)}{submitted && <small className="leave-success">Your newest request is pending approval.</small>}</article></section></>;
}

function AiPage({ onAskAI }) { return <><ModuleHeader section="AI Assistant" action={null} /><section className="student-card ai-module"><i>✧</i><h2>Your personal study partner</h2><p>Ask for a chapter explanation, create revision MCQs, get homework help or identify your weak subjects.</p><div>{["Explain photosynthesis", "Create 10 maths MCQs", "Help with English homework", "Show my weak subjects"].map((prompt) => <button key={prompt} onClick={onAskAI}>{prompt}</button>)}</div><button onClick={onAskAI}>Open AI Study Assistant →</button></section></>;
}

function ProfilePage() { return <><ModuleHeader section="My Profile" action={<button className="student-module-button">Edit profile</button>} /><section className="student-module-grid profile-module-grid"><article className="student-card profile-summary"><i>RK</i><h2>Rahul Kumar</h2><span>Class 8-A · Roll No. 24</span><small>Student ID · SIS-8A-024</small></article><article className="student-card profile-details"><h2>School information</h2><div><span>Class teacher</span><b>Neha Sharma</b></div><div><span>House</span><b>Green House</b></div><div><span>Academic session</span><b>2027–28</b></div><div><span>Parent contact</span><b>+91 98765 43210</b></div></article></section></>;
}

export default function StudentPortalModule({ section, setNotice, onAskAI }) {
  if (section === "Attendance") return <AttendancePage />;
  if (section === "My Subjects") return <SubjectsPage setNotice={setNotice} />;
  if (section === "Timetable") return <TimetablePage />;
  if (section === "Homework") return <HomeworkPage setNotice={setNotice} />;
  if (section === "Exams & Results") return <ExamsPage />;
  if (section === "Performance") return <PerformancePage />;
  if (section === "Study Material") return <MaterialPage setNotice={setNotice} />;
  if (section === "Announcements") return <AnnouncementsPage />;
  if (section === "Fees") return <FeesPage setNotice={setNotice} />;
  if (section === "Leave Request") return <LeavePage setNotice={setNotice} />;
  if (section === "AI Assistant") return <AiPage onAskAI={onAskAI} />;
  return <ProfilePage />;
}
