import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminAdmissionFunnel, getAdminAdmissions, getAdminAttendance, getAdminClasses, getAdminStudents, getAdminTeachers } from "../../services/api";
import { useCognitoAuth } from "../../auth/useCognitoAuth";
import "./AdminDashboard.css";

const chartColors = ["#08783f", "#4ba86c", "#f0ad41", "#4c89b4", "#d35d55", "#9d70b3"];

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalizedStatus(value) {
  const status = String(value || "pending").toLowerCase();
  return status === "submitted" || status === "uploaded" ? "pending" : status;
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function shortName(value, fallback = "Not set") {
  const words = String(value || fallback).trim().split(/\s+/);
  return words.length > 1 ? `${words[0]} ${words[1][0]}.` : words[0];
}

function dateLabel(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date);
}

function grouped(items, key, fallback = "Not recorded") {
  return items.reduce((result, item) => {
    const name = String(key(item) || fallback).trim() || fallback;
    result[name] = (result[name] || 0) + 1;
    return result;
  }, {});
}

function entries(counts, limit = 6) {
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value: number(value) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function Metric({ label, value, note }) {
  return <div className="admin-dashboard-metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function DashboardCard({ icon, title, description, metrics, action, onClick }) {
  return <article className="admin-dashboard-module-card">
    <header><span aria-hidden="true">{icon}</span><div><p>{title}</p><small>{description}</small></div></header>
    <div className="admin-dashboard-card-metrics">{metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</div>
    <button type="button" onClick={onClick}>{action} <span>→</span></button>
  </article>;
}

function AdmissionFunnelTracker({ funnel, onClick }) {
  const oldestSubmissionLabel = funnel.oldest_submission_days === 1 ? "1 day" : `${funnel.oldest_submission_days || 0} days`;
  return <section className="admin-admission-funnel">
    <header><div><p>LIVE ADMISSION TRACKER</p><h2>Follow-up funnel</h2><small>Track each parent from login through application submission.</small></div><span><i /> Live</span></header>
    <div>
      <Metric label="Submitted / in review" value={funnel.submitted} note={`Oldest submission: ${oldestSubmissionLabel}`} />
      <Metric label="Pending documents" value={funnel.pending_documents} note="Missing one or more required uploads" />
      <Metric label="Pending registration fee" value={funnel.pending_registration_fee} note="Documents complete; fee not recorded" />
      <Metric label="Login only" value={funnel.login_only} note="Parent account with no application" />
    </div>
    <button type="button" onClick={onClick}>Open admission dashboard <span>→</span></button>
  </section>;
}

function AnalyticsCard({ eyebrow, title, children }) {
  return <article className="admin-dashboard-chart-card"><header><p>{eyebrow}</p><h3>{title}</h3></header>{children}</article>;
}

function EmptyChart({ message = "No records available yet." }) {
  return <div className="admin-dashboard-empty-chart"><span>○</span><p>{message}</p></div>;
}

function LineChart({ data }) {
  if (!data.some((item) => item.value)) return <EmptyChart message="No applications have been received in this period." />;
  const max = Math.max(...data.map((item) => item.value), 1);
  const width = 640;
  const left = 20;
  const usableWidth = width - left * 2;
  const points = data.map((item, index) => {
    const x = left + index * (usableWidth / Math.max(data.length - 1, 1));
    const y = 90 - (item.value / max) * 65;
    return `${x},${y}`;
  }).join(" ");
  return <div className="admin-dashboard-line-chart">
    <svg viewBox={`0 0 ${width} 110`} role="img" aria-label="Applications by month line chart"><path d="M20 90H620" /><polyline points={points} />{points.split(" ").map((point) => <circle key={point} cx={point.split(",")[0]} cy={point.split(",")[1]} r="4" />)}</svg>
    <div>{data.map((item) => <span key={item.label}><b>{item.value}</b>{item.label}</span>)}</div>
  </div>;
}

function BarChart({ data, emptyMessage }) {
  if (!data.length) return <EmptyChart message={emptyMessage} />;
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="admin-dashboard-bar-chart">{data.map((item, index) => <div key={item.label}><b>{item.value}</b><i style={{ height: `${Math.max(9, Math.round((item.value / max) * 100))}%`, background: `linear-gradient(#8cd5a5, ${chartColors[index % chartColors.length]})` }} /><span title={item.label}>{item.label}</span></div>)}</div>;
}

function DonutChart({ segments, emptyMessage }) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) return <EmptyChart message={emptyMessage} />;
  let progress = 0;
  const gradient = visible.map((segment, index) => {
    const start = progress;
    progress += (segment.value / total) * 100;
    return `${segment.color || chartColors[index % chartColors.length]} ${start}% ${progress}%`;
  }).join(", ");
  return <div className="admin-dashboard-donut-wrap"><div className="admin-dashboard-donut" style={{ background: `conic-gradient(${gradient})` }}><div><strong>{total}</strong><small>Total</small></div></div><ul>{visible.map((segment, index) => <li key={segment.label}><i style={{ background: segment.color || chartColors[index % chartColors.length] }} /><span>{segment.label}</span><b>{segment.value}</b></li>)}</ul></div>;
}

