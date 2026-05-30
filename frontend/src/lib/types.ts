export type DoctorListItem = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  specialty: string | null;
  bio: string | null;
  availableSlotCount: number;
  nextAvailableAt: string | null;
};

export type AvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type DoctorDetail = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  specialty: string | null;
  bio: string | null;
  licenseNumber: string | null;
  availableSlots: AvailabilitySlot[];
};

export type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  availabilitySlotId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  reason: string | null;
  videoRoomUrl: string;
  patientName?: string;
  doctorName?: string;
  doctorSpecialty?: string;
};

export type ConsultationNote = {
  id: string;
  appointmentId: string;
  doctorId: string;
  findings: string | null;
  prescription: string | null;
  doctorName?: string;
  createdAt: string;
  updatedAt: string;
};

export type MedicalRecord = {
  appointmentId: string;
  scheduledStart: string;
  status: string;
  reason: string | null;
  doctor: {
    id: string;
    name: string;
    specialty: string | null;
  };
  note: {
    id: string;
    findings: string | null;
    prescription: string | null;
    createdAt: string;
  } | null;
};

export type PatientRecordsResponse = {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string | null;
    weightKg: number | null;
    heightCm: number | null;
    phone: string | null;
    medicalHistory: string | null;
  } | null;
  records: MedicalRecord[];
};

export type DoctorPatientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  dateOfBirth: string | null;
  mostRecentAppointment: string | null;
  matchReasons: string[];
};
