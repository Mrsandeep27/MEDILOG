"use client";

import { FileText, TestTube, Syringe, Receipt, Hospital, File, FolderOpen } from "lucide-react";
import { RECORD_TYPE_LABELS } from "@/constants/config";
import type { HealthRecord } from "@/lib/db/schema";

const TYPE_ICONS: Record<string, React.ElementType> = {
  prescription: FileText,
  lab_report: TestTube,
  vaccination: Syringe,
  bill: Receipt,
  discharge_summary: Hospital,
  other: File,
};

interface RecordTimelineProps {
  records: HealthRecord[];
  onRecordClick?: (record: HealthRecord) => void;
}

export function RecordTimeline({ records, onRecordClick }: RecordTimelineProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No records in timeline</p>
      </div>
    );
  }

  const grouped = groupByMonth(records);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([month, monthRecords]) => (
        <div key={month}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background py-1">
            {month}
          </h3>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            {monthRecords.map((record) => {
              const Icon = TYPE_ICONS[record.type] || File;
              const visitDate = record.visit_date?.trim();
              const date = visitDate
                ? new Date(visitDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : "";

              return (
                <div
                  key={record.id}
                  className="relative cursor-pointer group"
                  onClick={() => onRecordClick?.(record)}
                >
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <div className="bg-card rounded-lg p-3 border group-hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {RECORD_TYPE_LABELS[record.type]}
                      </span>
                      {date && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {date}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-sm">{record.title}</p>
                    {record.doctor_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dr. {record.doctor_name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByMonth(records: HealthRecord[]): Record<string, HealthRecord[]> {
  const groups: Record<string, HealthRecord[]> = {};
  for (const record of records) {
    const rawDate = record.visit_date?.trim() || record.created_at;
    const date = new Date(rawDate);
    // Guard against Invalid Date
    const key = isNaN(date.getTime())
      ? "Unknown Date"
      : date.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        });
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }
  return groups;
}
