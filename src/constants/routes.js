const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  gallery: "/gallery",
  calendar: "/calendar",
  virtualTour: "/virtual-tour",
  dashboard: "/dashboard",
  newUserDashboard: "/new-user-dashboard",
  studentDashboard: "/student/dashboard",
  admissionDetails: "/admission-details",
  studentInformation: "/student-information",
  parentGuardian: "/parent-guardian",
  application: (stage) => `/application/${stage}`,
  applicationDocuments: "/application/documents",
  applicationSuccess: "/application-success",
  consentWithdrawal: "/consent-withdrawal",
  feePayment: "/fee-payment",
  trackApplication: "/track-application",
  aiAssistant: "/ai-assistant",
  admin: (screen = "dashboard") => `/admin/${screen}`,
  teacherDashboard: "/teacher/dashboard",
  vendorDashboard: "/vendor/dashboard",
};

export const API_ROUTES = {
  adminUsers: `${API_BASE_URL}/admin/users-roles`,
  adminStudents: `${API_BASE_URL}/admin/students`,
  adminTeachers: `${API_BASE_URL}/admin/teachers`,
  adminClasses: `${API_BASE_URL}/admin/classes`,
  adminAttendance: `${API_BASE_URL}/admin/attendance`,
  adminDocuments: `${API_BASE_URL}/admin/documents`,
  adminAdmissions: `${API_BASE_URL}/admin/admissions`,
  adminAdmissionFunnel: `${API_BASE_URL}/admin/admission-funnel`,
  adminVendors: `${API_BASE_URL}/admin/vendors`,
  adminSettings: `${API_BASE_URL}/admin/settings`,
  adminSyllabus: `${API_BASE_URL}/admin/syllabus`,
  vendorDashboard: `${API_BASE_URL}/vendor/dashboard`,
  applicationDecision: (applicationId) => `${API_BASE_URL}/applications/${encodeURIComponent(applicationId)}/decision`,
  aiChat: `${API_BASE_URL}/ai/chat`,
  otp: (action) => `${API_BASE_URL}/auth/otp/${action}`,
};

export { API_BASE_URL };
