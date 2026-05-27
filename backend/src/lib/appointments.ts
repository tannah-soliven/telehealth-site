import { formatAppTzIso } from "./timezone.js";

export function jitsiRoomUrl(appointmentId: string): string {
  return `https://meet.jit.si/telehealth-${appointmentId}`;
}

export type AppointmentRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  availability_slot_id: string | null;
  scheduled_start: Date;
  scheduled_end: Date;
  status: string;
  reason: string | null;
  video_room_url: string | null;
  patient_first_name?: string;
  patient_last_name?: string;
  doctor_first_name?: string;
  doctor_last_name?: string;
  doctor_specialty?: string;
};

export function formatAppointment(row: AppointmentRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    availabilitySlotId: row.availability_slot_id,
    scheduledStart: formatAppTzIso(row.scheduled_start),
    scheduledEnd: formatAppTzIso(row.scheduled_end),
    status: row.status,
    reason: row.reason,
    videoRoomUrl: row.video_room_url ?? jitsiRoomUrl(row.id),
    patientName:
      row.patient_first_name && row.patient_last_name
        ? `${row.patient_first_name} ${row.patient_last_name}`
        : undefined,
    doctorName:
      row.doctor_first_name && row.doctor_last_name
        ? `Dr. ${row.doctor_first_name} ${row.doctor_last_name}`
        : undefined,
    doctorSpecialty: row.doctor_specialty
  };
}
