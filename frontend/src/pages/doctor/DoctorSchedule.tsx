import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type WeeklySlot = {
  dayOfWeek: number;
  hour: number;
  available: boolean;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

function formatHour(h: number): string {
  if (h === 12) return "12pm";
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}

function slotKey(day: number, hour: number) {
  return `${day}-${hour}`;
}

export default function DoctorSchedulePage() {
  const [slots, setSlots] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ slots: WeeklySlot[] }>("/api/doctor/availability");
      const map = new Map<string, boolean>();
      for (const s of data.slots) {
        map.set(slotKey(s.dayOfWeek, s.hour), s.available);
      }
      setSlots(map);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(day: number, hour: number) {
    const key = slotKey(day, hour);
    setSlots((prev) => {
      const next = new Map(prev);
      next.set(key, !prev.get(key));
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: WeeklySlot[] = [];
      for (let day = 0; day <= 6; day++) {
        for (const hour of HOURS) {
          payload.push({
            dayOfWeek: day,
            hour,
            available: slots.get(slotKey(day, hour)) ?? false
          });
        }
      }
      await apiFetch("/api/doctor/availability", {
        method: "POST",
        body: JSON.stringify({ slots: payload })
      });
      setMessage("Schedule saved. Open booking slots updated for the next 4 weeks.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Click hourly blocks (9am–5pm PHT) to toggle weekly availability. Patients can book open slots.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
          <CardDescription>Green = available · Gray = unavailable</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading schedule…</p>
          ) : (
            <table className="w-full min-w-[700px] border-collapse table-fixed text-sm">
              <thead>
                <tr>
                  {/* Fixed column width allocations to enforce uniform square slots */}
                  <th className="w-[9%] p-2 text-left font-medium text-muted-foreground">Time</th>
                  {DAY_LABELS.map((d) => (
                    <th key={d} className="w-[13%] p-2 text-center font-medium">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{formatHour(hour)}</td>
                    {DAY_LABELS.map((_, day) => {
                      const available = slots.get(slotKey(day, hour)) ?? false;
                      return (
                        <td key={day} className="p-1">
                          <button
                            type="button"
                            aria-label={`${DAY_LABELS[day]} ${formatHour(hour)} ${available ? "available" : "unavailable"}`}
                            className={cn(
                              "h-10 w-full rounded-md border transition-colors cursor-pointer",
                              available
                                ? "border-emerald-500 bg-emerald-100 dark:bg-emerald-950/50 hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                                : "border-input bg-muted/60 hover:bg-muted"
                            )}
                            onClick={() => toggle(day, hour)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="pt-2 space-y-2">
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            {message ? <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{message}</p> : null}
          </div>

          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save schedule"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}