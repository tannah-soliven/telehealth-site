import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { fetchProfileForRole } from "@/lib/profile";
import { getUser, type UserRole } from "@/lib/auth";

type ProfileCompletionContextValue = {
  loading: boolean;
  profileComplete: boolean;
  refreshProfile: () => Promise<boolean>;
};

const ProfileCompletionContext = createContext<ProfileCompletionContextValue | null>(null);

export function ProfileCompletionProvider({ children }: { children: ReactNode }) {
  const user = getUser();
  const role = user?.role as UserRole | undefined;

  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  const refreshProfile = useCallback(async (): Promise<boolean> => {
    if (!role || (role !== "patient" && role !== "doctor")) {
      setProfileComplete(false);
      setLoading(false);
      return false;
    }

    setLoading(true);
    try {
      const { complete } = await fetchProfileForRole(role);
      setProfileComplete(complete);
      return complete;
    } catch {
      setProfileComplete(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({ loading, profileComplete, refreshProfile }),
    [loading, profileComplete, refreshProfile]
  );

  return (
    <ProfileCompletionContext.Provider value={value}>
      {children}
    </ProfileCompletionContext.Provider>
  );
}

export function useProfileCompletion(): ProfileCompletionContextValue {
  const ctx = useContext(ProfileCompletionContext);
  if (!ctx) {
    throw new Error("useProfileCompletion must be used within ProfileCompletionProvider");
  }
  return ctx;
}
