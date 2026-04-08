"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { Member, Relation, BloodGroup, Gender } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import type { MemberFormData } from "@/lib/utils/validators";

export function useMembers() {
  const user = useAuthStore((s) => s.user);

  // Use single-key index + JS filter. The compound form
  // .where({ user_id, is_deleted: false }) is unreliable in Dexie 4
  // because boolean false doesn't index reliably across browsers, and
  // there's no [user_id+is_deleted] compound index in the schema.
  const members = useLiveQuery(
    () =>
      user
        ? db.members
            .where("user_id")
            .equals(user.id)
            .filter((m) => !m.is_deleted)
            .toArray()
        : [],
    [user?.id]
  );

  const getMember = (id: string) =>
    useLiveQuery(() => db.members.get(id), [id]);

  const addMember = async (data: MemberFormData): Promise<string> => {
    if (!user?.id) {
      throw new Error("Please sign in again to add a family member");
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    const member: Member = {
      id,
      user_id: user.id,
      name: data.name.trim(),
      relation: (data.relation || "self") as Relation,
      date_of_birth: data.date_of_birth || undefined,
      blood_group: ((data.blood_group as string) || "") as BloodGroup,
      gender: ((data.gender as string) || "") as Gender,
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
      chronic_conditions: Array.isArray(data.chronic_conditions)
        ? data.chronic_conditions
        : [],
      emergency_contact_name: data.emergency_contact_name || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      avatar_url: undefined,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      synced_at: undefined,
      is_deleted: false,
    };
    await db.members.add(member);
    return id;
  };

  const updateMember = async (
    id: string,
    data: Partial<MemberFormData>
  ): Promise<void> => {
    await db.members.update(id, {
      ...data,
      blood_group: (data.blood_group ?? undefined) as BloodGroup | undefined,
      gender: (data.gender ?? undefined) as Gender | undefined,
      relation: data.relation as Relation | undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const deleteMember = async (id: string): Promise<void> => {
    await db.members.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  return {
    members: members ?? [],
    isLoading: members === undefined,
    getMember,
    addMember,
    updateMember,
    deleteMember,
  };
}

export function useMember(id: string) {
  const member = useLiveQuery(() => db.members.get(id), [id]);
  return { member, isLoading: member === undefined };
}
