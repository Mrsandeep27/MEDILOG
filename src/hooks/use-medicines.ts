"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { Medicine, Frequency } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";

export interface MedicineFormData {
  record_id: string;
  member_id: string;
  name: string;
  dosage?: string;
  frequency?: Frequency;
  duration?: string;
  before_food: boolean;
  start_date?: string;
  end_date?: string;
}

export function useMedicines(memberId?: string, recordId?: string) {
  const user = useAuthStore((s) => s.user);
  const medicines = useLiveQuery(
    () => {
      return db.medicines
        .filter(
          (m) =>
            !m.is_deleted &&
            (memberId ? m.member_id === memberId : true) &&
            (recordId ? m.record_id === recordId : true)
        )
        .toArray();
    },
    [memberId, recordId]
  );

  const activeMedicines = useLiveQuery(
    () => {
      if (!memberId) return [];
      return db.medicines
        .filter((m) => !m.is_deleted && m.member_id === memberId && m.is_active)
        .toArray();
    },
    [memberId]
  );

  const addMedicine = async (data: MedicineFormData): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const id = uuidv4();
    const now = new Date().toISOString();
    const medicine: Medicine = {
      id,
      record_id: data.record_id,
      member_id: data.member_id,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      duration: data.duration,
      before_food: data.before_food,
      start_date: data.start_date,
      end_date: data.end_date,
      is_active: true,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.medicines.add(medicine);
    return id;
  };

  const updateMedicine = async (
    id: string,
    data: Partial<MedicineFormData & { is_active: boolean }>
  ): Promise<void> => {
    await db.medicines.update(id, {
      ...data,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const deleteMedicine = async (id: string): Promise<void> => {
    await db.medicines.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  return {
    medicines: medicines ?? [],
    activeMedicines: activeMedicines ?? [],
    isLoading: medicines === undefined,
    addMedicine,
    updateMedicine,
    deleteMedicine,
  };
}
