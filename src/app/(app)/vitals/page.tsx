"use client";

import { useState, useMemo } from "react";
import {
  Heart,
  Droplets,
  Activity,
  Thermometer,
  Wind,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { AppHeader } from "@/components/layout/app-header";
import {
  useHealthMetrics,
  METRIC_CONFIG,
  getHealthStatus,
} from "@/hooks/use-health-metrics";
import { useMembers } from "@/hooks/use-members";
import { useFamilyStore } from "@/stores/family-store";
import { toast } from "sonner";
import type { MetricType } from "@/lib/db/schema";

// ─── Icon map for metric types ──────────────────────────────────────────────
const METRIC_ICONS: Record<MetricType, typeof Heart> = {
  bp: Heart,
  sugar: Droplets,
  weight: Activity,
  temperature: Thermometer,
  spo2: Wind,
};

// ─── Parse normal range string into numeric bounds ──────────────────────────
function parseNormalRange(
  type: MetricType
): { low: number; high: number } | null {
  const rangeStr = METRIC_CONFIG[type].normalRange;
  if (type === "bp") {
    // "90-120 / 60-80" — use systolic range for main band
    const match = rangeStr.match(/(\d+)-(\d+)/);
    if (match) return { low: Number(match[1]), high: Number(match[2]) };
  } else if (type === "weight") {
    return null; // BMI-based, skip band
  } else {
    const match = rangeStr.match(/(\d+\.?\d*)-(\d+\.?\d*)/);
    if (match) return { low: Number(match[1]), high: Number(match[2]) };
  }
  return null;
}

// ─── Format a date string to DD/MM ──────────────────────────────────────────
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── SVG Line Chart ─────────────────────────────────────────────────────────
function SimpleChart({
  data,
  fields,
  color,
  type,
}: {
  data: Array<{ value: Record<string, number>; recorded_at: string }>;
  fields: Array<{ key: string; label: string; min: number; max: number }>;
  color: string;
  type: MetricType;
}) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm font-medium">No readings yet</p>
        <p className="text-xs">Add your first reading to see the trend</p>
      </div>
    );
  }

  // Reverse so oldest is on the left
  const points = [...data].reverse().slice(-20);

  const W = 300;
  const H = 150;
  const PAD_L = 38;
  const PAD_R = 10;
  const PAD_T = 12;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Determine Y min/max from all fields across all data points
  let allValues: number[] = [];
  for (const pt of points) {
    for (const f of fields) {
      const v = pt.value[f.key];
      if (v !== undefined) allValues.push(v);
    }
  }

  const normalRange = parseNormalRange(type);
  if (normalRange) {
    allValues.push(normalRange.low, normalRange.high);
  }

  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const yPad = (dataMax - dataMin) * 0.15 || 5;
  const yMin = Math.floor(dataMin - yPad);
  const yMax = Math.ceil(dataMax + yPad);
  const yRange = yMax - yMin || 1;

  function toX(i: number): number {
    if (points.length === 1) return PAD_L + chartW / 2;
    return PAD_L + (i / (points.length - 1)) * chartW;
  }

  function toY(v: number): number {
    return PAD_T + chartH - ((v - yMin) / yRange) * chartH;
  }

  // Build polyline paths for each field
  const fieldColors =
    fields.length === 2
      ? [color, color + "99"] // e.g. for BP: solid + semi-transparent
      : [color];

  const lines = fields.map((f, fi) => {
    const pts = points
      .map((p, i) => {
        const v = p.value[f.key];
        if (v === undefined) return null;
        return { x: toX(i), y: toY(v), val: v };
      })
      .filter(Boolean) as Array<{ x: number; y: number; val: number }>;

    if (pts.length < 2) {
      // Single point — just render a dot
      return { pts, pathD: "", fieldColor: fieldColors[fi] || color, field: f };
    }

    const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return { pts, pathD, fieldColor: fieldColors[fi] || color, field: f };
  });

  // Y-axis tick marks (3–5 ticks)
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const v = yMin + (yRange / tickCount) * i;
    return Math.round(v * 10) / 10;
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Grid lines */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD_L}
            y1={toY(tick)}
            x2={W - PAD_R}
            y2={toY(tick)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={0.5}
          />
          <text
            x={PAD_L - 4}
            y={toY(tick) + 1.5}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={7}
          >
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Normal range band */}
      {normalRange && (
        <rect
          x={PAD_L}
          y={toY(normalRange.high)}
          width={chartW}
          height={toY(normalRange.low) - toY(normalRange.high)}
          fill={color}
          opacity={0.07}
          rx={2}
        />
      )}

      {/* X-axis date labels */}
      {points.map((p, i) => {
        // Show labels at start, end, and every few points in between
        const showLabel =
          points.length <= 6 ||
          i === 0 ||
          i === points.length - 1 ||
          i % Math.ceil(points.length / 5) === 0;
        if (!showLabel) return null;
        return (
          <text
            key={i}
            x={toX(i)}
            y={H - 4}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={6.5}
          >
            {formatShortDate(p.recorded_at)}
          </text>
        );
      })}

      {/* Lines and dots */}
      {lines.map((line, li) => (
        <g key={li}>
          {/* Line */}
          {line.pathD && (
            <path
              d={line.pathD}
              fill="none"
              stroke={line.fieldColor}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={li === 1 ? 0.5 : 1}
            />
          )}
          {/* Dots */}
          {line.pts.map((pt, pi) => (
            <circle
              key={pi}
              cx={pt.x}
              cy={pt.y}
              r={2.5}
              fill={line.fieldColor}
              opacity={li === 1 ? 0.5 : 1}
              stroke="white"
              strokeWidth={0.8}
            />
          ))}
        </g>
      ))}

      {/* Legend for multi-field (BP) */}
      {fields.length > 1 && (
        <g>
          {fields.map((f, fi) => (
            <g key={fi} transform={`translate(${PAD_L + fi * 80}, ${H - 14})`}>
              <circle cx={0} cy={0} r={2.5} fill={fieldColors[fi] || color} opacity={fi === 1 ? 0.5 : 1} />
              <text
                x={6}
                y={2}
                className="fill-muted-foreground"
                fontSize={6.5}
              >
                {f.label}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ─── Trend indicator ────────────────────────────────────────────────────────
function TrendIndicator({ metrics }: { metrics: Array<{ value: Record<string, number>; recorded_at: string }>; }) {
  if (metrics.length < 2) return null;
  // Compare latest to previous — use the first field
  const latest = metrics[0];
  const prev = metrics[1];
  const firstKey = Object.keys(latest.value)[0];
  if (!firstKey) return null;

  const diff = latest.value[firstKey] - prev.value[firstKey];
  if (Math.abs(diff) < 0.5) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> Stable
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-orange-600">
        <TrendingUp className="h-3 w-3" /> +{Math.round(diff * 10) / 10}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-blue-600">
      <TrendingDown className="h-3 w-3" /> {Math.round(diff * 10) / 10}
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function VitalsPage() {
  const { members } = useMembers();
  const { selectedMemberId, setSelectedMember } = useFamilyStore();
  const [activeType, setActiveType] = useState<MetricType>("bp");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Use selectedMemberId or default to first member (self)
  const effectiveMemberId = useMemo(() => {
    if (selectedMemberId) return selectedMemberId;
    const selfMember = members.find((m) => m.relation === "self");
    return selfMember?.id || members[0]?.id || undefined;
  }, [selectedMemberId, members]);

  const { metrics, addMetric, deleteMetric } = useHealthMetrics(
    effectiveMemberId,
    activeType
  );

  const config = METRIC_CONFIG[activeType];
  const latestMetric = metrics[0] || null;
  const healthStatus = latestMetric
    ? getHealthStatus(activeType, latestMetric.value)
    : null;

  // ─── Add Reading form state ─────────────────────────────────────────────
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formNotes, setFormNotes] = useState("");

  function resetForm() {
    setFormValues({});
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormNotes("");
  }

  async function handleSubmit() {
    if (!effectiveMemberId) {
      toast.error("Please add a family member first");
      return;
    }

    const value: Record<string, number> = {};
    for (const field of config.fields) {
      const raw = formValues[field.key];
      if (!raw || raw.trim() === "") {
        toast.error(`Please enter ${field.label}`);
        return;
      }
      const num = parseFloat(raw);
      if (isNaN(num) || num < field.min || num > field.max) {
        toast.error(
          `${field.label} must be between ${field.min} and ${field.max}`
        );
        return;
      }
      value[field.key] = num;
    }

    try {
      await addMetric({
        member_id: effectiveMemberId,
        type: activeType,
        value,
        recorded_at: new Date(formDate).toISOString(),
        notes: formNotes || undefined,
      });
      toast.success(`${config.label} reading saved`);
      resetForm();
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save reading");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMetric(id);
      toast.success("Reading deleted");
    } catch {
      toast.error("Failed to delete reading");
    }
  }

  // Format the latest value display
  function formatLatestValue(): string {
    if (!latestMetric) return "--";
    if (activeType === "bp") {
      return `${latestMetric.value.systolic || "--"}/${latestMetric.value.diastolic || "--"}`;
    }
    const firstKey = config.fields[0].key;
    const v = latestMetric.value[firstKey];
    return v !== undefined ? String(v) : "--";
  }

  const metricTypes: MetricType[] = ["bp", "sugar", "weight", "temperature", "spo2"];

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader
        title="Vitals"
        showBack
        rightAction={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add {config.label} Reading</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {config.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`field-${field.key}`}>
                      {field.label}{" "}
                      <span className="text-muted-foreground text-xs">
                        ({config.unit})
                      </span>
                    </Label>
                    <Input
                      id={`field-${field.key}`}
                      type="number"
                      placeholder={`${field.min}–${field.max}`}
                      min={field.min}
                      max={field.max}
                      step="any"
                      value={formValues[field.key] || ""}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}

                <div className="space-y-1.5">
                  <Label htmlFor="field-date">Date</Label>
                  <Input
                    id="field-date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="field-notes">Notes (optional)</Label>
                  <Input
                    id="field-notes"
                    type="text"
                    placeholder="e.g. after exercise, fasting..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button onClick={handleSubmit}>Save Reading</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="px-4 py-4 space-y-5">
        {/* ─── Member Filter Badges ──────────────────────────────────── */}
        {members.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setSelectedMember(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !selectedMemberId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedMemberId === m.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {m.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        {/* ─── Metric Type Tabs ──────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {metricTypes.map((t) => {
            const Icon = METRIC_ICONS[t];
            const cfg = METRIC_CONFIG[t];
            const isActive = activeType === t;
            return (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={
                  isActive
                    ? { backgroundColor: cfg.color }
                    : undefined
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* ─── Current Reading Card ──────────────────────────────────── */}
        <Card>
          <CardContent className="py-5">
            {latestMetric ? (
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">
                    Latest {config.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-3xl font-bold"
                      style={{ color: config.color }}
                    >
                      {formatLatestValue()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {config.unit}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {healthStatus && (
                      <Badge
                        variant="secondary"
                        className={`${healthStatus.bg} ${healthStatus.color} border-0 text-[10px]`}
                      >
                        {healthStatus.label}
                      </Badge>
                    )}
                    <TrendIndicator metrics={metrics} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Normal: {config.normalRange} {config.unit}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatFullDate(latestMetric.recorded_at)}
                  </p>
                </div>
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: config.color + "18" }}
                >
                  {(() => {
                    const Icon = METRIC_ICONS[activeType];
                    return (
                      <Icon
                        className="h-6 w-6"
                        style={{ color: config.color }}
                      />
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: config.color + "18" }}
                >
                  {(() => {
                    const Icon = METRIC_ICONS[activeType];
                    return (
                      <Icon
                        className="h-7 w-7"
                        style={{ color: config.color }}
                      />
                    );
                  })()}
                </div>
                <p className="text-sm font-medium">
                  No {config.label} readings
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tap &quot;Add&quot; to record your first reading
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── SVG Trend Chart ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp
                className="h-4 w-4"
                style={{ color: config.color }}
              />
              Trend
              {metrics.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal ml-auto">
                  Last {Math.min(metrics.length, 20)} readings
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <SimpleChart
              data={metrics}
              fields={config.fields}
              color={config.color}
              type={activeType}
            />
          </CardContent>
        </Card>

        {/* ─── History List ──────────────────────────────────────────── */}
        {metrics.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              History
            </h2>
            <div className="space-y-2">
              {metrics.slice(0, 10).map((m) => {
                const status = getHealthStatus(activeType, m.value);
                const displayVal =
                  activeType === "bp"
                    ? `${m.value.systolic || "--"}/${m.value.diastolic || "--"}`
                    : String(m.value[config.fields[0].key] ?? "--");

                return (
                  <Card key={m.id}>
                    <CardContent className="py-3 flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: config.color + "18" }}
                      >
                        {(() => {
                          const Icon = METRIC_ICONS[activeType];
                          return (
                            <Icon
                              className="h-4 w-4"
                              style={{ color: config.color }}
                            />
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {displayVal}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {config.unit}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`${status.bg} ${status.color} border-0 text-[10px]`}
                          >
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatFullDate(m.recorded_at)}
                          {m.notes ? ` — ${m.notes}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
