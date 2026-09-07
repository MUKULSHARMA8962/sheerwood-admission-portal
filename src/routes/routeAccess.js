import { ROUTES } from "../constants/routes";

const parentOnlyPaths = new Set([
  ROUTES.dashboard,
  ROUTES.newUserDashboard,
  ROUTES.studentInformation,
  ROUTES.parentGuardian,
  ROUTES.feePayment,
  ROUTES.applicationSuccess,
]);

export function canRoleOpenPath(role, path) {
  if (!path || path === ROUTES.home) return false;
  if (path.startsWith("/admin/")) return role === "admin";
  if (path.startsWith("/teacher/")) return role === "teacher";
  if (path.startsWith("/student/")) return role === "student";
  if (path.startsWith("/application/") || parentOnlyPaths.has(path)) return role === "parent";
  if (path === ROUTES.admissionDetails) return role === "parent" || role === "admission";
  return true;
}
