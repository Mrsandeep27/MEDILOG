"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  Minus,
  ShieldAlert,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/layout/app-header";
import { toast } from "sonner";

interface LabMarker {
  name: string;
  value: string;
  normal_range: string;
  status: "normal" | "low" | "high" | "critical";
  explanation: string;
  advice: string;
}

interface LabInsight {
  patient_name?: string;
  report_date?: string;
  lab_name?: string;
  markers: LabMarker[];
  summary: string;
  urgent_attention?: string[];
}

const statusConfig = {
  normal: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2, label: "Normal" },
  low: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: ArrowDown, label: "Low" },
  high: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: ArrowUp, label: "High" },
  critical: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: ShieldAlert, label: "Critical" },
};

export default function LabInsightsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [insights, setInsights] = useState<LabInsight | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      analyzeReport(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const analyzeReport = async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/lab-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });

      if (!res.ok) {
        toast.error("Failed to analyze report");
        return;
      }

      const data = await res.json();
      setInsights(data);

      const abnormal = (data.markers || []).filter((m: LabMarker) => m.status !== "normal").length;
      if (abnormal > 0) {
        toast.warning(`${abnormal} marker(s) need attention`);
      } else {
        toast.success("All markers look normal!");
      }
    } catch {
      toast.error("Failed to analyze. Check internet connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    setPreviewUrl(null);
    setInsights(null);
  };

  return (
    <div>
      <AppHeader title="Lab Report Insights" showBack />
      <div className="p-4 space-y-4">
        {/* Upload Section */}
        {!insights && !isAnalyzing && (
          <>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Upload your lab report and AI will explain every marker in simple language —
                    what&apos;s normal, what needs attention, and what to do next.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center py-12">
                <div className="rounded-full bg-primary/10 p-6 mb-4">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Upload Lab Report</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Take a photo or upload an image of your blood test, thyroid, sugar, or any lab report
                </p>
              </CardContent>
            </Card>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
          </>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div className="flex flex-col items-center py-16 space-y-4">
            {previewUrl && (
              <div className="w-24 h-32 rounded-xl overflow-hidden border shadow">
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing your lab report...</p>
            <p className="text-xs text-muted-foreground">Reading markers and checking ranges</p>
          </div>
        )}

        {/* Results */}
        {insights && (
          <>
            {/* Report Header */}
            <Card>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  {previewUrl && (
                    <div className="w-12 h-16 rounded-lg overflow-hidden border shrink-0">
                      <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Lab Report Analysis</h3>
                    </div>
                    {insights.patient_name && (
                      <p className="text-sm text-muted-foreground">Patient: {insights.patient_name}</p>
                    )}
                    {insights.lab_name && (
                      <p className="text-xs text-muted-foreground">{insights.lab_name}</p>
                    )}
                    {insights.report_date && (
                      <p className="text-xs text-muted-foreground">Date: {insights.report_date}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Urgent Attention */}
            {insights.urgent_attention && insights.urgent_attention.length > 0 && (
              <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                      Needs Immediate Attention
                    </p>
                  </div>
                  {insights.urgent_attention.map((item, i) => (
                    <p key={i} className="text-sm text-red-600 dark:text-red-400">• {item}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            {insights.summary && (
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <p className="text-sm">{insights.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            {insights.markers.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {["normal", "low", "high", "critical"].map((status) => {
                  const count = insights.markers.filter((m) => m.status === status).length;
                  const config = statusConfig[status as keyof typeof statusConfig];
                  const Icon = config.icon;
                  return (
                    <div key={status} className={`rounded-lg p-2 text-center ${config.color}`}>
                      <Icon className="h-4 w-4 mx-auto mb-0.5" />
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px]">{config.label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Markers List */}
            <div className="space-y-2">
              {insights.markers.map((marker, i) => {
                const config = statusConfig[marker.status] || statusConfig.normal;
                const Icon = config.icon;
                return (
                  <Card key={i}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between mb-1.5">
                        <h4 className="text-sm font-semibold">{marker.name}</h4>
                        <Badge className={`${config.color} text-[10px] gap-1`}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className="text-lg font-bold">{marker.value}</span>
                        <span className="text-xs text-muted-foreground">
                          (Normal: {marker.normal_range})
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{marker.explanation}</p>
                      {marker.status !== "normal" && marker.advice && (
                        <p className="text-xs bg-muted p-1.5 rounded">
                          💡 {marker.advice}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Actions */}
            <Button variant="outline" className="w-full" onClick={resetAll}>
              Analyze Another Report
            </Button>

            <p className="text-[10px] text-center text-muted-foreground px-4">
              AI-generated analysis for reference only. Always consult your doctor for medical decisions.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
