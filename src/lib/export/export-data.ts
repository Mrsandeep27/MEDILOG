"use client";

import { db } from "@/lib/db/dexie";

export interface ExportData {
  exportedAt: string;
  version: "1.0";
  members: unknown[];
  records: unknown[];
  medicines: unknown[];
  reminders: unknown[];
  reminderLogs: unknown[];
  healthMetrics: unknown[];
}

export async function exportAllData(): Promise<ExportData> {
  const [members, records, medicines, reminders, reminderLogs, healthMetrics] =
    await Promise.all([
      db.members.filter((m) => !m.is_deleted).toArray(),
      db.records.filter((r) => !r.is_deleted).toArray(),
      db.medicines.filter((m) => !m.is_deleted).toArray(),
      db.reminders.filter((r) => !r.is_deleted).toArray(),
      db.reminderLogs.toArray(),
      db.healthMetrics.filter((m) => !m.is_deleted).toArray(),
    ]);

  // Remove blobs from records for JSON export
  const cleanRecords = records.map(({ local_image_blobs, ...rest }) => rest);

  return {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    members,
    records: cleanRecords,
    medicines,
    reminders,
    reminderLogs,
    healthMetrics,
  };
}

export function downloadJSON(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(blob, `medilog-export-${new Date().toISOString().split("T")[0]}.json`);
}

export function downloadCSV(data: ExportData): void {
  const rows: string[][] = [];

  // Header
  rows.push([
    "Member",
    "Record Type",
    "Title",
    "Doctor",
    "Hospital",
    "Visit Date",
    "Diagnosis",
    "Notes",
  ]);

  const memberMap = Object.fromEntries(
    (data.members as Array<{ id: string; name: string }>).map((m) => [m.id, m.name])
  );

  for (const record of data.records as Array<{
    member_id: string;
    type: string;
    title: string;
    doctor_name?: string;
    hospital_name?: string;
    visit_date?: string;
    diagnosis?: string;
    notes?: string;
  }>) {
    rows.push([
      sanitizeCSVCell(memberMap[record.member_id] || ""),
      sanitizeCSVCell(record.type),
      sanitizeCSVCell(record.title),
      sanitizeCSVCell(record.doctor_name || ""),
      sanitizeCSVCell(record.hospital_name || ""),
      sanitizeCSVCell(record.visit_date || ""),
      sanitizeCSVCell(record.diagnosis || ""),
      sanitizeCSVCell((record.notes || "").replace(/\n/g, " ")),
    ]);
  }

  // Add UTF-8 BOM for Excel compatibility with Hindi text
  const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `medilog-records-${new Date().toISOString().split("T")[0]}.csv`);
}

/** Prevent CSV formula injection */
function sanitizeCSVCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Delay revoke to let browser start the download
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
