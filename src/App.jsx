


import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ApplicationStages from "./pages/Application_Stages/Application_Stages";
import FeePayment from "./pages/Fee_Payment/Fee_Payment";
import Gallery from "./pages/Gallery/Gallery";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ParentDashboard from "./pages/Parent_Dashboard/Parent_Dashboard";
import ParentGuardian from "./pages/Parent_Guardian/Parent_Guardian";
import StudentInformation from "./pages/Student_Information/Student_Information";
import SuccessScreen from "./pages/Success_Screen/Success_Screen";
import TrackApplication from "./pages/Track_Application/Track_Application";
import AIAssistant from "./pages/AI_Assistant/AI_Assistant";
import AdminPortal from "./pages/Admin_Portal/Admin_Portal";
import TeacherPortal from "./pages/Teacher_Portal/Teacher_Portal";
import NewUserDashboard from "./pages/NewUserDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import SchoolCalendar from "./pages/SchoolCalendar";
import VirtualTour from "./pages/VirtualTour";
import AuthCallback from "./auth/AuthCallback";
import RequireCognitoAuth from "./auth/RequireCognitoAuth";
import "./pages/AdmissionMobile.css";

function Protected({ roles, children }) {
  return <RequireCognitoAuth roles={roles}>{children}</RequireCognitoAuth>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/callback" element={<AuthCallback />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/calendar" element={<SchoolCalendar />} />
        <Route path="/virtual-tour" element={<VirtualTour />} />
        <Route path="/dashboard" element={<Protected roles={["parent"]}><Dashboard /></Protected>} />
        <Route path="/new-user-dashboard" element={<Protected roles={["parent"]}><NewUserDashboard /></Protected>} />
        <Route path="/student/dashboard" element={<Protected roles={["student"]}><StudentDashboard /></Protected>} />
        <Route path="/admission-details" element={<Protected roles={["parent"]}><ParentDashboard /></Protected>} />
        <Route path="/student-information" element={<Protected roles={["parent"]}><StudentInformation /></Protected>} />
        <Route path="/parent-guardian" element={<Protected roles={["parent"]}><ParentGuardian /></Protected>} />
        <Route path="/application/medical" element={<Protected roles={["parent"]}><Navigate to="/application/documents" replace /></Protected>} />
        <Route path="/application/transport" element={<Protected roles={["parent"]}><Navigate to="/application/documents" replace /></Protected>} />
        <Route path="/application/:stage" element={<Protected roles={["parent"]}><ApplicationStages /></Protected>} />
        <Route path="/fee-payment" element={<Protected roles={["parent"]}><FeePayment /></Protected>} />
        <Route path="/application-success" element={<Protected roles={["parent"]}><SuccessScreen /></Protected>} />
        <Route path="/track-application" element={<TrackApplication />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/admin/:screen" element={<Protected roles={["admin"]}><AdminPortal /></Protected>} />
        <Route path="/teacher/dashboard" element={<Protected roles={["teacher"]}><TeacherPortal /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
