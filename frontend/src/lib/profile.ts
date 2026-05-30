import { apiFetch } from "@/lib/api";
import type { UserRole } from "@/lib/auth";

export type PatientProfileData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  weightKg: number | null;
  heightCm: number | null;
  phone: string | null;
  medicalHistory?: string | null;
  email?: string;
  avatarUrl?: string | null;
};

export type DoctorProfileData = {
  firstName: string;
  lastName: string;
  specialization: string | null;
  bio: string | null;
  email?: string;
  avatarUrl?: string | null;
};

export function isPatientProfileComplete(profile: PatientProfileData): boolean {
  return Boolean(
    profile.firstName?.trim() &&
      profile.lastName?.trim() &&
      profile.dateOfBirth?.trim() &&
      profile.phone?.trim() &&
      profile.weightKg != null &&
      profile.weightKg > 0 &&
      profile.heightCm != null &&
      profile.heightCm > 0
  );
}

export function isDoctorProfileComplete(profile: DoctorProfileData): boolean {
  return Boolean(
    profile.firstName?.trim() &&
      profile.lastName?.trim() &&
      profile.specialization?.trim() &&
      profile.bio?.trim()
  );
}

export function isProfileCompleteForRole(
  role: UserRole,
  profile: PatientProfileData | DoctorProfileData
): boolean {
  if (role === "doctor") {
    return isDoctorProfileComplete(profile as DoctorProfileData);
  }
  return isPatientProfileComplete(profile as PatientProfileData);
}

export async function fetchProfileForRole(role: UserRole): Promise<{
  profile: PatientProfileData | DoctorProfileData;
  complete: boolean;
}> {
  if (role === "doctor") {
    const profile = await apiFetch<DoctorProfileData>("/api/doctor/profile");
    return { profile, complete: isDoctorProfileComplete(profile) };
  }
  const profile = await apiFetch<PatientProfileData>("/api/patient/profile");
  return { profile, complete: isPatientProfileComplete(profile) };
}
