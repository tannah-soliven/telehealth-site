import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Calendar, CheckCircle, Clock } from "lucide-react";

import { AppointmentList, fetchUpcomingAppointments } from "@/components/AppointmentList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/lib/auth";
import type { Appointment } from "@/lib/types";

// Helper function adjusted to check if a date falls within the current ISO week (Monday – Sunday)
function isThisWeek(dateString: string | Date): boolean {
  const appointmentDate = new Date(dateString);
  const now = new Date();

  // Get current day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const currentDayOfWeek = now.getDay();
  
  // Calculate distance back to Monday
  // If today is Sunday (0), we need to go back 6 days. Otherwise, go back (day - 1) days.
  const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

  // Calculate start of this week (Monday at 00:00:00)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // Calculate end of this week (Sunday at 23:59:59.999)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return appointmentDate >= startOfWeek && appointmentDate <= endOfWeek;
}

export default function DoctorDashboardHome() {
  const user = getUser();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await fetchUpcomingAppointments({});
        
        // Filter appointments based on the adjusted Monday-to-Sunday window
        const weeklyAppointments = list.filter((appt) => 
          isThisWeek(appt.scheduledStart || appt.scheduledStart)
        );
        
        setAppointments(weeklyAppointments);
      } catch (error) {
        console.error("Failed to load weekly appointments", error);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // Compute metric data totals matching the updated week layout
  const totalThisWeek = appointments.length;
  const completedVisits = appointments.filter(
    (a) => a.status?.toLowerCase() === "completed" || a.status?.toLowerCase() === "fulfilled"
  ).length;
  const pendingVisits = appointments.filter(
    (a) => a.status?.toLowerCase() === "scheduled" || a.status?.toLowerCase() === "pending"
  ).length;

  return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Weekly Appointments Summary</h2>
          </div>
        </div>
      {/* Summary Stats Tiles Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : totalThisWeek}</div>
            <p className="text-xs text-muted-foreground">Mon – Sun consultations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed / Active</CardTitle>
            <Clock className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : pendingVisits}</div>
            <p className="text-xs text-muted-foreground">Awaiting clinic review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Visits</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : completedVisits}</div>
            <p className="text-xs text-muted-foreground">Done this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Appointment List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Appointments This Week</h2>
          <Link to="/doctor/appointments" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading appointments…</p>
        ) : (
          <div className="space-y-4">
            <AppointmentList
              appointments={appointments}
              emptyMessage="No appointments scheduled for this week."
              showDoctor={false}
              showPatient
            />
            
          </div>
        )}
      </div>
    </div>
  );
}