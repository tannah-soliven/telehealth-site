import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateFromKey, formatDateTime, formatTime, groupSlotsByDate } from "@/lib/dates";
import type { Appointment, AvailabilitySlot, DoctorDetail } from "@/lib/types";

type Props = {
  appointment: Appointment;
  open: boolean;
  onClose: () => void;
  onRescheduled: () => void;
};

type Step = "date" | "time" | "confirm";

export function RescheduleAppointmentDialog({
  appointment,
  open,
  onClose,
  onRescheduled
}: Props) {
  const [step, setStep] = useState<Step>("date");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setStep("date");
    setSelectedDate(null);
    setSelectedSlot(null);
    setSubmitError(null);
    setSlotsError(null);

    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const doctor = await apiFetch<DoctorDetail>(`/api/doctors/${appointment.doctorId}`);
        setSlots(doctor.availableSlots);
      } catch (e) {
        setSlotsError(e instanceof ApiError ? e.message : "Failed to load available slots");
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }

    void loadSlots();
  }, [open, appointment.doctorId]);

  const slotsByDate = useMemo(() => groupSlotsByDate(slots), [slots]);
  const dates = useMemo(() => Array.from(slotsByDate.keys()).sort(), [slotsByDate]);
  const timesForDate = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  async function handleConfirm() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt: selectedSlot.startsAt })
      });
      onRescheduled();
      onClose();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Failed to reschedule");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 id="reschedule-title" className="text-lg font-semibold">
              Reschedule appointment
            </h2>
            <p className="text-sm text-muted-foreground">
              {appointment.patientName ?? "Patient"} · currently{" "}
              {formatDateTime(appointment.scheduledStart)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        {loadingSlots ? (
          <p className="text-sm text-muted-foreground">Loading available times…</p>
        ) : null}
        {slotsError ? <p className="text-sm text-destructive">{slotsError}</p> : null}

        {!loadingSlots && !slotsError && slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open slots available. Add availability on your schedule first.
          </p>
        ) : null}

        {!loadingSlots && !slotsError && slots.length > 0 ? (
          <div className="space-y-4">
            {step === "date" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Choose a date</p>
                <div className="flex flex-wrap gap-2">
                  {dates.map((date) => (
                    <Button
                      key={date}
                      variant={selectedDate === date ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                        setStep("time");
                      }}
                    >
                      {formatDateFromKey(date)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {step === "time" && selectedDate ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Choose a time · {formatDateFromKey(selectedDate)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {timesForDate.map((slot) => (
                    <Button
                      key={slot.id}
                      variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                      size="sm"
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
                  ← Back to dates
                </Button>
              </div>
            ) : null}

            {step === "confirm" && selectedSlot ? (
              <div className="space-y-3 rounded-md border p-4 text-sm">
                <p>
                  <span className="font-medium">New time: </span>
                  {formatDateTime(selectedSlot.startsAt)}
                </p>
                {submitError ? <p className="text-destructive">{submitError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleConfirm} disabled={submitting}>
                    {submitting ? "Rescheduling…" : "Confirm reschedule"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("time")} disabled={submitting}>
                    Back
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
