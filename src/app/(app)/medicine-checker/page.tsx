"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Upload,
  Pill,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Search,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCamera } from "@/hooks/use-camera";
import { useMedicines } from "@/hooks/use-medicines";
import { useMembers } from "@/hooks/use-members";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Interaction {
  medicines: string[];
  description: string;
  severity: "mild" | "moderate" | "severe";
}

interface CheckResult {
  safe: boolean;
  interactions: Interaction[];
  rawText?: string;
}

interface MedicineInfo {
  name: string;
  generic_name?: string;
  type?: string;
  uses?: string[];
  how_to_take?: string;
  common_side_effects?: string[];
  serious_side_effects?: string[];
  warnings?: string[];
  not_for?: string[];
  generic_alternative?: { name: string; approx_price: string };
  approx_price?: string;
  pregnancy_safe?: string;
  alcohol_safe?: string;
  habit_forming?: string;
  requires_prescription?: string;
  summary_hindi?: string;
}

type Step = "capture" | "identifying" | "info" | "interaction";

const severityConfig = {
  mild: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-800 dark:text-yellow-300",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    label: "Mild",
  },
  moderate: {
    bg: "bg-orange-50 dark:bg-orange-950",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-800 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    label: "Moderate",
  },
  severe: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-300",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    label: "Severe",
  },
};

