"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/dexie";
import type { HealthMetric, MetricType } from "@/lib/db/schema";

export interface MetricFormData {
  member_id: string;
  type: MetricType;
  value: Record<string, number>;
  recorded_at: string;
  notes?: string;
}

export function useHealthMetrics(memberId?: string, type?: MetricType) {
  const metrics = useLiveQuery(
    () =>
      db.healthMetrics
        .filter(
          (m) =>
            !m.is_deleted &&
            (memberId ? m.member_id === memberId : true) &&
            (type ? m.type === type : true)
        )
        .toArray()
        .then((ms) =>
          ms.sort(
            (a, b) =>
              new Date(b.recorded_at).getTime() -
              new Date(a.recorded_at).getTime()
          )
        ),
    [memberId, type]
  );

  const addMetric = async (data: MetricFormData): Promise<string> => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const metric: HealthMetric = {
      id,
      member_id: data.member_id,
      type: data.type,
      value: data.value,
      recorded_at: data.recorded_at || now,
      notes: data.notes,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      is_deleted: false,
    };
    await db.healthMetrics.add(metric);
    return id;
  };

  const deleteMetric = async (id: string): Promise<void> => {
    await db.healthMetrics.update(id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });
  };

  return {
    metrics: metrics ?? [],
    isLoading: metrics === undefined,
    addMetric,
    deleteMetric,
  };
}

// ─── Normal ranges for health status ─────────────────────────────────────────
export type HealthStatus = "normal" | "low" | "high" | "critical";

interface RangeConfig {
  low?: number;
  normalLow: number;
  normalHigh: number;
  high?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

const RANGES: Record<string, RangeConfig> = {
  "bp.systolic":   { criticalLow: 80, low: 90, normalLow: 90, normalHigh: 120, high: 140, criticalHigh: 180 },
  "bp.diastolic":  { criticalLow: 50, low: 60, normalLow: 60, normalHigh: 80, high: 90, criticalHigh: 120 },
  "sugar.level":   { criticalLow: 50, low: 70, normalLow: 70, normalHigh: 140, high: 200, criticalHigh: 300 },
  "weight.weight": { normalLow: 30, normalHigh: 120 },
  "temperature.temp": { low: 95, normalLow: 97, normalHigh: 99.5, high: 100.4, criticalHigh: 104 },
  "spo2.level":    { criticalLow: 90, low: 94, normalLow: 95, normalHigh: 100 },
};

export function getHealthStatus(type: MetricType, value: Record<string, number>): { status: HealthStatus; label: string; color: string; bg: string } {
  const config = METRIC_CONFIG[type];
  let worstStatus: HealthStatus = "normal";

  for (const field of config.fields) {
    const key = `${type}.${field.key}`;
    const range = RANGES[key];
    if (!range) continue;
    const v = value[field.key];
    if (v === undefined) continue;

    let s: HealthStatus = "normal";
    if ((range.criticalLow !== undefined && v <= range.criticalLow) ||
        (range.criticalHigh !== undefined && v >= range.criticalHigh)) {
      s = "critical";
    } else if ((range.low !== undefined && v < range.normalLow) ||
               (range.high !== undefined && v > range.normalHigh)) {
      s = v < range.normalLow ? "low" : "high";
    }

    if (s === "critical") worstStatus = "critical";
    else if (s !== "normal" && worstStatus !== "critical") worstStatus = s;
  }

  const map = {
    normal:   { label: "Normal",   color: "text-green-700",  bg: "bg-green-100" },
    low:      { label: "Low",      color: "text-yellow-700", bg: "bg-yellow-100" },
    high:     { label: "High",     color: "text-orange-700", bg: "bg-orange-100" },
    critical: { label: "Critical", color: "text-red-700",    bg: "bg-red-100" },
  };

  return { status: worstStatus, ...map[worstStatus] };
}

// ─── BMI calculator ──────────────────────────────────────────────────────────
export function calculateBMI(weightKg: number, heightCm: number): { bmi: number; status: string; color: string; bg: string } {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const rounded = Math.round(bmi * 10) / 10;

  if (rounded < 18.5) return { bmi: rounded, status: "Underweight", color: "text-yellow-700", bg: "bg-yellow-100" };
  if (rounded < 25) return { bmi: rounded, status: "Normal", color: "text-green-700", bg: "bg-green-100" };
  if (rounded < 30) return { bmi: rounded, status: "Overweight", color: "text-orange-700", bg: "bg-orange-100" };
  return { bmi: rounded, status: "Obese", color: "text-red-700", bg: "bg-red-100" };
}

// ─── Metric config ───────────────────────────────────────────────────────────
export const METRIC_CONFIG: Record<
  MetricType,
  {
    label: string;
    unit: string;
    fields: { key: string; label: string; min: number; max: number }[];
    color: string;
    normalRange: string;
  }
> = {
  bp: {
    label: "Blood Pressure",
    unit: "mmHg",
    fields: [
      { key: "systolic", label: "Systolic", min: 60, max: 250 },
      { key: "diastolic", label: "Diastolic", min: 40, max: 150 },
    ],
    color: "#ef4444",
    normalRange: "90-120 / 60-80",
  },
  sugar: {
    label: "Blood Sugar",
    unit: "mg/dL",
    fields: [{ key: "level", label: "Level", min: 30, max: 500 }],
    color: "#f59e0b",
    normalRange: "70-140",
  },
  weight: {
    label: "Weight",
    unit: "kg",
    fields: [{ key: "weight", label: "Weight", min: 1, max: 300 }],
    color: "#3b82f6",
    normalRange: "BMI 18.5-24.9",
  },
  temperature: {
    label: "Temperature",
    unit: "°F",
    fields: [{ key: "temp", label: "Temperature", min: 90, max: 110 }],
    color: "#8b5cf6",
    normalRange: "97.0-99.5",
  },
  spo2: {
    label: "SpO2",
    unit: "%",
    fields: [{ key: "level", label: "Level", min: 70, max: 100 }],
    color: "#06b6d4",
    normalRange: "95-100",
  },
};
