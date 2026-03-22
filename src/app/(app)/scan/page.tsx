"use client";

import { useState, useRef } from "react";
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
      toast.error("Failed to capture image. Please try again.");
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
      // Step 1: OCR — extract text from image
      setStatusText("Extracting text from image...");
      setOcrProgress(20);

      let ocrResult;
      try {
        ocrResult = await extractText(image, (p) => setOcrProgress(Math.min(p * 0.5, 50)));
      } catch (ocrErr) {
        console.error("OCR failed:", ocrErr);
        toast.error("OCR failed. Trying AI directly...");
        // If OCR fails, try to send image to AI directly (some AI can read images)
        ocrResult = { text: "", confidence: 0 };
      }
      setOcrProgress(50);
      setOcrText(ocrResult.text);

      const extractedText = ocrResult.text.trim();
      if (!extractedText) {
        toast.error("Could not extract text from image. Try a clearer photo or upload a better image.");
        resetScan();
        return;
      }

      // Step 2: AI — analyze extracted text
      setStatusText(`Analyzing prescription with AI... (${extractedText.length} chars found)`);
      setOcrProgress(70);

      const result = await extractPrescription(extractedText);
      setOcrProgress(100);

      if (result.error) {
        toast.error(`AI: ${result.error}`);
      }

      setExtraction(result);
      setEditedMedicines(result.medicines);
      setStep("review");

      if (result.medicines.length === 0) {
        toast.info("No medicines detected. You can add them manually.");
      }

      if (members.length === 1) {
        setSelectedMemberId(members[0].id);
      }
    } catch (err) {
      console.error("Processing failed:", err);
      toast.error("Processing failed. Please try again.");
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
      toast.error("Please select a family member");
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

      toast.success(
        `Saved prescription with ${editedMedicines.length} medicine(s)`
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
        <AppHeader title="Scan Prescription" showBack />
        <div className="p-4 space-y-4">
          {isActive ? (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                // @ts-expect-error — webkit vendor prefix for iOS
                webkitPlaysinline="true"
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(1)" }}
              />
              <div className="absolute inset-0 border-2 border-white/30 rounded-2xl m-4" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-full h-14 w-14"
                  onClick={() => stop()}
                >
                  <X className="h-6 w-6" />
                </Button>
                <Button
                  size="lg"
                  className="rounded-full h-16 w-16 bg-white text-black hover:bg-white/90"
                  onClick={handleCapture}
                >
                  <Camera className="h-7 w-7" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={start}
              >
                <CardContent className="flex flex-col items-center py-12">
                  <div className="rounded-full bg-primary/10 p-6 mb-4">
                    <Camera className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Take Photo</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Point your camera at the prescription
                  </p>
                </CardContent>
              </Card>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center py-8">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <h3 className="font-medium">Upload from Gallery</h3>
                  <p className="text-xs text-muted-foreground">
                    Select an existing photo
                  </p>
                </CardContent>
              </Card>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {cameraError && (
                <p className="text-sm text-destructive text-center">
                  {cameraError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === PROCESSING STEP ===
  if (step === "processing") {
    return (
      <div>
        <AppHeader title="Processing" showBack />
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
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // === REVIEW STEP ===
  return (
    <div>
      <AppHeader
        title="Review Extraction"
        showBack
        rightAction={
          <Button size="sm" onClick={resetScan} variant="ghost">
            <RotateCcw className="h-4 w-4 mr-1" />
            Rescan
          </Button>
        }
      />
      <div className="p-4 space-y-4">
        {/* Member Selector */}
        <div className="space-y-2">
          <Label>Save for *</Label>
          <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v || "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select family member" />
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
              <CardTitle className="text-base">Prescription Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {extraction.doctor_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Doctor</span>
                  <span className="font-medium">Dr. {extraction.doctor_name}</span>
                </div>
              )}
              {extraction.hospital_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hospital</span>
                  <span className="font-medium">{extraction.hospital_name}</span>
                </div>
              )}
              {extraction.visit_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{extraction.visit_date}</span>
                </div>
              )}
              {extraction.diagnosis && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diagnosis</span>
                  <span className="font-medium">{extraction.diagnosis}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* OCR Text (what was read from image) */}
        {ocrText && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Extracted Text</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-lg max-h-32 overflow-y-auto font-mono">
                {ocrText.slice(0, 500)}{ocrText.length > 500 ? "..." : ""}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Medicines */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Medicines ({editedMedicines.length})
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
                    placeholder="Medicine name"
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
                    placeholder="Dosage (e.g. 500mg)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={med.duration || ""}
                    onChange={(e) => updateMedicine(i, "duration", e.target.value)}
                    placeholder="Duration (e.g. 5 days)"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={med.frequency || ""}
                    onValueChange={(v) => updateMedicine(i, "frequency", v || "")}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Frequency" />
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
                    {med.before_food ? "Before food" : "After food"}
                  </Badge>
                </div>
              </div>
            ))}
            {editedMedicines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No medicines extracted. Add manually if needed.
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
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Prescription
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
