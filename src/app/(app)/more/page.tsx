"use client";

import Link from "next/link";
import {
  Settings,
  Share2,
  Download,
  LogOut,
  ChevronRight,
  Shield,
  Users,
  MessageSquare,
  Activity,
  AlertTriangle,
  Clock,
  CalendarDays,
  Heart,
  Zap,
  Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/lib/i18n/use-locale";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Activity as BarChart3 } from "lucide-react";

const menuSections = [
  {
    title: "Health Tools",
    items: [
      { href: "/smart-records", icon: Activity, label: "Health Overview", description: "View health data and insights" },
      { href: "/vitals", icon: BarChart3, label: "Vitals Tracker", description: "Track BP, sugar, weight trends" },
      { href: "/timeline", icon: Clock, label: "Health Timeline", description: "Chronological view of all events" },
      { href: "/appointments", icon: CalendarDays, label: "Appointments", description: "Track doctor appointments" },
      { href: "/emergency-card", icon: Heart, label: "Emergency Card", description: "Emergency health info & QR" },
      { href: "/medicine-checker", icon: Zap, label: "Medicine Checker", description: "Check drug interactions" },
      { href: "/health-risk", icon: AlertTriangle, label: "Risk Assessment", description: "Check health risk factors" },
      { href: "/badges", icon: Award, label: "Health Badges", description: "Track your achievements" },
      { href: "/more/export", icon: Download, label: "Download Report", description: "Export health report as PDF" },
    ],
  },
  {
    title: "Sharing",
    items: [
      { href: "/more/shared-links", icon: Share2, label: "Share with Doctor", description: "Manage active sharing links" },
      { href: "/abha", icon: Shield, label: "ABHA Health ID", description: "Link your Ayushman Bharat ID" },
      { href: "/more/family-group", icon: Users, label: "Family Group", description: "Share records across devices" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/more/settings", icon: Settings, label: "Settings", description: "Theme, language, PIN, notifications" },
      { href: "/more/feedback", icon: MessageSquare, label: "Feedback", description: "Report bugs or suggest features" },
    ],
  },
];

export default function MorePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t } = useLocale();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <div>
      <AppHeader title={t("more.title")} />
      <div className="p-4 space-y-4">
        {/* User Info */}
        {user && (
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {menuSections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">{section.title}</p>
            <Card>
              <CardContent className="p-0">
                {section.items.map((item, index) => (
                  <div key={item.href}>
                    <Link href={item.href}>
                      <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                    {index < section.items.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}

        <Card>
          <CardContent className="p-0">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 p-4 w-full hover:bg-muted/50 transition-colors text-destructive"
            >
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium">{t("settings.sign_out")}</p>
            </button>
          </CardContent>
        </Card>

        <div className="text-center pt-4">
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-xs">MediLog v1.0 — Your data stays private</span>
          </div>
        </div>
      </div>
    </div>
  );
}
