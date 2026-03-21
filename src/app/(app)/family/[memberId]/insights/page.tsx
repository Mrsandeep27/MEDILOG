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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const { metrics, addMetric, deleteMetric } = useHealthMetrics(
    memberId,
    selectedType
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  if (memberLoading) {
    return (
      <div>
        <AppHeader title="Insights" showBack />
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

  return (
    <div>
      <AppHeader
        title={`${member?.name || ""}'s Health Insights`}
        showBack
        rightAction={
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger
              render={<Button size="sm" />}
            >
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
                    <Label>
                      {field.label} ({config.unit})
                    </Label>
                    <Input
                      type="number"
                      min={field.min}
                      max={field.max}
                      value={formValues[field.key] || ""}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={`${field.min} - ${field.max}`}
                    />
                  </div>
                ))}
                <Button className="w-full" onClick={handleAddMetric}>
                  Save
                </Button>
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
              <Badge
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                className="cursor-pointer shrink-0 gap-1"
                onClick={() => setSelectedType(type)}
              >
                <TypeIcon className="h-3 w-3" />
                {METRIC_CONFIG[type].label}
              </Badge>
            );
          })}
        </div>

        {/* Latest Reading */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div
                className="rounded-full p-3"
                style={{ backgroundColor: config.color + "20" }}
              >
                <Icon className="h-6 w-6" style={{ color: config.color }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Latest {config.label}
                </p>
                <p className="text-2xl font-bold">
                  {getLatestValue() || "--"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {config.unit}
                  </span>
                </p>
              </div>
              {metrics.length > 0 && (
                <div className="ml-auto text-xs text-muted-foreground">
                  {new Date(metrics[0].recorded_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chart area */}
        {metrics.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trend ({metrics.length} readings)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40 flex items-end gap-1">
                {metrics
                  .slice(0, 20)
                  .reverse()
                  .map((metric, i) => {
                    const firstField = config.fields[0];
                    const val = metric.value[firstField.key] || 0;
                    const pct =
                      ((val - firstField.min) /
                        (firstField.max - firstField.min)) *
                      100;
                    return (
                      <div
                        key={metric.id}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(pct, 5)}%`,
                          backgroundColor: config.color,
                          opacity: 0.5 + (i / 20) * 0.5,
                        }}
                        title={`${formatMetricValue(metric.value)} ${config.unit} - ${new Date(
                          metric.recorded_at
                        ).toLocaleDateString("en-IN")}`}
                      />
                    );
                  })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>
                  {new Date(
                    metrics[Math.min(metrics.length - 1, 19)].recorded_at
                  ).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </span>
                <span>
                  {new Date(metrics[0].recorded_at).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">History</CardTitle>
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
              <div className="space-y-2">
                {metrics.slice(0, 30).map((metric) => (
                  <div
                    key={metric.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {formatMetricValue(metric.value)} {config.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(metric.recorded_at).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={async () => {
                        try {
                          await deleteMetric(metric.id);
                          toast.success("Reading deleted");
                        } catch {
                          toast.error("Failed to delete reading");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