function titleFor(view) {
  return view === "teachers" ? "Teacher Analytics" : view === "students" ? "Student Analytics" : "Operational Analytics";
}

export default function AdminDashboard({ onNavigate, view = "overview" }) {
  const { session } = useCognitoAuth();
  const [data, setData] = useState({ admissions: [], funnel: {}, teachers: [], students: [], classes: [], attendance: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [admissions, funnel, teachers, students, classes, attendance] = await Promise.all([
        getAdminAdmissions(session.accessToken),
        getAdminAdmissionFunnel(session.accessToken),
        getAdminTeachers(session.accessToken),
        getAdminStudents(session.accessToken),
        getAdminClasses(session.accessToken),
        getAdminAttendance(session.accessToken),
      ]);
      setData({ admissions: list(admissions), funnel: funnel && typeof funnel === "object" ? funnel : {}, teachers: list(teachers), students: list(students), classes: list(classes), attendance: attendance && typeof attendance === "object" ? attendance : {} });
    } catch (reason) {
      setError(reason.message || "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const analytics = useMemo(() => {
    const admissions = data.admissions;
    const funnel = data.funnel || {};
    const teachers = data.teachers;
    const students = data.students;
    const classes = data.classes;
    const attendance = data.attendance?.summary || {};
    const applicationStatuses = grouped(admissions, (application) => normalizedStatus(application.status));
    const documentStatuses = grouped(admissions, (application) => normalizedStatus(application.documents_status));
    const submitted = admissions.filter((application) => ["pending", "needs_information", "reupload_required"].includes(normalizedStatus(application.status)));
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      return { label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date), key: `${date.getFullYear()}-${date.getMonth()}`, value: 0 };
    });
    admissions.forEach((application) => {
      const date = new Date(application.submitted_on || application.created_at || "");
      if (Number.isNaN(date.getTime())) return;
      const month = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
      if (month) month.value += 1;
    });
    const genderValues = students.map((student) => student.gender).filter(Boolean);
    const applicationGenderValues = admissions.map((application) => application.form_data?.student?.gender).filter(Boolean);
    const genderSource = genderValues.length ? genderValues : applicationGenderValues;
    const teacherSubjectCounts = grouped(teachers.filter((teacher) => teacher.subject), (teacher) => teacher.subject);
    const teacherStatuses = grouped(teachers, (teacher) => String(teacher.status || teacher.employment_status || "active").replaceAll("_", " "));
    const teacherAllocation = [
      { label: "Class teacher", value: teachers.filter((teacher) => teacher.class_teacher).length, color: "#08783f" },
      { label: "Not allocated", value: teachers.filter((teacher) => !teacher.class_teacher).length, color: "#d9e6dd" },
    ];
    const recentApplications = [...admissions].sort((a, b) => new Date(b.submitted_on || 0) - new Date(a.submitted_on || 0)).slice(0, 4);
    const recentlyVerified = admissions.flatMap((application) => list(application.documents).filter((document) => normalizedStatus(document.status) === "verified").map((document) => ({ application, document }))).slice(0, 2);
    return {
      admissions, funnel: {
        submitted: number(funnel.submitted),
        oldest_submission_days: number(funnel.oldest_submission_days),
        pending_documents: number(funnel.pending_documents),
        pending_registration_fee: number(funnel.pending_registration_fee),
        login_only: number(funnel.login_only),
      }, teachers, students, classes, attendance,
      totalApplications: admissions.length,
      pendingApplications: submitted.length,
      underVerification: documentStatuses.under_verification || 0,
      documentsVerified: documentStatuses.documents_verified || 0,
      approved: applicationStatuses.approved || 0,
      rejected: applicationStatuses.rejected || 0,
      activeTeachers: teachers.filter((teacher) => normalizedStatus(teacher.status || teacher.employment_status || "active") === "active").length,
      onLeave: teachers.filter((teacher) => normalizedStatus(teacher.status || teacher.employment_status) === "on_leave").length,
      classAssignments: teachers.filter((teacher) => teacher.class_teacher).length,
      subjectAssignments: teachers.filter((teacher) => teacher.subject).length,
      present: number(attendance.present), absent: number(attendance.absent),
      totalSections: classes.reduce((total, classItem) => total + list(classItem.sections).length, 0),
      months,
      applicationsByClass: entries(grouped(admissions, (application) => application.desired_class || application.form_data?.admissionDetails?.class)),
      admissionSegments: [
        { label: "Approved", value: applicationStatuses.approved || 0, color: "#08783f" },
        { label: "Pending", value: applicationStatuses.pending || 0, color: "#f0ad41" },
        { label: "Needs info", value: applicationStatuses.needs_information || 0, color: "#4c89b4" },
        { label: "Rejected", value: applicationStatuses.rejected || 0, color: "#d35d55" },
      ],
      documentSegments: [
        { label: "Verified", value: documentStatuses.documents_verified || 0, color: "#08783f" },
        { label: "Under review", value: documentStatuses.under_verification || 0, color: "#4c89b4" },
        { label: "Pending", value: documentStatuses.pending || 0, color: "#f0ad41" },
        { label: "Action needed", value: (documentStatuses.reupload_required || 0) + (documentStatuses.rejected || 0), color: "#d35d55" },
      ],
      studentsByClass: entries(grouped(students, (student) => student.class_section)),
      attendanceSegments: [
        { label: "Present", value: number(attendance.present), color: "#08783f" },
        { label: "Late", value: number(attendance.late), color: "#f0ad41" },
        { label: "Absent", value: number(attendance.absent), color: "#d35d55" },
      ],
      genderSegments: [
        { label: "Boys", value: genderSource.filter((value) => String(value).toLowerCase() === "male").length, color: "#4c89b4" },
        { label: "Girls", value: genderSource.filter((value) => String(value).toLowerCase() === "female").length, color: "#d35d55" },
        { label: "Other", value: genderSource.filter((value) => !["male", "female"].includes(String(value).toLowerCase())).length, color: "#9d70b3" },
      ],
      teacherBySubject: entries(teacherSubjectCounts),
      teacherAttendance: teachers.filter((teacher) => Number.isFinite(Number(teacher.attendance))).map((teacher) => ({ label: shortName(teacher.name || teacher.full_name), value: number(teacher.attendance) })),
      teacherLeaveSegments: [
        { label: "Active", value: teacherStatuses.active || 0, color: "#08783f" },
        { label: "On leave", value: teacherStatuses["on leave"] || 0, color: "#f0ad41" },
        { label: "Other", value: Object.entries(teacherStatuses).filter(([key]) => !["active", "on leave"].includes(key)).reduce((sum, [, value]) => sum + value, 0), color: "#d35d55" },
      ],
      teacherAllocation,
      recentApplications,
      recentlyVerified,
    };
  }, [data]);

  const admissionCharts = <section className="admin-dashboard-chart-grid">
    <AnalyticsCard eyebrow="ADMISSIONS" title="Applications by Month"><LineChart data={analytics.months} /></AnalyticsCard>
    <AnalyticsCard eyebrow="ADMISSIONS" title="Admission Status"><DonutChart segments={analytics.admissionSegments} emptyMessage="No admission status data yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="ADMISSIONS" title="Applications by Class"><BarChart data={analytics.applicationsByClass} emptyMessage="No class choices have been saved yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="DOCUMENTS" title="Document Verification Status"><DonutChart segments={analytics.documentSegments} emptyMessage="No document verification data yet." /></AnalyticsCard>
  </section>;
  const studentCharts = <section className="admin-dashboard-chart-grid">
    <AnalyticsCard eyebrow="STUDENTS" title="Students by Class"><BarChart data={analytics.studentsByClass} emptyMessage="No enrolled students have been added yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="ATTENDANCE" title="Student Attendance"><DonutChart segments={analytics.attendanceSegments} emptyMessage="No attendance has been recorded yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="STUDENTS" title="Boys / Girls Distribution"><DonutChart segments={analytics.genderSegments} emptyMessage="Gender data is not recorded yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="ACADEMICS" title="Academic Performance"><EmptyChart message="No academic performance records have been published yet." /></AnalyticsCard>
  </section>;
  const teacherCharts = <section className="admin-dashboard-chart-grid">
    <AnalyticsCard eyebrow="TEACHERS" title="Teachers by Department / Subject"><BarChart data={analytics.teacherBySubject} emptyMessage="No teacher subject assignments are saved yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="TEACHERS" title="Teacher Attendance"><BarChart data={analytics.teacherAttendance} emptyMessage="No teacher attendance records are saved yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="TEACHERS" title="Class Allocation"><DonutChart segments={analytics.teacherAllocation} emptyMessage="No teacher records are available yet." /></AnalyticsCard>
    <AnalyticsCard eyebrow="TEACHERS" title="Teacher Leave"><DonutChart segments={analytics.teacherLeaveSegments} emptyMessage="No teacher leave status is available yet." /></AnalyticsCard>
  </section>;

  if (loading) return <section className="admin-dashboard-loading">Loading live dashboard data…</section>;
  if (error) return <section className="admin-dashboard-error" role="alert"><p>{error}</p><button type="button" onClick={loadDashboard}>Try again</button></section>;

  const isFocused = view !== "overview";
  const focusedConfig = view === "teachers"
    ? { icon: "👨‍🏫", title: "Teacher Dashboard", text: "Live staffing, allocation and attendance overview.", metrics: [{ label: "Total Teachers", value: analytics.teachers.length }, { label: "Active", value: analytics.activeTeachers }, { label: "On Leave", value: analytics.onLeave }, { label: "Classes Assigned", value: analytics.classAssignments }, { label: "Subjects Assigned", value: analytics.subjectAssignments }], charts: teacherCharts }
    : { icon: "🎓", title: "Student Dashboard", text: "Live enrollment, class and attendance overview.", metrics: [{ label: "Total Students", value: analytics.students.length }, { label: "Present Today", value: analytics.present }, { label: "Absent Today", value: analytics.absent }, { label: "Classes", value: analytics.classes.length }, { label: "Sections", value: analytics.totalSections }], charts: studentCharts };

  return <section className="admin-dashboard">
    <div className="admin-dashboard-toolbar"><div><p>{isFocused ? "MODULE OVERVIEW" : "LIVE SCHOOL OVERVIEW"}</p><h2>{titleFor(view)}</h2><small>Updated from the current admin records.</small></div><button type="button" onClick={loadDashboard}>↻ Refresh data</button></div>
    {isFocused ? <>
      <section className="admin-dashboard-focus-card"><span>{focusedConfig.icon}</span><div><p>{focusedConfig.title.toUpperCase()}</p><h3>{focusedConfig.title}</h3><small>{focusedConfig.text}</small></div><div>{focusedConfig.metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</div></section>
      {focusedConfig.charts}
    </> : <>
      <AdmissionFunnelTracker funnel={analytics.funnel} onClick={() => onNavigate("admissions")} />
      <section className="admin-dashboard-module-grid">
        <DashboardCard icon="📝" title="New Admissions" description="Application, document and approval progress" metrics={[{ label: "Total Applications", value: analytics.totalApplications }, { label: "Pending", value: analytics.pendingApplications }, { label: "Under Verification", value: analytics.underVerification }, { label: "Documents Verified", value: analytics.documentsVerified }, { label: "Approved", value: analytics.approved }, { label: "Rejected", value: analytics.rejected }]} action="View New Admission Dashboard" onClick={() => onNavigate("admissions")} />
        <DashboardCard icon="👨‍🏫" title="Teachers" description="Staff availability and academic allocation" metrics={[{ label: "Total Teachers", value: analytics.teachers.length }, { label: "Active Teachers", value: analytics.activeTeachers }, { label: "On Leave", value: analytics.onLeave }, { label: "Classes Assigned", value: analytics.classAssignments }, { label: "Subjects Assigned", value: analytics.subjectAssignments }]} action="View Teacher Dashboard" onClick={() => onNavigate("teachers")} />
        <DashboardCard icon="🎓" title="Students" description="Enrollment, attendance and class distribution" metrics={[{ label: "Total Students", value: analytics.students.length }, { label: "Present Today", value: analytics.present }, { label: "Absent Today", value: analytics.absent }, { label: "Classes", value: analytics.classes.length }, { label: "Sections", value: analytics.totalSections }]} action="View Student Dashboard" onClick={() => onNavigate("students")} />
      </section>
      <section className="admin-dashboard-section"><header><p>ADMISSION ANALYTICS</p><h2>Admissions at a glance</h2></header>{admissionCharts}</section>
      <section className="admin-dashboard-section"><header><p>STUDENT ANALYTICS</p><h2>Students at a glance</h2></header>{studentCharts}</section>
      <section className="admin-dashboard-section"><header><p>TEACHER ANALYTICS</p><h2>Teachers at a glance</h2></header>{teacherCharts}</section>
      <section className="admin-dashboard-activity"><header><div><p>RECENT ACTIVITY</p><h2>Latest updates</h2></div><span>Live admission records</span></header><div>{[...analytics.recentApplications.map((application) => ({ icon: "📝", title: "New admission", text: `${application.student_name || "Application in progress"} · ${application.desired_class || "Class not selected"}`, date: dateLabel(application.submitted_on) })), ...analytics.recentlyVerified.map(({ application, document }) => ({ icon: "✓", title: "Document verified", text: `${document.document_key?.replaceAll("-", " ") || "Document"} · ${application.student_name || "Applicant"}`, date: dateLabel(document.updated_at) }))].slice(0, 6).map((activity, index) => <article key={`${activity.title}-${activity.text}-${index}`}><i>{activity.icon}</i><div><b>{activity.title}</b><span>{activity.text}</span></div><time>{activity.date}</time></article>)}</div>{!analytics.recentApplications.length && !analytics.recentlyVerified.length && <p className="admin-dashboard-no-activity">No recent admission activity yet.</p>}</section>
    </>}
  </section>;
}
