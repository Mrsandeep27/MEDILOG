"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  RotateCcw,
  Check,
  Loader2,
  X,
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
import { AppHeader } from "@/components/layout/app-header";
import { useCamera } from "@/hooks/use-camera";
import { useMembers } from "@/hooks/use-members";
import { useRecords } from "@/hooks/use-records";
import { useMedicines } from "@/hooks/use-medicines";
import { extractText } from "@/lib/ocr/tesseract";
import {
  extractPrescription,
  type ExtractionResult,
  type ExtractedMedicine,
} from "@/lib/ai/extract-prescription";
import { FREQUENCY_LABELS } from "@/constants/config";
import { useLocale } from "@/lib/i18n/use-locale";

type ScanStep = "capture" | "processing" | "review" | "saving";

export default function ScanPage() {
  const router = useRouter();
  const { members } = useMembers();
  const { addRecord } = useRecords();
  const { addMedicine } = useMedicines();
  const {
    videoRef,
    isActive,
    error: cameraError,
    start,
    stop,
    captureAsync,
  } = useCamera();
  const { t } = useLocale();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ScanStep>("capture");
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [editedMedicines, setEditedMedicines] = useState<ExtractedMedicine[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-start camera when page opens
  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    if (isProcessing) return;
    try {
      const blob = await captureAsync();
      if (blob) {
        stop();
        setCapturedImage(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        processImage(blob);
      }
    } catch (err) {
      console.error("Capture failed:", err);
      toast.error(t("scan.capture_failed"));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      processImage(file);
    }
  };

  const [ocrText, setOcrText] = useState<string>("");

  const processImage = async (image: Blob | File) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStep("processing");

    try {
      // Step 1: OCR — extract text (runs in parallel as supplementary context)
      setStatusText(t("scan.reading"));
      setOcrProgress(20);

      let ocrText = "";
      try {
        const ocrResult = await extractText(image, (p) => setOcrProgress(Math.min(p * 0.4, 40)));
        ocrText = ocrResult.text;
        setOcrText(ocrText);
      } catch (ocrErr) {
        console.error("OCR failed (will use AI vision instead):", ocrErr);
      }
      setOcrProgress(50);

      // Step 2: AI Vision — send image + OCR text to Gemini
      setStatusText(t("scan.analyzing"));
      setOcrProgress(70);

      const result = await extractPrescription(ocrText, image);
      setOcrProgress(100);

      if (result.error) {
        toast.error(`AI: ${result.error}`);
      }

      setExtraction(result);
      setEditedMedicines(result.medicines);
      setStep("review");

      if (result.medicines.length === 0) {
        toast.info(t("scan.no_medicines_detected"));
      }

      if (members.length === 1) {
        setSelectedMemberId(members[0].id);
      }
    } catch (err) {
      console.error("Processing failed:", err);
      toast.error(t("scan.failed"));
      resetScan();
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScan = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedImage(null);
    setPreviewUrl(null);
    setExtraction(null);
    setEditedMedicines([]);
    setOcrProgress(0);
    setStatusText("");
    setStep("capture");
  };

  const handleSave = async () => {
    if (!selectedMemberId) {
      toast.error(t("scan.select_member"));
      return;
    }
    if (!extraction || !capturedImage) return;

    setStep("saving");
    try {
      const title = extraction.doctor_name
        ? `Dr. ${extraction.doctor_name} - Prescription`
        : `Prescription - ${new Date().toLocaleDateString("en-IN")}`;

      const recordId = await addRecord(
        {
          member_id: selectedMemberId,
          type: "prescription",
          title,
          doctor_name: extraction.doctor_name || "",
          hospital_name: extraction.hospital_name || "",
          visit_date:
            extraction.visit_date || new Date().toISOString().split("T")[0],
          diagnosis: extraction.diagnosis || "",
          notes: extraction.notes || "",
          tags: ["scanned"],
        },
        [new File([capturedImage], "prescription.jpg", { type: "image/jpeg" })]
      );

      for (const med of editedMedicines) {
        await addMedicine({
          record_id: recordId,
          member_id: selectedMemberId,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          before_food: med.before_food,
          start_date: new Date().toISOString().split("T")[0],
        });
      }

      const { shareMediLog } = await import("@/lib/utils/share-app");
      toast.success(
        `Saved prescription with ${editedMedicines.length} medicine(s)`,
        {
          duration: 6000,
          action: {
            label: "Share App",
            onClick: () => shareMediLog(),
          },
        }
      );
      router.push(`/records/${recordId}`);
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save. Please try again.");
      setStep("review");
    }
  };

  const updateMedicine = (index: number, field: string, value: string | boolean) => {
    setEditedMedicines((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const removeMedicine = (index: number) => {
    setEditedMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const addEmptyMedicine = () => {
    setEditedMedicines((prev) => [
      ...prev,
      { name: "", dosage: "", frequency: undefined, duration: "", before_food: false },
    ]);
  };

  // === CAPTURE STEP ===
  if (step === "capture") {
    return (
      <div>
        <AppHeader title={t("scan.title")} showBack />

        {/* Full camera viewfinder */}
        <div className="relative bg-black" style={{ height: "calc(100vh - 8rem)" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Loading / Error overlay */}
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
              {cameraError ? (
                <div className="text-center px-6 space-y-4">
                  <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                    <Upload className="h-10 w-10 text-white/70" />
                  </div>
                  <p className="text-white text-base font-medium">{t("scan.no_camera")}</p>
                  <p className="text-white/50 text-xs">{cameraError}</p>
                  <Button
                    size="lg"
                    className="bg-white text-black hover:bg-white/90"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t("scan.upload_photo")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-white/50" onClick={start}>
                    {t("scan.retry_camera")}
                  </Button>
                </div>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-white mb-3" />
                  <p className="text-white/70 text-sm">{t("scan.opening_camera")}</p>
                </>
              )}
            </div>
          )}

          {/* Scan frame overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner marks */}
            <div className="absolute top-6 left-6 w-12 h-12 border-t-3 border-l-3 border-white/70 rounded-tl-lg" />
            <div className="absolute top-6 right-6 w-12 h-12 border-t-3 border-r-3 border-white/70 rounded-tr-lg" />
            <div className="absolute bottom-28 left-6 w-12 h-12 border-b-3 border-l-3 border-white/70 rounded-bl-lg" />
            <div className="absolute bottom-28 right-6 w-12 h-12 border-b-3 border-r-3 border-white/70 rounded-br-lg" />

            {/* Hint text */}
            <div className="absolute top-10 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                {t("scan.point_capture")}
              </span>
            </div>
          </div>

          {/* Bottom controls */}
          {isActive && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-4">
              <div className="flex items-center justify-center gap-6">
                {/* Upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <Upload className="h-5 w-5 text-white" />
                </button>

                {/* Capture button */}
                <button
                  onClick={handleCapture}
                  className="h-18 w-18 rounded-full bg-white flex items-center justify-center shadow-lg"
                  style={{ width: "72px", height: "72px" }}
                >
                  <div className="h-16 w-16 rounded-full border-4 border-black/10 flex items-center justify-center">
                    <Camera className="h-7 w-7 text-black" />
                  </div>
                </button>

                {/* Placeholder for symmetry */}
                <div className="h-12 w-12" />
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    );
  }

  // === PROCESSING STEP ===
  if (step === "processing") {
    return (
      <div>
        <AppHeader title={t("scan.processing")} showBack />
        <div className="p-4 flex flex-col items-center py-20 space-y-6">
          {previewUrl && (
            <div className="w-32 h-40 rounded-lg overflow-hidden border shadow">
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{statusText}</p>
          <div className="w-full max-w-xs bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${ocrProgress}%` }}
            />
          </div>
          <Button variant="ghost" onClick={resetScan}>
            {t("scan.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  // === REVIEW STEP ===
  return (
    <div>
      <AppHeader
        title={t("scan.review")}
        showBack
        rightAction={
          <Button size="sm" onClick={resetScan} variant="ghost">
            <RotateCcw className="h-4 w-4 mr-1" />
            {t("scan.rescan")}
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        {/* Member Selector */}
        <div className="space-y-2">
          <Label>{t("scan.save_for")} *</Label>
          <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v || "")}>
            <SelectTrigger>
              <SelectValue placeholder={t("scan.select_member")} />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Extracted Info */}
        {extraction && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("scan.prescription_details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {extraction.doctor_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("scan.doctor")}</span>
                  <span className="font-medium">Dr. {extraction.doctor_name}</span>
                </div>
              )}
              {extraction.hospital_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("scan.hospital")}</span>
                  <span className="font-medium">{extraction.hospital_name}</span>
                </div>
              )}
              {extraction.visit_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("scan.date")}</span>
                  <span className="font-medium">{extraction.visit_date}</span>
                </div>
              )}
              {extraction.diagnosis && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("scan.diagnosis")}</span>
                  <span className="font-medium">{extraction.diagnosis}</span>
                </div>
              )}
              {extraction.vitals && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("scan.vitals")}</span>
                  <span className="font-medium">{extraction.vitals}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {extraction?.instructions && extraction.instructions.length > 0 && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
            <CardContent className="py-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1.5">{t("scan.instructions")}</p>
              <ul className="space-y-1">
                {extraction.instructions.map((inst, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>{inst}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Medicines */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t("scan.medicines")} ({editedMedicines.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addEmptyMedicine}>
                + Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {editedMedicines.map((med, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    value={med.name}
                    onChange={(e) => updateMedicine(i, "name", e.target.value)}
                    placeholder={t("scan.medicine_name")}
                    className="font-medium h-8 text-sm"
                  />
                  <button
                    onClick={() => removeMedicine(i)}
                    className="ml-2 p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={med.dosage || ""}
                    onChange={(e) => updateMedicine(i, "dosage", e.target.value)}
                    placeholder={t("scan.dosage")}
                    className="h-8 text-xs"
                  />
                  <Input
                    value={med.duration || ""}
                    onChange={(e) => updateMedicine(i, "duration", e.target.value)}
                    placeholder={t("scan.duration")}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={med.frequency || ""}
                    onValueChange={(v) => updateMedicine(i, "frequency", v || "")}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder={t("scan.frequency")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge
                    variant={med.before_food ? "default" : "outline"}
                    className="cursor-pointer shrink-0 text-xs"
                    onClick={() => updateMedicine(i, "before_food", !med.before_food)}
                  >
                    {med.before_food ? t("scan.before_food") : t("scan.after_food")}
                  </Badge>
                </div>
              </div>
            ))}
            {editedMedicines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("scan.no_medicines")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={step === "saving"}
        >
          {step === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("scan.saving")}
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              {t("scan.save")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
