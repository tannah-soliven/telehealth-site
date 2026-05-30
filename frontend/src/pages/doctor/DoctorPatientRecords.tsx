import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import type { DoctorPatientSummary, MedicalRecord, PatientRecordsResponse } from "@/lib/types";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function PatientRecordDetail({ patientId }: { patientId: string }) {
  const [data, setData] = useState<PatientRecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<PatientRecordsResponse>(`/api/patients/${patientId}/records`);
        if (!cancelled) {
          setData(res);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Failed to load patient record");
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
  }, [patientId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading patient record…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!data) return null;

  const { profile, records } = data;
  const sortedRecords = [...records].sort((a, b) =>
    b.scheduledStart.localeCompare(a.scheduledStart)
  );

  return (
    <div className="space-y-4 border-t pt-4">
      {profile ? (
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          <p className="mb-2 font-medium">Profile</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {profile.weightKg != null ? (
              <p>
                <span className="font-medium">Weight: </span>
                {profile.weightKg} kg
              </p>
            ) : (
              <p className="text-muted-foreground">Weight not recorded</p>
            )}
            {profile.heightCm != null ? (
              <p>
                <span className="font-medium">Height: </span>
                {profile.heightCm} cm
              </p>
            ) : (
              <p className="text-muted-foreground">Height not recorded</p>
            )}
            <div className="sm:col-span-2">
              <span className="font-medium">Medical history: </span>
              <span className="text-muted-foreground">
                {profile.medicalHistory ?? "None recorded"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-medium">Consultation notes</p>
        {sortedRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No appointments on record.</p>
        ) : (
          <ul className="space-y-3">
            {sortedRecords.map((record) => (
              <AppointmentNoteItem key={record.appointmentId} record={record} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AppointmentNoteItem({ record }: { record: MedicalRecord }) {
  return (
    <li className="rounded-md border p-3 text-sm space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Date: </span>
          {formatDate(record.scheduledStart)}
        </span>
        <span>
          <span className="font-medium text-foreground">Time: </span>
          {formatTime(record.scheduledStart)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{record.doctor.name}</p>
      {record.note ? (
        <>
          {record.note.findings ? (
            <p>
              <span className="font-medium">Findings: </span>
              {record.note.findings}
            </p>
          ) : (
            <p className="text-muted-foreground">No findings recorded.</p>
          )}
          {record.note.prescription ? (
            <p>
              <span className="font-medium">Prescription: </span>
              {record.note.prescription}
            </p>
          ) : (
            <p className="text-muted-foreground">No prescription recorded.</p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">No consultation notes for this visit.</p>
      )}
    </li>
  );
}

export default function DoctorPatientRecordsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const loadPatients = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) {
        params.set("search", keyword.trim());
      }
      const query = params.toString();
      const data = await apiFetch<{ patients: DoctorPatientSummary[] }>(
        `/api/doctor/patients${query ? `?${query}` : ""}`
      );
      setPatients(data.patients);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load patients");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatients(debouncedSearch);
  }, [debouncedSearch, loadPatients]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patient Records</h1>
        <p className="text-sm text-muted-foreground">
          Search patients with appointment history and view their medical records
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="patient-search" className="text-sm font-medium">
          Enter Keywords for Search
        </label>
        <Input
          id="patient-search"
          type="search"
          placeholder="e.g. Maria, 70, hypertension, ibuprofen, Jan 1990"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading patients…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error && patients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {debouncedSearch.trim()
            ? "No patients match your search."
            : "No patients with appointments found."}
        </p>
      ) : null}

      {!loading && !error && patients.length > 0 ? (
        <ul className="space-y-3">
          {patients.map((patient) => {
            const isExpanded = expandedPatientId === patient.id;
            return (
              <li key={patient.id}>
                <Card>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() =>
                      setExpandedPatientId(isExpanded ? null : patient.id)
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{patient.name}</CardTitle>
                          <CardDescription>
                            {patient.email}
                            {patient.dateOfBirth ? ` · DOB ${patient.dateOfBirth}` : ""}
                            {patient.mostRecentAppointment
                              ? ` · Last visit ${formatDateTime(patient.mostRecentAppointment)}`
                              : ""}
                          </CardDescription>
                          {patient.matchReasons.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {patient.matchReasons.map((reason) => (
                                <span
                                  key={reason}
                                  className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                >
                                  Matched: {reason}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {isExpanded ? "▲ Hide" : "▼ View record"}
                        </span>
                      </div>
                    </CardHeader>
                  </button>
                  {isExpanded ? (
                    <CardContent>
                      <PatientRecordDetail patientId={patient.id} />
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
