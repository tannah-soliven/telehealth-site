import { useCallback, useEffect, useState } from "react";

import { ConsultationNotesForm } from "@/components/ConsultationNotesForm";
import { PatientProfilePanel } from "@/components/PatientProfilePanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchUpcomingAppointments } from "@/components/AppointmentList";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import type { Appointment } from "@/lib/types";

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUpcomingAppointments({});
      setAppointments(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load appointments");
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
      await apiFetch(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" })
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to cancel");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upcoming Appointments</h1>
        <p className="text-sm text-muted-foreground">Patients scheduled with you</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
      ) : null}

      {!loading ? (
        <ul className="space-y-4">
          {appointments.map((appt) => (
            <li key={appt.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{appt.patientName ?? "Patient"}</CardTitle>
                  <CardDescription>{formatDateTime(appt.scheduledStart)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm capitalize text-muted-foreground">
                    Status: {appt.status}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {appt.status === "scheduled" ? (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <a href={appt.videoRoomUrl} target="_blank" rel="noreferrer">
                            Join video call
                          </a>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancel(appt.id)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}

                    <ConsultationNotesForm appointmentId={appt.id} />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedPatient(
                          expandedPatient === appt.patientId ? null : appt.patientId
                        )
                      }
                    >
                      {expandedPatient === appt.patientId
                        ? "Hide patient info"
                        : "View patient info"}
                    </Button>
                  </div>

                  {expandedPatient === appt.patientId ? (
                    <div className="mt-3 border-t pt-3">
                      <PatientProfilePanel patientId={appt.patientId} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
