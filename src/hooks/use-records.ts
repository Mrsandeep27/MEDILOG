"use client";

import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { HealthRecord, RecordType } from "@/lib/db/schema";
import { useAuthStore } from "@/stores/auth-store";
import type { RecordFormData } from "@/lib/utils/validators";
import { MAX_IMAGES_PER_RECORD } from "@/constants/config";

export function useRecords(memberId?: string) {
  const user = useAuthStore((s) => s.user);

  const records = useLiveQuery(
    () => {
      if (!user) return [];
      return db.records
        .filter((r) => !r.is_deleted && (memberId ? r.member_id === memberId : true))
        .toArray()
        .then((rs) => rs.sort((a, b) =>
          new Date(b.visit_date || b.created_at).getTime() -
          new Date(a.visit_date || a.created_at).getTime()
        ));
    },
    [user?.id, memberId]
  );

  const addRecord = async (
    data: RecordFormData,
    images?: File[]
  ): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const id = uuidv4();
    const now = new Date().toISOString();

    const imageBlobs: Blob[] = [];

    if (images && images.length > 0) {
      for (const img of images) {
        const compressed = await compressImage(img);
        imageBlobs.push(compressed);
      }
    }

    const record: HealthRecord = {
      id,
      member_id: data.member_id,
      type: data.type as RecordType,
      title: data.title,
      doctor_name: data.doctor_name,
      hospital_name: data.hospital_name,
      visit_date: data.visit_date,
      diagnosis: data.diagnosis,
      notes: data.notes,
      image_urls: [],
      local_image_blobs: imageBlobs,
      tags: data.tags,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };

    await db.records.add(record);
    return id;
  };

  const updateRecord = async (
    id: string,
    data: Partial<RecordFormData>,
    newImages?: File[]
  ): Promise<void> => {
    const existing = await db.records.get(id);
    if (!existing) throw new Error("Record not found");

    const updateData: Partial<HealthRecord> = {
      ...data,
      type: data.type as RecordType | undefined,
      updated_at: new Date().toISOString(),
      sync_status: "pending" as const,
    };

    if (newImages && newImages.length > 0) {
      const existingBlobs = existing.local_image_blobs || [];
      const remaining = MAX_IMAGES_PER_RECORD - existingBlobs.length;
      if (remaining <= 0) {
        throw new Error(`Maximum ${MAX_IMAGES_PER_RECORD} images per record`);
      }
      const imagesToAdd = newImages.slice(0, remaining);
      const newBlobs = await Promise.all(imagesToAdd.map(compressImage));
      updateData.local_image_blobs = [...existingBlobs, ...newBlobs];
    }

    await db.records.update(id, updateData);
  };

  const deleteRecord = async (id: string): Promise<void> => {
    await db.records.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  const searchRecords = async (query: string): Promise<HealthRecord[]> => {
    const q = query.toLowerCase();
    return db.records
      .filter(
        (r) =>
          !r.is_deleted &&
          (r.title.toLowerCase().includes(q) ||
            (r.doctor_name?.toLowerCase().includes(q) ?? false) ||
            (r.hospital_name?.toLowerCase().includes(q) ?? false) ||
            (r.diagnosis?.toLowerCase().includes(q) ?? false) ||
            (r.notes?.toLowerCase().includes(q) ?? false) ||
            (r.tags?.some((t) => t.toLowerCase().includes(q)) ?? false))
      )
      .toArray();
  };

  return {
    records: records ?? [],
    isLoading: records === undefined,
    addRecord,
    updateRecord,
    deleteRecord,
    searchRecords,
  };
}

export function useRecord(id: string) {
  const record = useLiveQuery(() => db.records.get(id), [id]);
  return { record, isLoading: record === undefined };
}

/**
 * Get blob URLs on-demand from local_image_blobs (survives page reload).
 * IMPORTANT: Caller must revoke returned URLs when done (use useRecordImageUrls hook).
 */
export function getRecordImageUrls(record: HealthRecord): string[] {
  if (record.local_image_blobs && record.local_image_blobs.length > 0) {
    return record.local_image_blobs.map((blob) => URL.createObjectURL(blob));
  }
  return record.image_urls || [];
}

/** Hook that creates blob URLs and auto-revokes them on unmount/change */
export function useRecordImageUrls(record: HealthRecord | undefined): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Revoke previous URLs
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));

    if (!record) {
      urlsRef.current = [];
      setUrls([]);
      return;
    }

    if (record.local_image_blobs && record.local_image_blobs.length > 0) {
      const newUrls = record.local_image_blobs.map((blob) => URL.createObjectURL(blob));
      urlsRef.current = newUrls;
      setUrls(newUrls);
    } else {
      urlsRef.current = [];
      setUrls(record.image_urls || []);
    }

    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [record?.id, record?.updated_at]);

  return urls;
}

async function compressImage(file: File | Blob, maxSizeKB = 500): Promise<Blob> {
  const timeoutMs = 15000;
  return Promise.race([
    new Promise<Blob>((_, reject) =>
      setTimeout(() => reject(new Error("Image compression timed out")), timeoutMs)
    ),
    new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image. The file may be corrupt or not an image."));
    };

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width === 0 || height === 0) {
        resolve(new Blob([], { type: "image/jpeg" }));
        return;
      }

      const MAX_DIM = 1920;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file instanceof Blob ? file : new Blob());
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob && (blob.size / 1024 > maxSizeKB) && quality > 0.2) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(blob || new Blob());
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryCompress();
    };
    img.src = url;
  }),
  ]);
}
