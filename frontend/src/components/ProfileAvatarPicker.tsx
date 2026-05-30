import { User } from "lucide-react";
import { useRef, useState } from "react";

import { ApiError, uploadProfilePicture } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  avatarUrl: string | null;
  firstName?: string;
  lastName?: string;
  onUploaded: (url: string) => void;
};

function initials(firstName?: string, lastName?: string): string {
  const a = firstName?.trim().charAt(0) ?? "";
  const b = lastName?.trim().charAt(0) ?? "";
  return (a + b).toUpperCase() || "?";
}

export function ProfileAvatarPicker({ avatarUrl, firstName, lastName, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadProfilePicture(file);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted transition hover:border-primary hover:ring-2 hover:ring-primary/20",
          uploading && "opacity-60"
        )}
        aria-label="Change profile picture"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
            <User className="h-8 w-8" />
            <span className="mt-1 text-xs font-medium">{initials(firstName, lastName)}</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-xs text-muted-foreground">
        {uploading ? "Uploading…" : "Click photo to upload (max 5 MB)"}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
