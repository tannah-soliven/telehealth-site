import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { ApiError, apiFetch } from "@/lib/api";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  weightKg: z.string().optional(),
  heightCm: z.string().optional(),
  phone: z.string().optional(),
  medicalHistory: z.string().optional()
});

type ProfileValues = z.infer<typeof profileSchema>;

type PatientProfile = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  weightKg: number | null;
  heightCm: number | null;
  phone: string | null;
  medicalHistory: string | null;
  email?: string;
  avatarUrl: string | null;
};

export default function PatientProfilePage() {
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
        const data = await apiFetch<PatientProfile>("/api/patient/profile");
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
      await apiFetch<PatientProfile>("/api/patient/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          dateOfBirth: values.dateOfBirth || null,
          weightKg: values.weightKg ? Number(values.weightKg) : null,
          heightCm: values.heightCm ? Number(values.heightCm) : null,
          phone: values.phone || null,
          medicalHistory: values.medicalHistory || null
        })
      });
      setSaveMessage("Profile saved successfully.");
    } catch (e) {
      setSaveMessage(e instanceof ApiError ? e.message : "Failed to save profile");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit profile</CardTitle>
        <CardDescription>Update your personal and medical information</CardDescription>
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
                    <Input type="tel" placeholder="+1 555 000 0000" {...field} />
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
