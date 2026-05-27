import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api";
import type { ConsultationNote } from "@/lib/types";

type Props = {
  appointmentId: string;
  onSaved?: (note: ConsultationNote) => void;
};

export function ConsultationNotesForm({ appointmentId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState("");
  const [prescription, setPrescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [existing, setExisting] = useState<ConsultationNote | null>(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      try {
        const data = await apiFetch<{ note: ConsultationNote | null }>(
          `/api/consultations/${appointmentId}`
        );
        if (data.note) {
          setExisting(data.note);
          setFindings(data.note.findings ?? "");
          setPrescription(data.note.prescription ?? "");
        }
      } catch {
        /* ignore — may be new */
      }
    }
    void load();
  }, [open, appointmentId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch<{ note: ConsultationNote }>(
        `/api/consultations/${appointmentId}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ findings: findings || null, prescription: prescription || null })
        }
      );
      setExisting(data.note);
      setSaved(true);
      onSaved?.(data.note);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen((v) => !v);
          setSaved(false);
          setError(null);
        }}
      >
        {existing ? "Edit notes" : "Add notes"}
      </Button>

      {open ? (
        <Card className="mt-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Consultation notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Findings
              </label>
              <Textarea
                rows={4}
                placeholder="Clinical observations, diagnosis…"
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Prescription
              </label>
              <Textarea
                rows={3}
                placeholder="Medications, dosage, instructions…"
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {saved ? (
              <p className="text-sm text-green-600">Notes saved.</p>
            ) : null}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save notes"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
