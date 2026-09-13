import { Navigate, Route, Routes } from "react-router-dom";
import AdminPortal from "../pages/Admin_Portal/Admin_Portal";
import AIAssistant from "../pages/AI_Assistant/AI_Assistant";
import ApplicationStages from "../pages/Application_Stages/Application_Stages";
import ConsentWithdrawal from "../pages/ConsentWithdrawal";
import FeePayment from "../pages/Fee_Payment/Fee_Payment";
import Gallery from "../pages/Gallery/Gallery";
import ParentGuardian from "../pages/Parent_Guardian/Parent_Guardian";
import StudentInformation from "../pages/Student_Information/Student_Information";
import SuccessScreen from "../pages/Success_Screen/Success_Screen";
import TeacherPortal from "../pages/Teacher_Portal/Teacher_Portal";
import TrackApplication from "../pages/Track_Application/Track_Application";
import AdmissionDetails from "../pages/AdmissionDetails";
import Dashboard from "../pages/Dashboard";
import Login from "../pages/Login";
import NewUserDashboard from "../pages/NewUserDashboard";
import Register from "../pages/Register";
import SchoolCalendar from "../pages/SchoolCalendar";
import StudentDashboard from "../pages/StudentDashboard";
import VirtualTour from "../pages/VirtualTour";
import { ROUTES } from "../constants/routes";
import { Protected } from "./RouteGuard";
import DirectCognitoEntry from "./DirectCognitoEntry";

const parent = ["parent"];

export default function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<DirectCognitoEntry />} />
      <Route path={ROUTES.login} element={<Login />} />
      <Route path={ROUTES.register} element={<Register />} />
      <Route path={ROUTES.gallery} element={<Gallery />} />
      <Route path={ROUTES.calendar} element={<SchoolCalendar />} />
      <Route path={ROUTES.virtualTour} element={<VirtualTour />} />
      <Route path={ROUTES.trackApplication} element={<TrackApplication />} />
      <Route path={ROUTES.aiAssistant} element={<AIAssistant />} />

      <Route path={ROUTES.dashboard} element={<Protected roles={parent}><Dashboard /></Protected>} />
      <Route path={ROUTES.newUserDashboard} element={<Protected roles={parent}><NewUserDashboard /></Protected>} />
      <Route path={ROUTES.studentInformation} element={<Protected roles={parent}><StudentInformation /></Protected>} />
      <Route path={ROUTES.parentGuardian} element={<Protected roles={parent}><ParentGuardian /></Protected>} />
      <Route path={ROUTES.feePayment} element={<Protected roles={parent}><FeePayment /></Protected>} />
      <Route path={ROUTES.applicationSuccess} element={<Protected roles={parent}><SuccessScreen /></Protected>} />
      <Route path={ROUTES.consentWithdrawal} element={<Protected roles={parent}><ConsentWithdrawal /></Protected>} />
      <Route path={ROUTES.application("medical")} element={<Protected roles={parent}><Navigate to={ROUTES.applicationDocuments} replace /></Protected>} />
      <Route path={ROUTES.application("transport")} element={<Protected roles={parent}><Navigate to={ROUTES.applicationDocuments} replace /></Protected>} />
      <Route path={ROUTES.applicationDocuments} element={<Protected roles={parent}><ApplicationStages /></Protected>} />

      <Route path={ROUTES.studentDashboard} element={<Protected roles={["student"]}><StudentDashboard /></Protected>} />
      <Route path={ROUTES.admissionDetails} element={<Protected roles={parent}><AdmissionDetails /></Protected>} />
      <Route path="/admin" element={<Protected roles={["admin"]}><Navigate to={ROUTES.admin()} replace /></Protected>} />
      <Route path="/admin/:screen" element={<Protected roles={["admin"]}><AdminPortal /></Protected>} />
      <Route path={ROUTES.teacherDashboard} element={<Protected roles={["teacher"]}><TeacherPortal /></Protected>} />
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}
