"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Plus,
  TrendingUp,
  Droplets,
  Weight,
  Thermometer,
  Heart,
  Trash2,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppHeader } from "@/components/layout/app-header";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { EmptyState } from "@/components/common/empty-state";
import { useMember } from "@/hooks/use-members";
import {
  useHealthMetrics,
  METRIC_CONFIG,
  getHealthStatus,
  calculateBMI,
} from "@/hooks/use-health-metrics";
import type { MetricType } from "@/lib/db/schema";

const METRIC_ICONS: Record<MetricType, React.ElementType> = {
  bp: Heart,
  sugar: Droplets,
  weight: Weight,
  temperature: Thermometer,
  spo2: Activity,
};

export default function InsightsPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = use(params);
  const { member, isLoading: memberLoading } = useMember(memberId);
  const [selectedType, setSelectedType] = useState<MetricType>("bp");
  const { metrics, addMetric, deleteMetric } = useHealthMetrics(memberId, selectedType);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBmiDialog, setShowBmiDialog] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [bmiHeight, setBmiHeight] = useState("");

  if (memberLoading) {
    return (
      <div>
        <AppHeader title="Health Insights" showBack />
        <LoadingSpinner className="py-12" />
      </div>
    );
  }

  const config = METRIC_CONFIG[selectedType];
  const Icon = METRIC_ICONS[selectedType];

  const handleAddMetric = async () => {
    const value: Record<string, number> = {};
    for (const field of config.fields) {
      if (!formValues[field.key]?.trim()) {
        toast.error(`Please enter a value for ${field.label}`);
        return;
      }
      const v = parseFloat(formValues[field.key]);
      if (isNaN(v) || v < field.min || v > field.max) {
        toast.error(`${field.label} must be between ${field.min} and ${field.max}`);
        return;
      }
      value[field.key] = v;
    }

    try {
      await addMetric({
        member_id: memberId,
        type: selectedType,
        value,
        recorded_at: new Date().toISOString(),
      });
      toast.success(`${config.label} recorded`);
      setShowAddDialog(false);
      setFormValues({});
    } catch {
      toast.error("Failed to save reading");
    }
  };

  const formatMetricValue = (value: Record<string, number>): string => {
    if (selectedType === "bp") {
      return `${value.systolic || 0}/${value.diastolic || 0}`;
    }
    const firstKey = config.fields[0].key;
    return `${value[firstKey] || 0}`;
  };

  const getLatestValue = (): string | null => {
    if (metrics.length === 0) return null;
    return formatMetricValue(metrics[0].value);
  };

  const latestStatus = metrics.length > 0 ? getHealthStatus(selectedType, metrics[0].value) : null;

  // BMI from latest weight
  const bmiResult = selectedType === "weight" && metrics.length > 0 && bmiHeight
    ? calculateBMI(metrics[0].value.weight, parseFloat(bmiHeight))
    : null;

  return (
    <div>
      <AppHeader
        title={`${member?.name || ""}'s Health`}
        showBack
        rightAction={
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="h-4 w-4 mr-1" />
              Log
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log {config.label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {config.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>{field.label} ({config.unit})</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={field.min}
                      max={field.max}
                      value={formValues[field.key] || ""}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={`${field.min} - ${field.max}`}
                    />
                  </div>
                ))}
                <Button className="w-full" onClick={handleAddMetric}>Save Reading</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 space-y-4">
        {/* Metric Type Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(Object.keys(METRIC_CONFIG) as MetricType[]).map((type) => {
            const TypeIcon = METRIC_ICONS[type];
            return (
              <button
                key={type}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedType === type
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={selectedType === type ? { backgroundColor: METRIC_CONFIG[type].color } : {}}
                onClick={() => setSelectedType(type)}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                {METRIC_CONFIG[type].label}
              </button>
            );
          })}
        </div>

        {/* Latest Reading Card */}
        <Card className="overflow-hidden">
          <div className="h-1" style={{ backgroundColor: config.color }} />
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full p-3" style={{ backgroundColor: config.color + "20" }}>
                <Icon className="h-6 w-6" style={{ color: config.color }} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Latest {config.label}</p>
                <p className="text-2xl font-bold">
                  {getLatestValue() || "--"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{config.unit}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Normal: {config.normalRange} {config.unit}
                </p>
              </div>
              <div className="text-right space-y-1">
                {latestStatus && (
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${latestStatus.color} ${latestStatus.bg}`}>
                    {latestStatus.label}
                  </span>
                )}
                {metrics.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(metrics[0].recorded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BMI Calculator (only for weight tab) */}
        {selectedType === "weight" && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2.5 bg-blue-100">
                  <Calculator className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">BMI Calculator</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Height (cm)"
                      value={bmiHeight}
                      onChange={(e) => setBmiHeight(e.target.value)}
                      className="h-8 text-sm w-28"
                    />
                    {bmiResult && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bmiResult.color} ${bmiResult.bg}`}>
                        BMI {bmiResult.bmi} — {bmiResult.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend Chart */}
        {metrics.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trend ({metrics.length} readings)
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="h-36 flex items-end gap-[3px]">
                {metrics
                  .slice(0, 20)
                  .reverse()
                  .map((metric, i, arr) => {
                    const firstField = config.fields[0];
                    const val = metric.value[firstField.key] || 0;
                    const pct = ((val - firstField.min) / (firstField.max - firstField.min)) * 100;
                    const status = getHealthStatus(selectedType, metric.value);
                    const barColor =
                      status.status === "normal" ? "#22c55e" :
                      status.status === "high" ? "#f97316" :
                      status.status === "critical" ? "#ef4444" : "#eab308";
                    return (
                      <div
                        key={metric.id}
                        className="flex-1 rounded-t transition-all relative group"
                        style={{
                          height: `${Math.max(pct, 8)}%`,
                          backgroundColor: barColor,
                          opacity: 0.6 + (i / arr.length) * 0.4,
                        }}
                        title={`${formatMetricValue(metric.value)} ${config.unit} — ${status.label}`}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded hidden group-hover:block whitespace-nowrap">
                          {formatMetricValue(metric.value)}
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>
                  {new Date(metrics[Math.min(metrics.length - 1, 19)].recorded_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </span>
                <span>
                  {new Date(metrics[0].recorded_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        {metrics.length >= 3 && (
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const firstKey = config.fields[0].key;
              const values = metrics.map((m) => m.value[firstKey] || 0);
              const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
              const min = Math.min(...values);
              const max = Math.max(...values);
              return (
                <>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Average</p>
                    <p className="text-lg font-bold">{avg}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Lowest</p>
                    <p className="text-lg font-bold text-blue-600">{min}</p>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">Highest</p>
                    <p className="text-lg font-bold text-red-600">{max}</p>
                  </CardContent></Card>
                </>
              );
            })()}
          </div>
        )}

        {/* History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">History</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={`No ${config.label.toLowerCase()} readings`}
                description={`Tap "Log" to record a ${config.label.toLowerCase()} reading`}
                className="py-6"
              />
            ) : (
              <div className="space-y-1">
                {metrics.slice(0, 30).map((metric) => {
                  const status = getHealthStatus(selectedType, metric.value);
                  return (
                    <div
                      key={metric.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          status.status === "normal" ? "bg-green-500" :
                          status.status === "high" ? "bg-orange-500" :
                          status.status === "critical" ? "bg-red-500" : "bg-yellow-500"
                        }`} />
                        <div>
                          <p className="font-medium text-sm">
                            {formatMetricValue(metric.value)}{" "}
                            <span className="text-xs text-muted-foreground">{config.unit}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(metric.recorded_at).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>
                          {status.label}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={async () => {
                            try {
                              await deleteMetric(metric.id);
                              toast.success("Deleted");
                            } catch {
                              toast.error("Failed to delete");
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
