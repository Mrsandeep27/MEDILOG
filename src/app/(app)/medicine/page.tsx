"use client";

import { useState, useRef } from "react";
import {
  Camera,
  Upload,
  Pill,
  AlertTriangle,
  Heart,
  Baby,
  Wine,
  IndianRupee,
  Send,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { useCamera } from "@/hooks/use-camera";
import { toast } from "sonner";

interface MedicineInfo {
  name: string;
  generic_name?: string;
  manufacturer?: string;
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

interface ChatMessage {
  role: "user" | "ai";
  text: string;
}

export default function MedicinePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { videoRef, isActive, start, stop, captureAsync, error: cameraError } = useCamera();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [medicineInfo, setMedicineInfo] = useState<MedicineInfo | null>(null);
  const [showAllSideEffects, setShowAllSideEffects] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const processImage = async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    try {
      // Compress image before sending (max 1200px, JPEG 0.7 quality)
      const compressed = await compressDataUrl(imageDataUrl, 1200, 0.7);

      const res = await fetch("/api/medicine-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: compressed }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to analyze medicine");
        return;
      }

      const data = await res.json();
      setMedicineInfo(data);
      setChatMessages([]);

      if (data.name === "Unknown") {
        toast.error("Could not identify medicine. Try a clearer photo.");
      } else {
        toast.success(`Identified: ${data.name}`);
      }
    } catch {
      toast.error("Failed to analyze. Check your internet connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCapture = async () => {
    const blob = await captureAsync();
    if (!blob) {
      toast.error("Failed to capture. Try again.");
      return;
    }
    stop();
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      processImage(dataUrl);
    };
    reader.readAsDataURL(blob);
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !medicineInfo || isChatting) return;

    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsChatting(true);

    try {
      const res = await fetch("/api/medicine-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          question,
          context: {
            name: medicineInfo.name,
            generic_name: medicineInfo.generic_name,
            uses: medicineInfo.uses,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", text: "Sorry, couldn't get an answer. Please try again." },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: "Network error. Please check your connection." },
      ]);
    } finally {
      setIsChatting(false);
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  };

  const resetAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMedicineInfo(null);
    setChatMessages([]);
    setChatInput("");
    stop();
  };

  const suggestedQuestions = [
    "Can I give this to a child?",
    "Can I take this empty stomach?",
    "Any food to avoid with this?",
    "Is there a cheaper alternative?",
    "Can I take this during pregnancy?",
    "How long can I take this medicine?",
  ];

  // === CAMERA VIEW ===
  if (isActive) {
    return (
      <div>
        <AppHeader title="Scan Medicine" showBack />
        <div className="p-4">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
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
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader title="Medicine Info" showBack />
      <div className="p-4 space-y-4">
        {/* Upload Section — show when no medicine identified yet */}
        {!medicineInfo && !isAnalyzing && (
          <>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Upload a photo of any medicine strip, bottle, or box.
                    AI will tell you what it&apos;s for, side effects, and cheaper alternatives.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={start}
              >
                <CardContent className="flex flex-col items-center py-8">
                  <Camera className="h-8 w-8 text-primary mb-2" />
                  <span className="text-sm font-medium">Take Photo</span>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center py-8">
                  <Upload className="h-8 w-8 text-primary mb-2" />
                  <span className="text-sm font-medium">Upload Photo</span>
                </CardContent>
              </Card>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {cameraError && (
              <p className="text-sm text-destructive text-center">{cameraError}</p>
            )}
          </>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div className="flex flex-col items-center py-16 space-y-4">
            {previewUrl && (
              <div className="w-24 h-24 rounded-xl overflow-hidden border shadow">
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Identifying medicine...</p>
          </div>
        )}

        {/* Medicine Info Card */}
        {medicineInfo && medicineInfo.name !== "Unknown" && (
          <>
            {/* Header */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {previewUrl && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border shrink-0">
                      <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold">{medicineInfo.name}</h2>
                    {medicineInfo.generic_name && (
                      <p className="text-sm text-muted-foreground">{medicineInfo.generic_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {medicineInfo.type && (
                        <Badge variant="secondary" className="text-xs">{medicineInfo.type}</Badge>
                      )}
                      {medicineInfo.requires_prescription === "Yes" && (
                        <Badge variant="destructive" className="text-xs">Rx Required</Badge>
                      )}
                      {medicineInfo.approx_price && (
                        <Badge variant="outline" className="text-xs">
                          <IndianRupee className="h-3 w-3 mr-0.5" />
                          {medicineInfo.approx_price.replace("₹", "")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {medicineInfo.summary_hindi && (
                  <p className="text-sm mt-3 bg-muted p-2 rounded-lg italic text-muted-foreground">
                    &quot;{medicineInfo.summary_hindi}&quot;
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Uses */}
            {medicineInfo.uses && medicineInfo.uses.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pill className="h-4 w-4 text-green-600" />
                    What it&apos;s used for
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {medicineInfo.uses.map((use, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        {use}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* How to take */}
            {medicineInfo.how_to_take && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    How to take
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{medicineInfo.how_to_take}</p>
                </CardContent>
              </Card>
            )}

            {/* Side Effects */}
            {medicineInfo.common_side_effects && medicineInfo.common_side_effects.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Side Effects
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1">
                    {(showAllSideEffects
                      ? medicineInfo.common_side_effects
                      : medicineInfo.common_side_effects.slice(0, 3)
                    ).map((se, i) => (
                      <p key={i} className="text-sm flex items-start gap-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        {se}
                      </p>
                    ))}
                  </div>
                  {medicineInfo.common_side_effects.length > 3 && (
                    <button
                      onClick={() => setShowAllSideEffects(!showAllSideEffects)}
                      className="text-xs text-primary flex items-center gap-1"
                    >
                      {showAllSideEffects ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showAllSideEffects ? "Show less" : `+${medicineInfo.common_side_effects!.length - 3} more`}
                    </button>
                  )}
                  {medicineInfo.serious_side_effects && medicineInfo.serious_side_effects.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950 p-2 rounded-lg mt-2">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                        Serious (consult doctor immediately):
                      </p>
                      {medicineInfo.serious_side_effects.map((se, i) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400">• {se}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Safety Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-600" />
                  Safety Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted rounded-lg p-2">
                    <Baby className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">Pregnancy</p>
                    <p className="text-xs font-medium">{medicineInfo.pregnancy_safe || "Ask doctor"}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <Wine className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">Alcohol</p>
                    <p className="text-xs font-medium">{medicineInfo.alcohol_safe || "Ask doctor"}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <ShieldAlert className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">Habit forming</p>
                    <p className="text-xs font-medium">{medicineInfo.habit_forming || "No"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warnings */}
            {medicineInfo.warnings && medicineInfo.warnings.length > 0 && (
              <Card className="border-yellow-200 dark:border-yellow-900">
                <CardContent className="py-3">
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Warnings
                  </p>
                  {medicineInfo.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-muted-foreground">• {w}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Generic Alternative */}
            {medicineInfo.generic_alternative && medicineInfo.generic_alternative.name && (
              <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30">
                <CardContent className="py-3">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1 flex items-center gap-1">
                    <IndianRupee className="h-3.5 w-3.5" /> Cheaper Alternative
                  </p>
                  <p className="text-sm font-medium">{medicineInfo.generic_alternative.name}</p>
                  {medicineInfo.generic_alternative.approx_price && (
                    <p className="text-xs text-green-600">{medicineInfo.generic_alternative.approx_price}</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Chat Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Ask about this medicine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Suggested Questions */}
                {chatMessages.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setChatInput(q);
                          setTimeout(() => chatInputRef.current?.focus(), 50);
                        }}
                        className="text-xs bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-full transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Chat Messages */}
                {chatMessages.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-sm p-2.5 rounded-lg ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground ml-8"
                            : "bg-muted mr-8"
                        }`}
                      >
                        {msg.text}
                      </div>
                    ))}
                    {isChatting && (
                      <div className="flex items-center gap-2 p-2 text-muted-foreground mr-8">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Thinking...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Input */}
                <div className="flex gap-2">
                  <Input
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChat()}
                    placeholder="Ask anything about this medicine..."
                    className="text-sm"
                    disabled={isChatting}
                  />
                  <Button
                    size="icon"
                    onClick={handleChat}
                    disabled={!chatInput.trim() || isChatting}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Scan Another */}
            <Button variant="outline" className="w-full" onClick={resetAll}>
              Scan Another Medicine
            </Button>

            <p className="text-[10px] text-center text-muted-foreground px-4">
              This information is AI-generated and for reference only. Always consult your doctor or pharmacist for medical advice.
            </p>
          </>
        )}

        {/* Unknown medicine fallback */}
        {medicineInfo && medicineInfo.name === "Unknown" && (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <Pill className="h-10 w-10 mx-auto text-muted-foreground" />
              <h3 className="font-semibold">Could not identify medicine</h3>
              <p className="text-sm text-muted-foreground">
                Try uploading a clearer photo where the medicine name is visible.
              </p>
              <Button onClick={resetAll}>Try Again</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Compress data URL image to reduce size for API
function compressDataUrl(
  dataUrl: string,
  maxDimension: number,
  quality: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
