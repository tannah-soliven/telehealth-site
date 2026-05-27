import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AppointmentList, fetchUpcomingAppointments } from "@/components/AppointmentList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/lib/auth";
import type { Appointment } from "@/lib/types";

export default function DoctorDashboardHome() {
  const user = getUser();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await fetchUpcomingAppointments({});
        setAppointments(list.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Doctor workspace</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Review your upcoming patient visits below.
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming appointments</h2>
          <Link to="/doctor/appointments" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading appointments…</p>
        ) : (
          <AppointmentList
            appointments={appointments}
            emptyMessage="No upcoming appointments scheduled."
            showDoctor={false}
            showPatient
          />
        )}
      </div>
    </div>
  );
}
