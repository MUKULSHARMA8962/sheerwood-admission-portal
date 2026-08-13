


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


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/calendar" element={<SchoolCalendar />} />
        <Route path="/virtual-tour" element={<VirtualTour />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new-user-dashboard" element={<NewUserDashboard />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/admission-details" element={<ParentDashboard />} />
        <Route path="/student-information" element={<StudentInformation />} />
        <Route path="/parent-guardian" element={<ParentGuardian />} />
        <Route path="/application/:stage" element={<ApplicationStages />} />
        <Route path="/fee-payment" element={<FeePayment />} />
        <Route path="/application-success" element={<SuccessScreen />} />
        <Route path="/track-application" element={<TrackApplication />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/admin/:screen" element={<AdminPortal />} />
        <Route path="/teacher/dashboard" element={<TeacherPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
