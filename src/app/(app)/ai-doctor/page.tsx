"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Siren,
  Pill,
  Home,
  Heart,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/app-header";
import { useMembers } from "@/hooks/use-members";
import { useMedicines } from "@/hooks/use-medicines";
import { useLocale } from "@/lib/i18n/use-locale";
import { toast } from "sonner";

interface AIResponse {
  urgency: "green" | "yellow" | "orange" | "red";
  urgency_label: string;
  urgency_message: string;
  possible_causes: string[];
  what_to_do: string[];
  home_remedies: string[];
  otc_medicines: Array<{ name: string; dosage: string; when: string; warning?: string }>;
  when_to_rush: string[];
  doctor_type: string;
  reply: string;
  follow_up_questions: string[];
}

interface ChatMsg {
  role: "user" | "ai";
  text: string;
  data?: AIResponse;
}

const urgencyConfig = {
  green: { icon: ShieldCheck, color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700", bar: "bg-green-500" },
  yellow: { icon: AlertTriangle, color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700", bar: "bg-yellow-500" },
  orange: { icon: AlertCircle, color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700", bar: "bg-orange-500" },
  red: { icon: Siren, color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700", bar: "bg-red-500" },
};

export default function AIDoctorPage() {
  const { members } = useMembers();
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const { medicines } = useMedicines(selectedMemberId || undefined);
  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const { locale, t } = useLocale();
  const isHindi = locale === "hi";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-select first member
  useEffect(() => {
    if (members.length > 0 && !selectedMemberId) {
      setSelectedMemberId(members[0].id);
    }
  }, [members, selectedMemberId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleExpand = (idx: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setIsLoading(true);

    // Show waiting message after 5s
    const slowTimer = setTimeout(() => {
      setMessages((prev) => [...prev, { role: "ai", text: "⏳ Analyzing your symptoms..." }]);
    }, 5000);

    try {
      const activeMeds = medicines.filter((m) => m.is_active).map((m) => m.name);

      const { createClient } = await import("@/lib/supabase/client");
      const { data: { session } } = await createClient().auth.getSession();

      const res = await fetch("/api/ai-doctor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: msg,
          locale,
          patient: selectedMember ? {
            name: selectedMember.name,
            date_of_birth: selectedMember.date_of_birth,
            gender: selectedMember.gender,
            blood_group: selectedMember.blood_group,
            allergies: selectedMember.allergies,
            chronic_conditions: selectedMember.chronic_conditions,
            current_medicines: activeMeds,
          } : null,
          chatHistory: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      clearTimeout(slowTimer);
      // Remove waiting message
      setMessages((prev) => prev.filter((m) => !m.text.includes("Analyzing")));

      if (res.ok) {
        const data: AIResponse = await res.json();
        setMessages((prev) => [...prev, { role: "ai", text: data.reply, data }]);
        setExpandedCards((prev) => new Set([...prev, messages.length + 1]));
      } else {
        const err = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, {
          role: "ai",
          text: err.error || t("ai_doctor.error"),
        }]);
      }
    } catch {
      clearTimeout(slowTimer);
      setMessages((prev) => prev.filter((m) => !m.text.includes("Analyzing")));
      setMessages((prev) => [...prev, {
        role: "ai",
        text: t("ai_doctor.network_error"),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const quickPrompts = [
    t("prompt.fever"), t("prompt.stomach"), t("prompt.cough"),
    t("prompt.child_fever"), t("prompt.chest"), t("prompt.bp"),
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <AppHeader title={t("ai_doctor.title")} showBack />

      {/* Patient Selector */}
      <div className="px-4 py-2 border-b flex items-center gap-2">
        <div className="flex-1">
          <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v || "")}>
            <SelectTrigger className="h-8 text-xs">
              <User className="h-3 w-3 mr-1" />
              <SelectValue placeholder={t("ai_doctor.select_patient")} />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">
                {t("ai_doctor.welcome")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("ai_doctor.welcome_desc")}
              </p>
            </div>

            {selectedMember && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg inline-block">
                {t("ai_doctor.patient")}: {selectedMember.name}
                {selectedMember.allergies.length > 0 && ` | Allergies: ${selectedMember.allergies.join(", ")}`}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
              {quickPrompts.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground px-8">
              {t("ai_doctor.disclaimer")}
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => (
          <div key={idx}>
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm">
                  {msg.text}
                </div>
              </div>
            ) : msg.data ? (
              <div className="space-y-2">
                {/* Urgency Banner */}
                {(() => {
                  const config = urgencyConfig[msg.data.urgency] || urgencyConfig.yellow;
                  const Icon = config.icon;
                  return (
                    <div className={`rounded-xl border p-3 ${config.color}`}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 shrink-0" />
                        <div>
                          <p className="font-bold text-sm">{msg.data.urgency_label}</p>
                          <p className="text-xs">{msg.data.urgency_message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* AI Reply */}
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                  {msg.data.reply}
                </div>

                {/* Expandable Details */}
                <button
                  onClick={() => toggleExpand(idx)}
                  className="text-xs text-primary flex items-center gap-1 ml-2"
                >
                  {expandedCards.has(idx) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {expandedCards.has(idx) ? t("ai_doctor.hide_details") : t("ai_doctor.show_details")}
                </button>

                {expandedCards.has(idx) && (
                  <div className="space-y-2 ml-1">
                    {/* Possible Causes */}
                    {msg.data.possible_causes.length > 0 && (
                      <Card>
                        <CardContent className="py-2.5">
                          <p className="text-xs font-semibold mb-1">🔍 {t("ai_doctor.possible_causes")}</p>
                          {msg.data.possible_causes.map((c, i) => (
                            <p key={i} className="text-xs text-muted-foreground">• {c}</p>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* What to Do */}
                    {msg.data.what_to_do.length > 0 && (
                      <Card>
                        <CardContent className="py-2.5">
                          <p className="text-xs font-semibold mb-1">✅ {t("ai_doctor.what_to_do")}</p>
                          {msg.data.what_to_do.map((d, i) => (
                            <p key={i} className="text-xs text-muted-foreground">{i + 1}. {d}</p>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Home Remedies */}
                    {msg.data.home_remedies.length > 0 && (
                      <Card className="border-green-200 dark:border-green-800">
                        <CardContent className="py-2.5">
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                            <Home className="h-3 w-3 text-green-600" /> {t("ai_doctor.home_remedies")}
                          </p>
                          {msg.data.home_remedies.map((r, i) => (
                            <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* OTC Medicines */}
                    {msg.data.otc_medicines.length > 0 && (
                      <Card className="border-blue-200 dark:border-blue-800">
                        <CardContent className="py-2.5">
                          <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                            <Pill className="h-3 w-3 text-blue-600" /> {t("ai_doctor.otc_medicines")}
                          </p>
                          {msg.data.otc_medicines.map((m, i) => (
                            <div key={i} className="mb-1.5 last:mb-0">
                              <p className="text-xs font-medium">{m.name} — {m.dosage}</p>
                              <p className="text-[10px] text-muted-foreground">{m.when}</p>
                              {m.warning && (
                                <p className="text-[10px] text-orange-600">⚠ {m.warning}</p>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* When to Rush */}
                    {msg.data.when_to_rush.length > 0 && (
                      <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
                        <CardContent className="py-2.5">
                          <p className="text-xs font-semibold mb-1 text-red-700 dark:text-red-400 flex items-center gap-1">
                            <Siren className="h-3 w-3" /> {t("ai_doctor.go_hospital")}
                          </p>
                          {msg.data.when_to_rush.map((r, i) => (
                            <p key={i} className="text-xs text-red-600 dark:text-red-400">• {r}</p>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Doctor Type */}
                    {msg.data.doctor_type && (
                      <div className="text-xs bg-muted p-2 rounded-lg flex items-center gap-1.5">
                        <Heart className="h-3 w-3 text-primary" />
                        <span>{t("ai_doctor.see_doctor")}: <strong>{msg.data.doctor_type}</strong></span>
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-up Questions */}
                {msg.data.follow_up_questions.length > 0 && (
                  <div className="flex flex-wrap gap-1 ml-1">
                    {msg.data.follow_up_questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(q)}
                        className="text-[11px] bg-muted hover:bg-muted/80 px-2.5 py-1 rounded-full"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm">
                {msg.text}
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground px-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">{t("ai_doctor.thinking")}</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={t("ai_doctor.placeholder")}
          className="text-sm"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
