"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

export interface FamilyGroupMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  joined_at: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  invite_code: string;
  role: "admin" | "member";
  created_by: string;
  members: FamilyGroupMember[];
}

export function useFamilyGroup() {
  const user = useAuthStore((s) => s.user);
  const [families, setFamilies] = useState<FamilyGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFamilies = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/family", { headers });
      if (res.ok) {
        const data = await res.json();
        setFamilies(data.families || []);
      }
    } catch (err) {
      console.error("Failed to fetch families:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  const createFamily = async (name: string): Promise<FamilyGroup | null> => {
    if (!user) return null;
    const headers = await getAuthHeaders();
    const res = await fetch("/api/family", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "create", name }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create family");
    }

    const { family } = await res.json();
    setFamilies((prev) => [...prev, family]);
    return family;
  };

  const joinFamily = async (inviteCode: string): Promise<FamilyGroup | null> => {
    if (!user) return null;
    const headers = await getAuthHeaders();
    const res = await fetch("/api/family", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "join", invite_code: inviteCode }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to join family");
    }

    const { family } = await res.json();
    setFamilies((prev) => [...prev, family]);
    return family;
  };

  const leaveFamily = async (familyId: string): Promise<void> => {
    if (!user) return;
    const headers = await getAuthHeaders();
    const res = await fetch("/api/family", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "leave", family_id: familyId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to leave family");
    }

    setFamilies((prev) => prev.filter((f) => f.id !== familyId));
  };

  // Get all member user IDs from all family groups (for querying shared data)
  const familyUserIds = Array.from(
    new Set(families.flatMap((f) => f.members.map((m) => m.user_id)))
  );

  return {
    families,
    isLoading,
    createFamily,
    joinFamily,
    leaveFamily,
    refreshFamilies: fetchFamilies,
    familyUserIds,
  };
}
