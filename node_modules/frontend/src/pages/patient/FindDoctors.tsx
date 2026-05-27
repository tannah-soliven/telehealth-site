import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import type { DoctorListItem } from "@/lib/types";

export default function FindDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSpecialties() {
      try {
        const data = await apiFetch<{ specialties: string[] }>("/api/doctors/specialties");
        setSpecialties(data.specialties);
      } catch {
        // non-fatal — filter will just show "All"
      }
    }
    void loadSpecialties();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const query = specialty !== "All" ? `?specialty=${encodeURIComponent(specialty)}` : "";
        const data = await apiFetch<{ doctors: DoctorListItem[] }>(`/api/doctors${query}`);
        setDoctors(data.doctors);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load doctors");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [specialty]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find Doctors</h1>
          <p className="text-sm text-muted-foreground">
            Browse specialists and book a telehealth visit.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <label className="text-sm font-medium">Specialty</label>
          <Select value={specialty} onValueChange={setSpecialty}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {specialties.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading doctors…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{doctor.name}</CardTitle>
                <CardDescription>{doctor.specialty ?? "General practice"}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {doctor.bio ?? "No bio available."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {doctor.availableSlotCount > 0
                    ? `${doctor.availableSlotCount} open slots${
                        doctor.nextAvailableAt
                          ? ` · Next: ${formatDateTime(doctor.nextAvailableAt)}`
                          : ""
                      }`
                    : "No open slots"}
                </p>
                <Button asChild className="w-full">
                  <Link to={`/patient/doctors/${doctor.id}`}>View profile & book</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && !error && doctors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No doctors match this specialty.</p>
      ) : null}
    </div>
  );
}
