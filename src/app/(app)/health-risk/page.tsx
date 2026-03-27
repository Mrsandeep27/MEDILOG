"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Heart,
  Droplets,
  Brain,
  Activity,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMembers } from "@/hooks/use-members";
import { useHealthMetrics } from "@/hooks/use-health-metrics";
import { toast } from "sonner";

interface RiskResult {
  condition: string;
  risk_level: "low" | "moderate" | "high" | "very_high";
  score: number;
  explanation: string;
  key_factors: string[];
  recommendations: string[];
}

interface AssessmentResult {
  overall_risk: "low" | "moderate" | "high";
  summary: string;
  conditions: RiskResult[];
  lifestyle_tips: string[];
}

const riskColors = {
  low: { bg: "bg-green-100", text: "text-green-800", bar: "bg-green-500", label: "Low Risk" },
  moderate: { bg: "bg-yellow-100", text: "text-yellow-800", bar: "bg-yellow-500", label: "Moderate" },
  high: { bg: "bg-orange-100", text: "text-orange-800", bar: "bg-orange-500", label: "High Risk" },
  very_high: { bg: "bg-red-100", text: "text-red-800", bar: "bg-red-500", label: "Very High" },
};

const conditionIcons: Record<string, React.ElementType> = {
  diabetes: Droplets,
  heart: Heart,
  hypertension: Activity,
  stroke: Brain,
  default: ShieldAlert,
};

