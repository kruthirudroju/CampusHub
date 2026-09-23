import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import InstitutionSelect from './pages/InstitutionSelect';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<InstitutionSelect />} />
        <Route path="/login/:slug" element={<Login />} />
        <Route path="/student" element={
          <ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/faculty" element={
          <ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
