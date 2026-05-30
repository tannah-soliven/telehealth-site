import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import type { Appointment } from "@/lib/types";
import { ApiError, apiFetch } from "@/lib/api";

type AppointmentListProps = {
  appointments: Appointment[];
  emptyMessage: string;
  showPatient?: boolean;
  showDoctor?: boolean;
  onCancel?: (id: string) => void;
  onReschedule?: (appointment: Appointment) => void; // Added type definition
};

export function AppointmentList({
  appointments,
  emptyMessage,
  showPatient = false,
  showDoctor = true,
  onCancel,
  onReschedule // Added destructured prop parameter
}: AppointmentListProps) {
  if (appointments.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {appointments.map((appt) => (
        <li key={appt.id}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {showDoctor ? appt.doctorName : appt.patientName}
              </CardTitle>
              {showDoctor && appt.doctorSpecialty ? (
                <CardDescription>{appt.doctorSpecialty}</CardDescription>
              ) : showPatient ? (
                <CardDescription>Patient visit</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{formatDateTime(appt.scheduledStart)}</p>
              <p className="capitalize text-muted-foreground">Status: {appt.status}</p>
              
              {appt.status === "scheduled" ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={appt.videoRoomUrl} target="_blank" rel="noreferrer">
                      Join video call
                    </a>
                  </Button>

                  {/* Reschedule Button rendered only if action handler prop is supplied */}
                  {onReschedule ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReschedule(appt)}
                    >
                      Reschedule
                    </Button>
                  ) : null}

                  {onCancel ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onCancel(appt.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export async function fetchUpcomingAppointments(params: {
  patientId?: string;
  doctorId?: string;
}): Promise<Appointment[]> {
  const search = new URLSearchParams({ status: "upcoming" });
  if (params.patientId) search.set("patientId", params.patientId);
  if (params.doctorId) search.set("doctorId", params.doctorId);
  const data = await apiFetch<{ appointments: Appointment[] }>(
    `/api/appointments?${search.toString()}`
  );
  return data.appointments;
}

export async function cancelAppointment(id: string): Promise<void> {
  try {
    await apiFetch(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" })
    });
  } catch (e) {
    throw e instanceof ApiError ? e : new ApiError("Cancel failed", 500);
  }
}