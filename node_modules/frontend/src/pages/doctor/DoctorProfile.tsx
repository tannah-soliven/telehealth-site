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
import { isDoctorProfileComplete, type DoctorProfileData } from "@/lib/profile";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  specialization: z.string().min(1, "Specialization is required"),
  bio: z.string().min(1, "Bio is required")
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function DoctorProfilePage() {
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
      specialization: "",
      bio: ""
    }
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<DoctorProfileData>("/api/doctor/profile");
        setAvatarUrl(data.avatarUrl ?? null);
        form.reset({
          firstName: data.firstName,
          lastName: data.lastName,
          specialization: data.specialization ?? "",
          bio: data.bio ?? ""
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
      const data = await apiFetch<DoctorProfileData>("/api/doctor/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          specialization: values.specialization,
          bio: values.bio
        })
      });

      if (isDoctorProfileComplete(data)) {
        await refreshProfile();
        setSaveMessage("Profile saved successfully.");
        navigate(dashboardPathForRole("doctor"), { replace: true });
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
            ? "Update your professional information"
            : "Complete all required fields to access the doctor portal"}
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
              name="specialization"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Specialization</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Cardiologist" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder="Tell patients about your experience…" {...field} />
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
