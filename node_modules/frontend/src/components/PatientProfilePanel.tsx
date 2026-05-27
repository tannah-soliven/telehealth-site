import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import type { MedicalRecord, PatientRecordsResponse } from "@/lib/types";

type Props = {
  patientId: string;
};

export function PatientProfilePanel({ patientId }: Props) {
  const [data, setData] = useState<PatientRecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<PatientRecordsResponse>(
          `/api/patients/${patientId}/records`
        );
        setData(res);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load patient info");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [patientId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading patient info…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  const { profile, records } = data;

  return (
    <div className="space-y-4">
      {profile ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Patient profile</CardTitle>
            <CardDescription>
              {profile.firstName} {profile.lastName} · {profile.email}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            {profile.dateOfBirth ? (
              <div>
                <span className="font-medium">DOB: </span>
                {profile.dateOfBirth}
              </div>
            ) : null}
            {profile.weightKg != null ? (
              <div>
                <span className="font-medium">Weight: </span>
                {profile.weightKg} kg
              </div>
            ) : null}
            {profile.heightCm != null ? (
              <div>
                <span className="font-medium">Height: </span>
                {profile.heightCm} cm
              </div>
            ) : null}
            {profile.phone ? (
              <div>
                <span className="font-medium">Phone: </span>
                {profile.phone}
              </div>
            ) : null}
            {profile.medicalHistory ? (
              <div className="sm:col-span-2">
                <span className="font-medium">Medical history: </span>
                <span className="text-muted-foreground">{profile.medicalHistory}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {records.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Past consultation notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {records
              .filter((r): r is MedicalRecord & { note: NonNullable<MedicalRecord["note"]> } =>
                r.note !== null
              )
              .map((r) => (
                <div key={r.appointmentId} className="rounded-md border p-3 text-sm space-y-1">
                  <p className="font-medium">{formatDateTime(r.scheduledStart)}</p>
                  <p className="text-xs text-muted-foreground">{r.doctor.name}</p>
                  {r.note.findings ? (
                    <p>
                      <span className="font-medium">Findings: </span>
                      {r.note.findings}
                    </p>
                  ) : null}
                  {r.note.prescription ? (
                    <p>
                      <span className="font-medium">Prescription: </span>
                      {r.note.prescription}
                    </p>
                  ) : null}
                </div>
              ))}
            {records.every((r) => !r.note) ? (
              <p className="text-sm text-muted-foreground">No consultation notes yet.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
