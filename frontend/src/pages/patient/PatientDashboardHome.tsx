import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AppointmentList, fetchUpcomingAppointments } from "@/components/AppointmentList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Appointment, DoctorListItem } from "@/lib/types";

type RecommendResponse = {
  specialties: string[];
  reasoning: string;
  doctors: DoctorListItem[];
};

export default function PatientDashboardHome() {
  const user = getUser();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [symptoms, setSymptoms] = useState("");
  const [recommending, setRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const list = await fetchUpcomingAppointments({});
        setAppointments(list.slice(0, 3));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function findDoctor() {
    if (symptoms.trim().length < 3) {
      setRecommendError("Please describe your symptoms (at least 3 characters).");
      return;
    }
    setRecommending(true);
    setRecommendError(null);
    setRecommendation(null);
    try {
      const data = await apiFetch<RecommendResponse>("/api/ai/recommend", {
        method: "POST",
        body: JSON.stringify({ symptoms: symptoms.trim() })
      });
      setRecommendation(data);
    } catch (e) {
      if (e instanceof ApiError) {
        setRecommendError(e.message);
      } else if (e instanceof Error) {
        setRecommendError(e.message || "Could not get recommendations. Check your connection.");
      } else {
        setRecommendError("Could not get recommendations. Please try again.");
      }
    } finally {
      setRecommending(false);
    }
  }

  return (
    <div className="space-y-6">


      <Card>
        <CardHeader>
          <CardTitle>Find Your Doctor</CardTitle>
          <CardDescription>
            Describe your symptoms and we will suggest matching specialists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="symptoms" className="text-sm font-medium">
              Describe your symptoms
            </label>
            <Textarea
              id="symptoms"
              rows={4}
              placeholder="e.g. persistent chest tightness, shortness of breath when walking, etc."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />
          </div>
          {recommendError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {recommendError}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button onClick={findDoctor} disabled={recommending}>
              {recommending ? "Finding doctors…" : "Find a Doctor"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/patient/find-doctors">Browse All Doctors</Link>
            </Button>
          </div>

          {recommendation ? (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Suggested Specialties:</span>{" "}
                {recommendation.specialties.join(", ")}
              </p>
              {recommendation.reasoning ? (
                <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
              ) : null}
              {recommendation.doctors.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  No doctors matched those specialties yet. Try{" "}
                  <Link to="/patient/find-doctors" className="underline">
                    browsing all doctors
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recommendation.doctors.map((doctor) => (
                    <Card key={doctor.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{doctor.name}</CardTitle>
                        <CardDescription>{doctor.specialty}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {doctor.bio ?? "No bio"}
                        </p>
                        <Button size="sm" asChild>
                          <Link to={`/patient/doctors/${doctor.id}`}>Book a Visit</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming Appointments</h2>
          <Link to="/patient/appointments" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading appointments…</p>
        ) : (
          <AppointmentList
            appointments={appointments}
            emptyMessage="No upcoming visits. Book a doctor to get started."
          />
        )}
      </div>
    </div>
  );
}