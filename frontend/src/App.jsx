import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import StudentLogin from './pages/student/Login.jsx';
import StudentDashboard from './pages/student/Dashboard.jsx';
import AdminLogin from './pages/admin/Login.jsx';
import AdminStudents from './pages/admin/Students.jsx';
import AdminStudentDetail from './pages/admin/StudentDetail.jsx';
import AdminSessions from './pages/admin/Sessions.jsx';
import AdminDocumentTypes from './pages/admin/DocumentTypes.jsx';
import AdminFormQuestions from './pages/admin/FormQuestions.jsx';
import AdminNotices from './pages/admin/Notices.jsx';
import AdminAccessRequests from './pages/admin/AccessRequests.jsx';
import AdminStaff from './pages/admin/Staff.jsx';
import AdminSettings from './pages/admin/Settings.jsx';
import StaffLayout from './components/StaffLayout.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/student/login" replace />} />

        {/* Student portal */}
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />

        {/* Staff/admin — login is outside the idle-lock layout */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<StaffLayout />}>
          <Route path="/admin/students" element={<AdminStudents />} />
          <Route path="/admin/students/:id" element={<AdminStudentDetail />} />
          <Route path="/admin/sessions" element={<AdminSessions />} />
          <Route path="/admin/document-types" element={<AdminDocumentTypes />} />
          <Route path="/admin/form-questions" element={<AdminFormQuestions />} />
          <Route path="/admin/notices" element={<AdminNotices />} />
          <Route path="/admin/access-requests" element={<AdminAccessRequests />} />
          <Route path="/admin/staff" element={<AdminStaff />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
