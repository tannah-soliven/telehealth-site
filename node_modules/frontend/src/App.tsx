import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getToken, getUser } from "@/lib/auth";
import LoginPage from "@/pages/auth/Login";
import RegisterPage from "@/pages/auth/Register";
import DoctorAppointmentsPage from "@/pages/doctor/DoctorAppointments";
import DoctorDashboardHome from "@/pages/doctor/DoctorDashboardHome";
import DoctorProfilePage from "@/pages/doctor/DoctorProfile";
import DoctorSchedulePage from "@/pages/doctor/DoctorSchedule";
import DoctorDetailPage from "@/pages/patient/DoctorDetail";
import FindDoctorsPage from "@/pages/patient/FindDoctors";
import PatientAppointmentsPage from "@/pages/patient/PatientAppointments";
import PatientDashboardHome from "@/pages/patient/PatientDashboardHome";
import MedicalRecordsPage from "@/pages/patient/MedicalRecords";
import PatientProfilePage from "@/pages/patient/PatientProfile";

const patientNav = [
  { label: "Dashboard", to: "/patient/dashboard" },
  { label: "Find Doctors", to: "/patient/find-doctors" },
  { label: "My Appointments", to: "/patient/appointments" },
  { label: "Medical Records", to: "/patient/medical-records" }
];

const doctorNav = [
  { label: "Dashboard", to: "/doctor/dashboard" },
  { label: "My Schedule", to: "/doctor/schedule" },
  { label: "Upcoming Appointments", to: "/doctor/appointments" }
];

function HomeRedirect() {
  const token = getToken();
  const user = getUser();
  if (token && user) {
    return <Navigate to={user.role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard"} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute allowedRoles={["patient"]} />}>
          <Route
            element={
              <DashboardLayout
                title="Patient Portal"
                navItems={patientNav}
                profilePath="/patient/profile"
              />
            }
          >
            <Route path="/patient/dashboard" element={<PatientDashboardHome />} />
            <Route path="/patient/find-doctors" element={<FindDoctorsPage />} />
            <Route path="/patient/doctors/:id" element={<DoctorDetailPage />} />
            <Route path="/patient/appointments" element={<PatientAppointmentsPage />} />
            <Route path="/patient/medical-records" element={<MedicalRecordsPage />} />
            <Route path="/patient/profile" element={<PatientProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["doctor"]} />}>
          <Route
            element={
              <DashboardLayout
                title="Doctor Portal"
                navItems={doctorNav}
                profilePath="/doctor/profile"
              />
            }
          >
            <Route path="/doctor/dashboard" element={<DoctorDashboardHome />} />
            <Route path="/doctor/schedule" element={<DoctorSchedulePage />} />
            <Route path="/doctor/appointments" element={<DoctorAppointmentsPage />} />
            <Route path="/doctor/profile" element={<DoctorProfilePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
