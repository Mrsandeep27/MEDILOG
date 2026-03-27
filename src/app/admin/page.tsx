"use client";

import { useState, useEffect } from "react";
import {
  Users,
  FileText,
  Pill,
  Bell,
  MessageSquare,
  Star,
  Bug,
  Lightbulb,
  Heart,
  Eye,
  CheckCircle,
  Archive,
  BarChart3,
  Lock,
  Loader2,
  LogOut,
  UsersRound,
  Mail,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { PWAInstallButton } from "@/components/pwa/install-button";

type Tab = "overview" | "feedback" | "users" | "families" | "records" | "api-usage";

interface Stats {
  totalMembers: number;
  totalRecords: number;
  totalMedicines: number;
  totalReminders: number;
  totalFeedback: number;
  newFeedback: number;
  totalFamilies: number;
}

interface FeedbackItem {
  id: string;
  user_email: string | null;
  user_name: string | null;
  category: string;
  rating: number | null;
  message: string;
  device: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackItem[]>([]);
  const [members, setMembers] = useState<Array<Record<string, unknown>>>([]);
  const [families, setFamilies] = useState<Array<Record<string, unknown>>>([]);
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [apiUsage, setApiUsage] = useState<Record<string, unknown> | null>(null);
  const [feedbackFilter, setFeedbackFilter] = useState("all");

  const handleLogin = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        toast.error("Failed to get session");
        return;
      }

      // Test admin access
      const res = await fetch("/api/admin?section=overview", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.status === 401) {
        toast.error("This email is not authorized as admin. Add it to ADMIN_EMAILS in Vercel.");
        return;
      }

      if (!res.ok) {
        toast.error("Server error");
        return;
      }

      const data2 = await res.json();
      setToken(accessToken);
      setStats(data2.stats);
      setRecentFeedback(data2.recentFeedback || []);
      setIsLoggedIn(true);
      toast.success("Welcome, Admin!");
    } catch {
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchSection = async (section: Tab) => {
    try {
      const params = new URLSearchParams({ section });
      if (section === "feedback" && feedbackFilter !== "all") {
        params.set("status", feedbackFilter);
      }
      const res = await fetch(`/api/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      if (section === "feedback") setFeedback(data.feedback || []);
      if (section === "users") setMembers(data.members || []);
      if (section === "families") setFamilies(data.families || []);
      if (section === "records") setRecords(data.records || []);
      if (section === "api-usage") setApiUsage(data);
    } catch {}
  };

  useEffect(() => {
    if (isLoggedIn && tab !== "overview") fetchSection(tab);
  }, [tab, isLoggedIn, feedbackFilter]);

  const updateFeedback = async (id: string, status: string) => {
    await fetch("/api/admin", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "update_feedback", id, status }),
    });
    fetchSection("feedback");
  };

  // === LOGIN ===
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Toaster richColors position="top-center" />
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="h-10 w-10 mx-auto text-primary mb-2" />
            <CardTitle className="text-xl">MediLog Admin</CardTitle>
            <p className="text-sm text-muted-foreground">Login with your admin email</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login as Admin"}
            </Button>
            <PWAInstallButton label="Install MediLog Admin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // === DASHBOARD ===
  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "feedback", label: "Feedback", icon: MessageSquare },
    { id: "users", label: "Members", icon: Users },
    { id: "families", label: "Families", icon: UsersRound },
    { id: "records", label: "Records", icon: FileText },
    { id: "api-usage", label: "API Usage", icon: Activity },
  ];

  const catIcon: Record<string, typeof Star> = { review: Star, bug: Bug, feature: Lightbulb, testimonial: Heart };
  const statusBg: Record<string, string> = { new: "bg-blue-100 text-blue-800", read: "bg-gray-100 text-gray-800", resolved: "bg-green-100 text-green-800", archived: "bg-yellow-100 text-yellow-800" };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">MediLog Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{email}</span>
            <Button size="sm" variant="ghost" onClick={() => setIsLoggedIn(false)}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {t.id === "feedback" && stats && stats.newFeedback > 0 && (
                  <Badge className="bg-red-500 text-white text-[9px] h-4 px-1">{stats.newFeedback}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* === OVERVIEW === */}
        {tab === "overview" && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Members", value: stats.totalMembers, icon: Users, color: "text-blue-600" },
                { label: "Records", value: stats.totalRecords, icon: FileText, color: "text-green-600" },
                { label: "Medicines", value: stats.totalMedicines, icon: Pill, color: "text-purple-600" },
                { label: "Reminders", value: stats.totalReminders, icon: Bell, color: "text-orange-600" },
                { label: "Families", value: stats.totalFamilies, icon: UsersRound, color: "text-cyan-600" },
                { label: "Feedback", value: stats.totalFeedback, icon: MessageSquare, color: "text-pink-600" },
                { label: "New Feedback", value: stats.newFeedback, icon: Mail, color: "text-red-600" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <Card key={s.label}>
                    <CardContent className="py-3 flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${s.color}`} />
                      <div>
                        <p className="text-xl font-bold">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {recentFeedback.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent Feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentFeedback.map((f) => (
                    <div key={f.id} className="flex items-start gap-2 text-sm border-b last:border-0 pb-2">
                      <Badge className={`text-[9px] ${statusBg[f.status] || ""}`}>{f.status}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{f.message}</p>
                        <p className="text-[10px] text-muted-foreground">{f.user_email} · {new Date(f.created_at).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* === FEEDBACK === */}
        {tab === "feedback" && (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "new", "read", "resolved", "archived"].map((s) => (
                <Badge key={s} variant={feedbackFilter === s ? "default" : "outline"} className="cursor-pointer capitalize" onClick={() => setFeedbackFilter(s)}>
                  {s}
                </Badge>
              ))}
            </div>
            {feedback.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No feedback</p>
            ) : (
              <div className="space-y-2">
                {feedback.map((f) => {
                  const Icon = catIcon[f.category] || MessageSquare;
                  return (
                    <Card key={f.id}>
                      <CardContent className="py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-medium capitalize">{f.category}</span>
                            <Badge className={`text-[9px] ${statusBg[f.status] || ""}`}>{f.status}</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(f.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {f.rating && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3 w-3 ${s <= f.rating! ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                        )}
                        <p className="text-sm">{f.message}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {f.user_name && <span>{f.user_name}</span>}
                          {f.user_email && <span>({f.user_email})</span>}
                          {f.device && <Badge variant="outline" className="text-[9px]">{f.device}</Badge>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateFeedback(f.id, "read")}><Eye className="h-3 w-3 mr-1" />Read</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateFeedback(f.id, "resolved")}><CheckCircle className="h-3 w-3 mr-1" />Resolved</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateFeedback(f.id, "archived")}><Archive className="h-3 w-3 mr-1" />Archive</Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* === USERS === */}
        {tab === "users" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{members.length} members</p>
            {members.map((m) => (
              <Card key={m.id as string}>
                <CardContent className="py-2.5 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(m.name as string)?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.name as string}</p>
                    <p className="text-[10px] text-muted-foreground">{m.relation as string} · {m.gender as string} · {m.blood_group as string}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(m.created_at as string).toLocaleDateString("en-IN")}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* === FAMILIES === */}
        {tab === "families" && (
          <div className="space-y-2">
            {families.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No family groups created</p>
            ) : (
              families.map((f) => (
                <Card key={f.id as string}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{f.name as string}</h3>
                      <Badge variant="outline" className="font-mono text-xs">{f.invite_code as string}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {((f.members as Array<Record<string, unknown>>) || []).map((m) => (
                        <span key={m.id as string} className="mr-2">
                          {(m.user as Record<string, string>)?.name || (m.user as Record<string, string>)?.email} ({m.role as string})
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* === RECORDS === */}
        {tab === "records" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{records.length} recent records</p>
            {records.map((r) => (
              <Card key={r.id as string}>
                <CardContent className="py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.title as string}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.type as string} · {(r.member as Record<string, string>)?.name} · {r.visit_date as string || "No date"}
                      </p>
                    </div>
                    {r.doctor_name ? <span className="text-xs text-muted-foreground">Dr. {String(r.doctor_name)}</span> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* === API USAGE === */}
        {tab === "api-usage" && apiUsage && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Calls", value: apiUsage.totalCalls as number, color: "text-blue-600" },
                { label: "Today", value: apiUsage.todayCalls as number, color: "text-green-600" },
                { label: "Success Rate", value: `${apiUsage.successRate}%`, color: "text-emerald-600" },
                { label: "Avg Duration", value: `${apiUsage.avgDuration}ms`, color: "text-orange-600" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="py-3 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* By Feature */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Usage by Feature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {((apiUsage.byFeature as Array<{ feature: string; _count: number }>) || []).map((f) => (
                  <div key={f.feature} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{f.feature.replace(/-/g, " ")}</span>
                    <Badge variant="secondary">{f._count} calls</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Calls */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent API Calls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {((apiUsage.recentCalls as Array<Record<string, unknown>>) || []).map((c) => (
                  <div key={c.id as string} className="flex items-center justify-between text-xs border-b last:border-0 pb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${c.success ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="capitalize font-medium">{String(c.feature).replace(/-/g, " ")}</span>
                      <span className="text-muted-foreground">{String(c.model_used)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Key{c.key_index as number}</span>
                      <span className="text-muted-foreground">{c.duration as number}ms</span>
                      <span className="text-muted-foreground">
                        {new Date(c.created_at as string).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
