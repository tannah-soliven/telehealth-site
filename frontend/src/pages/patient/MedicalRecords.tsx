import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import type { MedicalRecord, PatientRecordsResponse } from "@/lib/types";

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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
        <p className="text-sm text-muted-foreground">Your past visits and consultation notes</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading records…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && records.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">No past visits on record yet.</p>
      ) : null}

      {!loading && !error ? (
        <ul className="space-y-3">
          {records.map((record) => {
            const isOpen = expanded === record.appointmentId;
            return (
              <li key={record.appointmentId}>
                <Card>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() =>
                      setExpanded(isOpen ? null : record.appointmentId)
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {record.doctor.name}
                          </CardTitle>
                          <CardDescription>
                            {record.doctor.specialty ?? "General practice"} ·{" "}
                            {formatDateTime(record.scheduledStart)} ·{" "}
                            <span className="capitalize">{record.status}</span>
                          </CardDescription>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {isOpen ? "▲ Hide" : "▼ Show"}
                        </span>
                      </div>
                    </CardHeader>
                  </button>

                  {isOpen ? (
                    <CardContent className="space-y-3 border-t pt-4 text-sm">
                      {record.reason ? (
                        <p>
                          <span className="font-medium">Reason: </span>
                          {record.reason}
                        </p>
                      ) : null}

                      {record.note ? (
                        <>
                          {record.note.findings ? (
                            <div>
                              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                Findings
                              </p>
                              <p className="rounded-md bg-muted/50 p-3">
                                {record.note.findings}
                              </p>
                            </div>
                          ) : null}
                          {record.note.prescription ? (
                            <div>
                              <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                Prescription
                              </p>
                              <p className="rounded-md bg-muted/50 p-3">
                                {record.note.prescription}
                              </p>
                            </div>
                          ) : null}
                          {!record.note.findings && !record.note.prescription ? (
                            <p className="text-muted-foreground">
                              Notes saved but no content yet.
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-muted-foreground">
                          No consultation notes for this visit.
                        </p>
                      )}
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
