import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProfileAvatarPicker } from "@/components/ProfileAvatarPicker";
import { useProfileCompletion } from "@/contexts/ProfileCompletionContext";
import { ApiError, apiFetch } from "@/lib/api";
import { dashboardPathForRole } from "@/lib/auth";
import { isPatientProfileComplete, type PatientProfileData } from "@/lib/profile";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  weightKg: z
    .string()
    .min(1, "Weight is required")
    .refine((v) => Number(v) > 0, "Enter a valid weight"),
  heightCm: z
    .string()
    .min(1, "Height is required")
    .refine((v) => Number(v) > 0, "Enter a valid height"),
  phone: z.string().min(1, "Contact phone is required"),
  medicalHistory: z.string().optional()
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function PatientProfilePage() {
  const navigate = useNavigate();
  const { refreshProfile, profileComplete } = useProfileCompletion();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      weightKg: "",
      heightCm: "",
      phone: "",
      medicalHistory: ""
    }
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<PatientProfileData>("/api/patient/profile");
        setAvatarUrl(data.avatarUrl ?? null);
        form.reset({
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ?? "",
          weightKg: data.weightKg != null ? String(data.weightKg) : "",
          heightCm: data.heightCm != null ? String(data.heightCm) : "",
          phone: data.phone ?? "",
          medicalHistory: data.medicalHistory ?? ""
        });
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : "Failed to load profile");
      }
    }
    void load();
  }, []);

  async function onSubmit(values: ProfileValues) {
    setSaveMessage(null);
    try {
      const data = await apiFetch<PatientProfileData>("/api/patient/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          dateOfBirth: values.dateOfBirth,
          weightKg: Number(values.weightKg),
          heightCm: Number(values.heightCm),
          phone: values.phone,
          medicalHistory: values.medicalHistory || null
        })
      });

      if (isPatientProfileComplete(data)) {
        await refreshProfile();
        setSaveMessage("Profile saved successfully.");
        navigate(dashboardPathForRole("patient"), { replace: true });
      } else {
        await refreshProfile();
        setSaveMessage("Please fill in all required fields.");
      }
    } catch (e) {
      setSaveMessage(e instanceof ApiError ? e.message : "Failed to save profile");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
        <CardDescription>
          {profileComplete
            ? "Update your personal and medical information"
            : "Complete all required fields to access the patient portal"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadError ? <p className="mb-4 text-sm text-destructive">{loadError}</p> : null}
        <ProfileAvatarPicker
          avatarUrl={avatarUrl}
          firstName={form.watch("firstName")}
          lastName={form.watch("lastName")}
          onUploaded={(url) => {
            setAvatarUrl(url);
            setSaveMessage("Profile picture updated.");
          }}
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of birth</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+63 919 000 0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weightKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (kg)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="heightCm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Height (cm)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medicalHistory"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Medical history</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="Allergies, conditions, medications…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save profile"}
              </Button>
              {saveMessage ? (
                <p className={saveMessage.includes("success") ? "text-sm text-green-600" : "text-sm text-destructive"}>
                  {saveMessage}
                </p>
              ) : null}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
