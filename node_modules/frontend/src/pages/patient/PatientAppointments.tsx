import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  AppointmentList,
  cancelAppointment,
  fetchUpcomingAppointments
} from "@/components/AppointmentList";
import { RescheduleAppointmentDialog } from "@/components/RescheduleAppointmentDialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type { Appointment } from "@/lib/types";

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Track which appointment the patient wants to reschedule
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUpcomingAppointments({});
      setAppointments(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to Load Appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCancel(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    try {
      await cancelAppointment(id);
      setSuccessMessage(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to cancel");
    }
  }

  // Handle successful update event dispatch from inside dialog component
  function handleRescheduled() {
    setSuccessMessage("Appointment rescheduled successfully.");
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Appointments</h1>
          <p className="text-sm text-muted-foreground">Upcoming Telehealth Visits</p>
        </div>
        <Button asChild>
          <Link to="/patient/find-doctors">Book New Visit</Link>
        </Button>
      </div>

      {successMessage ? (
        <p className="text-sm text-green-600" role="status">
          {successMessage}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading ? (
        <AppointmentList
          appointments={appointments}
          emptyMessage="No upcoming appointments. Find a doctor to book a visit."
          onCancel={handleCancel}
          // Pass the setter down so the list items can select a target
          onReschedule={(appt) => {
            setSuccessMessage(null);
            setRescheduleTarget(appt);
          }}
        />
      ) : null}

      {/* Reschedule Overlay Controller modal frame */}
      {rescheduleTarget ? (
        <RescheduleAppointmentDialog
          appointment={rescheduleTarget}
          open={Boolean(rescheduleTarget)}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={handleRescheduled}
        />
      ) : null}
    </div>
  );
}