export default function HealthRiskPage() {
  const { members } = useMembers();
  const selfMember = members.find((m) => m.relation === "self");
  const { metrics: bpMetrics } = useHealthMetrics(selfMember?.id, "bp");
  const { metrics: sugarMetrics } = useHealthMetrics(selfMember?.id, "sugar");
  const { metrics: weightMetrics } = useHealthMetrics(selfMember?.id, "weight");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Form
  const [age, setAge] = useState("");
  const [gender, setGender] = useState(selfMember?.gender || "");
  const [height, setHeight] = useState("");
  const [smoker, setSmoker] = useState("no");
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);

  const familyConditions = ["Diabetes", "Heart Disease", "Hypertension", "Stroke", "Cancer", "Thyroid"];

  const toggleFamily = (c: string) => {
    setFamilyHistory((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleAssess = async () => {
    if (!age) { toast.error("Please enter your age"); return; }

    setLoading(true);
    try {
      // Gather health data
      const latestBP = bpMetrics[0]?.value;
      const latestSugar = sugarMetrics[0]?.value;
      const latestWeight = weightMetrics[0]?.value;

      const prompt = `You are a health risk assessment AI. Evaluate the following patient data and return a JSON object.

Patient Data:
- Age: ${age}
- Gender: ${gender || "not specified"}
- Height: ${height || "not specified"} cm
- Weight: ${latestWeight?.weight || "not specified"} kg
- Latest BP: ${latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : "not available"}
- Latest Blood Sugar: ${latestSugar?.level || "not available"} mg/dL
- Smoking: ${smoker}
- Family History: ${familyHistory.length > 0 ? familyHistory.join(", ") : "none reported"}
- Allergies: ${selfMember?.allergies?.join(", ") || "none"}
- Chronic Conditions: ${selfMember?.chronic_conditions?.join(", ") || "none"}

Evaluate risk for: Diabetes, Heart Disease, Hypertension, Stroke, Obesity.

Return ONLY valid JSON:
{
  "overall_risk": "low|moderate|high",
  "summary": "2-3 sentence overall assessment",
  "conditions": [
    {
      "condition": "name",
      "risk_level": "low|moderate|high|very_high",
      "score": 0-100,
      "explanation": "why this risk level",
      "key_factors": ["factor1", "factor2"],
      "recommendations": ["recommendation1", "recommendation2"]
    }
  ],
  "lifestyle_tips": ["tip1", "tip2", "tip3"]
}`;

      const res = await fetch("/api/ai-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, language: "en" }),
      });

      if (!res.ok) throw new Error("AI analysis failed");

      const data = await res.json();
      // Parse JSON from AI response
      const text = data.reply || data.response || JSON.stringify(data);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid response format");

      const parsed = JSON.parse(jsonMatch[0]) as AssessmentResult;
      setResult(parsed);
    } catch {
      toast.error("Assessment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Link href="/home"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold">Health Risk Assessment</h1>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        {!result && !loading && (
          <>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Evaluate your risk against common conditions like Diabetes, Heart Disease, and Hypertension using AI analysis of your health data.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Input Form */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Age *</Label>
                  <Input type="number" inputMode="numeric" placeholder="e.g. 35" value={age} onChange={(e) => setAge(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Gender</Label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Height (cm)</Label>
                  <Input type="number" inputMode="numeric" placeholder="e.g. 170" value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Smoking</Label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={smoker} onChange={(e) => setSmoker(e.target.value)}>
                    <option value="no">Non-smoker</option>
                    <option value="occasional">Occasional</option>
                    <option value="regular">Regular</option>
                  </select>
                </div>
              </div>

              {/* Auto-populated data */}
              {(bpMetrics[0] || sugarMetrics[0] || weightMetrics[0]) && (
                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Auto-filled from your records:</p>
                  {bpMetrics[0] && <p className="text-xs">BP: {bpMetrics[0].value.systolic}/{bpMetrics[0].value.diastolic} mmHg</p>}
                  {sugarMetrics[0] && <p className="text-xs">Sugar: {sugarMetrics[0].value.level} mg/dL</p>}
                  {weightMetrics[0] && <p className="text-xs">Weight: {weightMetrics[0].value.weight} kg</p>}
                </div>
              )}

              {/* Family History */}
              <div>
                <Label className="text-xs">Family History (select all that apply)</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {familyConditions.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleFamily(c)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        familyHistory.includes(c)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={handleAssess}>
              <ShieldAlert className="h-4 w-4 mr-2" />
              Assess My Health Risk
            </Button>
          </>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-16 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing your health data...</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Overall */}
            <Card className={`${riskColors[result.overall_risk]?.bg || "bg-muted"} border-0`}>
              <CardContent className="py-4 text-center">
                <p className="text-xs font-medium opacity-70">Overall Risk Level</p>
                <p className={`text-2xl font-bold ${riskColors[result.overall_risk]?.text || ""}`}>
                  {riskColors[result.overall_risk]?.label || result.overall_risk}
                </p>
                <p className="text-sm mt-2 opacity-80">{result.summary}</p>
              </CardContent>
            </Card>

            {/* Condition Cards */}
            <div className="space-y-2">
              {result.conditions.map((cond, i) => {
                const risk = riskColors[cond.risk_level] || riskColors.low;
                const key = cond.condition.toLowerCase();
                const CondIcon = conditionIcons[key] || conditionIcons.default;
                const expanded = expandedIdx === i;

                return (
                  <Card key={i} className="overflow-hidden">
                    <button className="w-full text-left" onClick={() => setExpandedIdx(expanded ? null : i)}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full p-2 ${risk.bg}`}>
                            <CondIcon className={`h-5 w-5 ${risk.text}`} />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{cond.condition}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${risk.bar}`} style={{ width: `${cond.score}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${risk.text}`}>{cond.score}%</span>
                            </div>
                          </div>
                          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </CardContent>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 pt-0 border-t space-y-2">
                        <p className="text-sm text-muted-foreground">{cond.explanation}</p>
                        {cond.key_factors.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold">Key Factors:</p>
                            {cond.key_factors.map((f, j) => (
                              <p key={j} className="text-xs text-muted-foreground">• {f}</p>
                            ))}
                          </div>
                        )}
                        {cond.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-700">Recommendations:</p>
                            {cond.recommendations.map((r, j) => (
                              <p key={j} className="text-xs text-green-600">• {r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Lifestyle Tips */}
            {result.lifestyle_tips?.length > 0 && (
              <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                <CardContent className="py-3">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Lifestyle Tips</p>
                  {result.lifestyle_tips.map((tip, i) => (
                    <p key={i} className="text-sm text-green-700 dark:text-green-400">• {tip}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
              Reassess
            </Button>

            <p className="text-[10px] text-center text-muted-foreground px-4">
              AI-generated assessment for awareness only. Not a medical diagnosis. Consult your doctor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
