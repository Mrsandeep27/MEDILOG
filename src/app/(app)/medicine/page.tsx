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
import { useLocale } from "@/lib/i18n/use-locale";
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
  const { locale, t } = useLocale();
  const isHindi = locale === "hi";
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

      const { createClient } = await import("@/lib/supabase/client");
      const { data: { session } } = await createClient().auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/medicine-info", {
        method: "POST",
        headers,
        body: JSON.stringify({ image: compressed, locale }),
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

    // Show "taking time" message after 5 seconds
    const slowTimer = setTimeout(() => {
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "ai" && last.text.includes("Taking")) return prev;
        return [...prev, { role: "ai", text: isHindi ? "⏳ थोड़ा समय लग रहा है, रुकिए..." : "⏳ Taking a moment, please wait..." }];
      });
    }, 5000);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { data: { session } } = await createClient().auth.getSession();
      const chatHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) chatHeaders["Authorization"] = `Bearer ${session.access_token}`;

      const res = await fetch("/api/medicine-info", {
        method: "POST",
        headers: chatHeaders,
        body: JSON.stringify({
          action: "chat",
          question,
          locale,
          context: {
            name: medicineInfo.name,
            generic_name: medicineInfo.generic_name,
            uses: medicineInfo.uses,
          },
        }),
      });

      clearTimeout(slowTimer);

      const data = await res.json();

      // Remove the "taking time" message if it was added
      setChatMessages((prev) => prev.filter((m) => !m.text.includes("Taking") && !m.text.includes("समय लग")));

      if (res.ok && data.answer) {
        setChatMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", text: data.error || (isHindi ? "जवाब नहीं मिला, दोबारा कोशिश करें।" : "Couldn't get an answer. Please try again.") },
        ]);
      }
    } catch {
      clearTimeout(slowTimer);
      setChatMessages((prev) => prev.filter((m) => !m.text.includes("Taking") && !m.text.includes("समय लग")));
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: isHindi ? "इंटरनेट कनेक्शन चेक करें।" : "Network error. Check your connection." },
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

  const suggestedQuestions = isHindi
    ? [
        "क्या बच्चों को दे सकते हैं?",
        "खाली पेट ले सकते हैं?",
        "किस खाने से परहेज करें?",
        "सस्ता विकल्प क्या है?",
        "प्रेगनेंसी में ले सकते हैं?",
        "कितने दिन तक ले सकते हैं?",
      ]
    : [
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
        <AppHeader title={t("medicine.scan_medicine")} showBack />
        <div className="relative bg-black" style={{ height: "calc(100vh - 8rem)" }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-6 left-6 w-12 h-12 border-t-3 border-l-3 border-white/70 rounded-tl-lg" />
            <div className="absolute top-6 right-6 w-12 h-12 border-t-3 border-r-3 border-white/70 rounded-tr-lg" />
            <div className="absolute bottom-28 left-6 w-12 h-12 border-b-3 border-l-3 border-white/70 rounded-bl-lg" />
            <div className="absolute bottom-28 right-6 w-12 h-12 border-b-3 border-r-3 border-white/70 rounded-br-lg" />
            <div className="absolute top-10 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full">Point at medicine strip & tap capture</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-4">
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => stop()} className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <X className="h-5 w-5 text-white" />
              </button>
              <button onClick={handleCapture} className="rounded-full bg-white flex items-center justify-center shadow-lg" style={{ width: "72px", height: "72px" }}>
                <div className="h-16 w-16 rounded-full border-4 border-black/10 flex items-center justify-center">
                  <Camera className="h-7 w-7 text-black" />
                </div>
              </button>
              <div className="h-12 w-12" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader title={t("medicine.title")} showBack />
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
                  <span className="text-sm font-medium">{t("scan.take_photo")}</span>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center py-8">
                  <Upload className="h-8 w-8 text-primary mb-2" />
                  <span className="text-sm font-medium">{t("medicine.upload_photo")}</span>
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
            <p className="text-sm text-muted-foreground">{t("medicine.identifying")}</p>
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
                    {t("medicine.uses")}
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
                    {t("medicine.how_to_take")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{medicineInfo.how_to_take}</p>
                </CardContent>
              </Card>
            )}

            {/* Side Effects — hidden by default, shown on tap */}
            {medicineInfo.common_side_effects && medicineInfo.common_side_effects.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <button
                    onClick={() => setShowAllSideEffects(!showAllSideEffects)}
                    className="flex items-center justify-between w-full"
                  >
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      {t("medicine.side_effects")}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {showAllSideEffects ? t("ai_doctor.hide_details") : t("medicine.tap_to_view")}
                      {showAllSideEffects ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </span>
                  </button>
                  {showAllSideEffects && (
                    <div className="mt-3 space-y-2">
                      <div className="space-y-1">
                        {medicineInfo.common_side_effects.map((se, i) => (
                          <p key={i} className="text-sm flex items-start gap-2">
                            <span className="text-yellow-600 mt-1">•</span>
                            {se}
                          </p>
                        ))}
                      </div>
                      {medicineInfo.serious_side_effects && medicineInfo.serious_side_effects.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-950 p-2 rounded-lg">
                          <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                            {t("medicine.serious_side_effects")}:
                          </p>
                          {medicineInfo.serious_side_effects.map((se, i) => (
                            <p key={i} className="text-xs text-red-600 dark:text-red-400">• {se}</p>
                          ))}
                        </div>
                      )}
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
                    <p className="text-[10px] text-muted-foreground">{t("medicine.pregnancy")}</p>
                    <p className="text-xs font-medium">{medicineInfo.pregnancy_safe || "Ask doctor"}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <Wine className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">{t("medicine.alcohol")}</p>
                    <p className="text-xs font-medium">{medicineInfo.alcohol_safe || "Ask doctor"}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <ShieldAlert className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">{t("medicine.habit_forming")}</p>
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
                    <AlertTriangle className="h-3.5 w-3.5" /> {t("medicine.warnings")}
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
                    <IndianRupee className="h-3.5 w-3.5" /> {t("medicine.generic_alt")}
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
                  {t("medicine.ask_question")}
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
                    placeholder={t("medicine.ask_question")}
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
