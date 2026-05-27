import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateFromKey, formatDateTime, formatTime, groupSlotsByDate } from "@/lib/dates";
import type { Appointment, AvailabilitySlot, DoctorDetail } from "@/lib/types";

type BookingStep = "date" | "time" | "confirm" | "done";

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<BookingStep>("date");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<DoctorDetail>(`/api/doctors/${id}`);
        setDoctor(data);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load doctor");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  const slotsByDate = useMemo(
    () => (doctor ? groupSlotsByDate(doctor.availableSlots) : new Map<string, AvailabilitySlot[]>()),
    [doctor]
  );

  const dates = useMemo(() => Array.from(slotsByDate.keys()).sort(), [slotsByDate]);

  const timesForDate = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  async function confirmBooking() {
    if (!selectedSlot) return;
    setBooking(true);
    setError(null);
    try {
      const data = await apiFetch<{ appointment: Appointment }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({ availabilitySlotId: selectedSlot.id })
      });
      setBooked(data.appointment);
      setStep("done");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading doctor profile…</p>;
  }

  if (!doctor) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error ?? "Doctor not found"}</p>
        <Button variant="outline" asChild>
          <Link to="/patient/find-doctors">Back to doctors</Link>
        </Button>
      </div>
    );
  }

  if (step === "done" && booked) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Appointment confirmed</CardTitle>
          <CardDescription>Your visit with {doctor.name} is scheduled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>{formatDateTime(booked.scheduledStart)}</p>
          <div className="rounded-md border bg-muted/50 p-4">
            <p className="font-medium">Video visit (Jitsi)</p>
            <a
              href={booked.videoRoomUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block break-all text-primary hover:underline"
            >
              {booked.videoRoomUrl}
            </a>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <a href={booked.videoRoomUrl} target="_blank" rel="noreferrer">
                Open video room
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/patient/appointments">My appointments</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/patient/find-doctors">← Back to doctors</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{doctor.name}</CardTitle>
          <CardDescription>{doctor.specialty ?? "General practice"}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{doctor.bio ?? "No bio available."}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Book an appointment</CardTitle>
          <CardDescription>
            {step === "date" && "Step 1: Choose a date"}
            {step === "time" && "Step 2: Choose a time"}
            {step === "confirm" && "Step 3: Confirm your booking"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "date" ? (
            <>
              {dates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available dates.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dates.map((d) => (
                    <Button
                      key={d}
                      variant={selectedDate === d ? "default" : "outline"}
                      onClick={() => {
                        setSelectedDate(d);
                        setStep("time");
                      }}
                    >
                      {formatDateFromKey(d)}
                    </Button>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {step === "time" ? (
            <>
              <p className="text-sm text-muted-foreground">
                {selectedDate ? formatDateFromKey(selectedDate) : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {timesForDate.map((slot) => (
                  <Button
                    key={slot.id}
                    variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                    onClick={() => {
                      setSelectedSlot(slot);
                      setStep("confirm");
                    }}
                  >
                    {formatTime(slot.startsAt)}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("date")}>
                Change date
              </Button>
            </>
          ) : null}

          {step === "confirm" && selectedSlot ? (
            <>
              <p className="text-sm">
                <span className="font-medium">When:</span> {formatDateTime(selectedSlot.startsAt)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Doctor:</span> {doctor.name}
              </p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button onClick={confirmBooking} disabled={booking}>
                  {booking ? "Booking…" : "Confirm booking"}
                </Button>
                <Button variant="outline" onClick={() => setStep("time")}>
                  Back
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
