import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/dates";
import type { MedicalRecord, PatientRecordsResponse } from "@/lib/types";

type DoctorRecordGroup = {
  doctor: MedicalRecord["doctor"];
  appointments: MedicalRecord[];
};

function groupRecordsByDoctor(records: MedicalRecord[]): DoctorRecordGroup[] {
  const byDoctor = new Map<string, DoctorRecordGroup>();

  for (const record of records) {
    const existing = byDoctor.get(record.doctor.id);
    if (existing) {
      existing.appointments.push(record);
    } else {
      byDoctor.set(record.doctor.id, {
        doctor: record.doctor,
        appointments: [record]
      });
    }
  }

  for (const group of byDoctor.values()) {
    group.appointments.sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  }

  return Array.from(byDoctor.values()).sort((a, b) => {
    const aLatest = a.appointments[0]?.scheduledStart ?? "";
    const bLatest = b.appointments[0]?.scheduledStart ?? "";
    return bLatest.localeCompare(aLatest);
  });
}

// Sub-component matching your exact original list item aesthetic
function AppointmentRecordItem({ record }: { record: MedicalRecord }) {
  const [isRecordExpanded, setIsRecordExpanded] = useState(false);

  return (
    <li className="rounded-md border bg-muted/30 p-4 text-sm space-y-3">
      {/* Clickable Header Row */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-x-4 gap-y-1 text-muted-foreground focus:outline-none"
        onClick={() => setIsRecordExpanded(!isRecordExpanded)}
      >
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <p>
            <span className="font-medium text-foreground">Date: </span>
            {formatDate(record.scheduledStart)}
          </p>
          <p>
            <span className="font-medium text-foreground">Time: </span>
            {formatTime(record.scheduledStart)}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium select-none">
          {isRecordExpanded ? "▲ Hide details" : "▼ View details"}
        </span>
      </button>

      {/* Expandable Inner Content - Exact Original Styles Restored */}
      {isRecordExpanded && (
        <div className="space-y-3 pt-1">
          {record.note?.findings ? (
            <div>
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Consultation findings
              </p>
              <p className="rounded-md bg-background p-3">
                {record.note.findings}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No consultation findings recorded.</p>
          )}

          {record.note?.prescription ? (
            <div>
              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Prescription
              </p>
              <p className="rounded-md bg-background p-3">
                {record.note.prescription}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No prescription recorded.</p>
          )}
        </div>
      )}
    </li>
  );
}

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [expandedDoctorId, setExpandedDoctorId] = useState<string | null>(null);

  const doctorGroups = useMemo(() => groupRecordsByDoctor(records), [records]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!getToken()) {
          throw new ApiError("Not signed in", 401);
        }

        const profileRes = await apiFetch<{ id: string }>("/api/patient/profile");
        const data = await apiFetch<PatientRecordsResponse>(
          `/api/patients/${profileRes.id}/records`
        );

        if (!cancelled) {
          setRecords(data.records);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Failed to load records");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Medical Records</h1>
        <p className="text-sm text-muted-foreground">
          Past visits grouped by doctor, newest first
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading records…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && records.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">No past visits on record yet.</p>
      ) : null}

      {!loading && !error ? (
        <ul className="space-y-6">
          {doctorGroups.map((group) => {
            const isDoctorExpanded = expandedDoctorId === group.doctor.id;
            
            return (
              <li key={group.doctor.id}>
                <Card>
                  <button
                    type="button"
                    className="w-full text-left focus:outline-none"
                    onClick={() =>
                      setExpandedDoctorId(isDoctorExpanded ? null : group.doctor.id)
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg">{group.doctor.name}</CardTitle>
                          <CardDescription>
                            {group.doctor.specialty ?? "General practice"}
                          </CardDescription>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground mt-1 font-medium">
                          {isDoctorExpanded ? "▲ Hide" : "▼ View record"}
                        </span>
                      </div>
                    </CardHeader>
                  </button>

                  {isDoctorExpanded ? (
                    <CardContent className="space-y-4">
                      <ul className="space-y-4">
                        {group.appointments.map((record) => (
                          <AppointmentRecordItem 
                            key={record.appointmentId} 
                            record={record} 
                          />
                        ))}
                      </ul>
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}