export default function MedicineCheckerPage() {
  const { members } = useMembers();
  const selfMember = members.find((m) => m.relation === "self");
  const { medicines: allMedicines } = useMedicines(selfMember?.id);
  const activeMedicines = (allMedicines ?? []).filter((m) => m.is_active && !m.is_deleted);

  const { videoRef, isActive, error: cameraError, start, stop, captureAsync } = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [medicineInfo, setMedicineInfo] = useState<MedicineInfo | null>(null);

  // Interaction state
  const [inputValue, setInputValue] = useState("");
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);
  const [interactionLoading, setInteractionLoading] = useState(false);
  const [interactionResult, setInteractionResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetToCamera = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMedicineInfo(null);
    setSelectedMedicines([]);
    setInteractionResult(null);
    setStep("capture");
    start();
  };

  const processImage = async (imageBlob: Blob | File) => {
    stop();
    setPreviewUrl(URL.createObjectURL(imageBlob));
    setStep("identifying");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in first");

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
      });

      const res = await fetch("/api/medicine-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not identify medicine");
      }

      const data = await res.json();
      setMedicineInfo(data);
      if (data.name && data.name !== "Unknown") {
        setSelectedMedicines([data.name]);
      }
      setStep("info");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to identify medicine");
      resetToCamera();
    }
  };

  const handleCapture = async () => {
    try {
      const blob = await captureAsync();
      if (blob) processImage(blob);
    } catch {
      toast.error("Capture failed. Try uploading a photo instead.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    if (e.target) e.target.value = "";
  };

  const addMedicine = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (selectedMedicines.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
        toast.error("Already added");
        return;
      }
      setSelectedMedicines((prev) => [...prev, trimmed]);
      setInputValue("");
    },
    [selectedMedicines]
  );

  const handleCheckInteraction = async () => {
    if (selectedMedicines.length < 2) {
      toast.error("Add at least 2 medicines to check interactions");
      return;
    }
    setInteractionLoading(true);
    setInteractionResult(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in");

      const res = await fetch("/api/medicine-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "interaction", medicines: selectedMedicines }),
      });

      if (!res.ok) throw new Error("Failed to check interactions");

      const data = await res.json();
      if (data.interactions && Array.isArray(data.interactions)) {
        setInteractionResult({ safe: data.interactions.length === 0, interactions: data.interactions });
      } else if (data.result) {
        const text = typeof data.result === "string" ? data.result : JSON.stringify(data.result);
        const hasWarning = /interact|caution|avoid|warning/i.test(text);
        setInteractionResult({ safe: !hasWarning, interactions: [], rawText: text });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check failed");
    } finally {
      setInteractionLoading(false);
    }
  };

  // ═══ CAPTURE STEP (camera-first, same as scanner) ═══════════════════════
  if (step === "capture") {
    return (
      <div>
        <AppHeader title="Medicine Checker" showBack />
        <div className="relative bg-black" style={{ height: "calc(100vh - 8rem)" }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
              {cameraError ? (
                <div className="text-center px-6 space-y-4">
                  <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                    <Upload className="h-10 w-10 text-white/70" />
                  </div>
                  <p className="text-white text-base font-medium">Camera not available</p>
                  <p className="text-white/50 text-xs">{cameraError}</p>
                  <Button size="lg" className="bg-white text-black hover:bg-white/90" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                  <Button size="sm" variant="ghost" className="text-white/50" onClick={start}>Retry Camera</Button>
                </div>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-white mb-3" />
                  <p className="text-white/70 text-sm">Opening camera...</p>
                </>
              )}
            </div>
          )}

          {/* Scan frame overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-6 left-6 w-12 h-12 border-t-3 border-l-3 border-white/70 rounded-tl-lg" />
            <div className="absolute top-6 right-6 w-12 h-12 border-t-3 border-r-3 border-white/70 rounded-tr-lg" />
            <div className="absolute bottom-28 left-6 w-12 h-12 border-b-3 border-l-3 border-white/70 rounded-bl-lg" />
            <div className="absolute bottom-28 right-6 w-12 h-12 border-b-3 border-r-3 border-white/70 rounded-br-lg" />
            <div className="absolute top-10 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                Point at medicine box, strip, or pill
              </span>
            </div>
          </div>

          {/* Bottom controls */}
          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-4">
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => fileInputRef.current?.click()} className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-white" />
                </button>
                <button onClick={handleCapture} className="rounded-full bg-white flex items-center justify-center shadow-lg" style={{ width: "72px", height: "72px" }}>
                  <div className="h-16 w-16 rounded-full border-4 border-black/10 flex items-center justify-center">
                    <Camera className="h-7 w-7 text-black" />
                  </div>
                </button>
                <div className="h-12 w-12" />
              </div>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
      </div>
    );
  }

  // ═══ IDENTIFYING STEP ═══════════════════════════════════════════════════
  if (step === "identifying") {
    return (
      <div>
        <AppHeader title="Identifying..." showBack />
        <div className="p-4 flex flex-col items-center py-20 space-y-6">
          {previewUrl && (
            <div className="w-32 h-40 rounded-lg overflow-hidden border shadow">
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Identifying medicine with AI...</p>
          <Button variant="ghost" onClick={resetToCamera}>Cancel</Button>
        </div>
      </div>
    );
  }

  // ═══ INFO + INTERACTION STEP ════════════════════════════════════════════
  const uniqueQuickAdd = activeMedicines
    .filter((m) => !selectedMedicines.some((s) => s.toLowerCase() === m.name.toLowerCase()))
    .filter((m, i, arr) => arr.findIndex((a) => a.name.toLowerCase() === m.name.toLowerCase()) === i);

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader
        title="Medicine Checker"
        showBack
        rightAction={
          <Button size="sm" variant="ghost" onClick={resetToCamera}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Scan
          </Button>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* Medicine Info Card */}
        {medicineInfo && medicineInfo.name !== "Unknown" && (
          <Card className="border-blue-200 dark:border-blue-800">
            <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
              <Pill className="h-4 w-4 text-white" />
              <span className="text-white text-xs font-bold uppercase tracking-widest">Identified Medicine</span>
            </div>
            <CardContent className="pt-4 space-y-3">
              <div>
                <h2 className="text-xl font-bold">{medicineInfo.name}</h2>
                {medicineInfo.generic_name && <p className="text-sm text-muted-foreground">{medicineInfo.generic_name}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {medicineInfo.type && <Badge variant="secondary" className="text-xs capitalize">{medicineInfo.type}</Badge>}
                  {medicineInfo.requires_prescription === "Yes" && <Badge variant="destructive" className="text-xs">Prescription Required</Badge>}
                  {medicineInfo.habit_forming === "Yes" && <Badge variant="destructive" className="text-xs">Habit Forming</Badge>}
                </div>
              </div>

              {medicineInfo.uses && medicineInfo.uses.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Uses</p>
                  <ul className="space-y-1">
                    {medicineInfo.uses.map((u, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">+</span><span>{u}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {medicineInfo.how_to_take && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase mb-1">How to Take</p>
                  <p className="text-sm">{medicineInfo.how_to_take}</p>
                </div>
              )}

              {medicineInfo.common_side_effects && medicineInfo.common_side_effects.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Common Side Effects</p>
                  <div className="flex flex-wrap gap-1.5">
                    {medicineInfo.common_side_effects.map((e, i) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}
                  </div>
                </div>
              )}

              {medicineInfo.warnings && medicineInfo.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Warnings</p>
                  <ul className="space-y-1">
                    {medicineInfo.warnings.map((w, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" /><span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                {medicineInfo.approx_price && <span className="font-medium">{medicineInfo.approx_price}</span>}
                {medicineInfo.generic_alternative?.name && (
                  <span className="text-muted-foreground">Generic: {medicineInfo.generic_alternative.name} ({medicineInfo.generic_alternative.approx_price})</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {medicineInfo.pregnancy_safe && (
                  <Badge variant={medicineInfo.pregnancy_safe === "Yes" ? "secondary" : "destructive"} className="text-xs">Pregnancy: {medicineInfo.pregnancy_safe}</Badge>
                )}
                {medicineInfo.alcohol_safe && (
                  <Badge variant={medicineInfo.alcohol_safe === "Yes" ? "secondary" : "destructive"} className="text-xs">Alcohol: {medicineInfo.alcohol_safe}</Badge>
                )}
              </div>

              {medicineInfo.summary_hindi && (
                <p className="text-sm text-muted-foreground border-t pt-2 mt-2">{medicineInfo.summary_hindi}</p>
              )}
            </CardContent>
          </Card>
        )}

        {previewUrl && (!medicineInfo || medicineInfo.name === "Unknown") && (
          <Card>
            <CardContent className="py-4 text-center space-y-3">
              <div className="w-24 h-32 rounded-lg overflow-hidden border shadow mx-auto">
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <p className="text-sm text-muted-foreground">Could not identify this medicine.</p>
              <Button variant="outline" onClick={resetToCamera}><RotateCcw className="h-4 w-4 mr-1" />Try Again</Button>
            </CardContent>
          </Card>
        )}

        {/* Interaction Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Check Interactions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add medicine name..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMedicine(inputValue); } }}
                className="flex-1"
              />
              <Button size="sm" onClick={() => addMedicine(inputValue)} disabled={!inputValue.trim()}>
                <Plus className="h-4 w-4 mr-1" />Add
              </Button>
            </div>

            {uniqueQuickAdd.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Your active medicines:</p>
                <div className="flex flex-wrap gap-1.5">
                  {uniqueQuickAdd.map((med) => (
                    <button key={med.id} onClick={() => addMedicine(med.name)} className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors flex items-center gap-1">
                      <Plus className="h-3 w-3" />{med.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedMedicines.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Selected ({selectedMedicines.length}):</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMedicines.map((name) => (
                    <Badge key={name} variant="secondary" className="pl-2.5 pr-1 py-1 gap-1 h-auto">
                      {name}
                      <button onClick={() => setSelectedMedicines((prev) => prev.filter((m) => m !== name))} className="ml-0.5 hover:bg-foreground/10 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedMedicines.length < 2 && <p className="text-xs text-muted-foreground">Add at least 2 medicines to check for interactions.</p>}
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={handleCheckInteraction} disabled={selectedMedicines.length < 2 || interactionLoading}>
          {interactionLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</> : <><Search className="h-4 w-4 mr-2" />Check Interactions</>}
        </Button>

        {/* Interaction Results */}
        {interactionResult && !interactionLoading && (
          <div className="space-y-3">
            {interactionResult.safe && !interactionResult.rawText && (
              <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-100 dark:bg-green-900 p-2"><CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
                    <div>
                      <p className="font-semibold text-green-800 dark:text-green-300 text-sm">No Known Harmful Interactions</p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">These medicines appear safe to take together.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {interactionResult.interactions.length > 0 && interactionResult.interactions.map((interaction, idx) => {
              const config = severityConfig[interaction.severity] || severityConfig.moderate;
              return (
                <Card key={idx} className={`${config.bg} ${config.border}`}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 ${config.text} shrink-0 mt-0.5`} />
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.badge}`}>{config.label}</span>
                          {interaction.medicines.length > 0 && <span className="text-xs text-muted-foreground">{interaction.medicines.join(" + ")}</span>}
                        </div>
                        <p className={`text-sm ${config.text}`}>{interaction.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {interactionResult.rawText && (
              <Card className={interactionResult.safe ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    {interactionResult.safe ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{interactionResult.rawText}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button variant="outline" className="w-full" onClick={() => { setInteractionResult(null); setSelectedMedicines(medicineInfo?.name ? [medicineInfo.name] : []); }}>
              Check Another Combination
            </Button>
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground px-4">
          AI-generated information. Always consult your doctor before combining medicines.
        </p>
      </div>
    </div>
  );
}
