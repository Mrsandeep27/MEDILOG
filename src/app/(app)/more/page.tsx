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
  Gift,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/hooks/use-auth";
import { useMembers } from "@/hooks/use-members";
import { useLocale } from "@/lib/i18n/use-locale";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Activity as BarChart3 } from "lucide-react";
import { shareMediFamily } from "@/lib/utils/share-app";

const menuSections = [
  {
    titleKey: "more.health_tools",
    items: [
      { href: "/smart-records", icon: Activity, labelKey: "more.health_overview" },
      { href: "/vitals", icon: BarChart3, labelKey: "more.vitals" },
      { href: "/timeline", icon: Clock, labelKey: "more.timeline" },
      { href: "/appointments", icon: CalendarDays, labelKey: "more.appointments" },
      { href: "/emergency-card", icon: Heart, labelKey: "more.emergency_card" },
      { href: "/medicine-checker", icon: Zap, labelKey: "more.medicine_checker" },
      { href: "/health-risk", icon: AlertTriangle, labelKey: "more.risk_assessment" },
      { href: "/badges", icon: Award, labelKey: "more.badges" },
      { href: "/more/export", icon: Download, labelKey: "more.download_report" },
    ],
  },
  {
    titleKey: "more.sharing",
    items: [
      { href: "/more/shared-links", icon: Share2, labelKey: "more.share_doctor" },
      { href: "/abha", icon: Shield, labelKey: "more.abha" },
      { href: "/more/family-group", icon: Users, labelKey: "more.family_group" },
    ],
  },
  {
    titleKey: "more.account",
    items: [
      { href: "/more/settings", icon: Settings, labelKey: "more.settings" },
      { href: "/more/feedback", icon: MessageSquare, labelKey: "more.feedback" },
    ],
  },
];

export default function MorePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { members } = useMembers();
  const { t } = useLocale();

  // Use the "self" member's name as the display name (since signup doesn't collect name)
  const selfMember = members.find((m) => m.relation === "self");
  const displayName = user?.name || selfMember?.name || "";

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <div>
      <AppHeader title={t("more.title")} />
      <div className="p-4 space-y-4">
        {/* User Info — clickable to open self profile for editing */}
        {user && (
          <Card>
            <CardContent className="p-0">
              <button
                onClick={() => {
                  if (selfMember) {
                    router.push(`/family/${selfMember.id}/edit`);
                  } else {
                    router.push("/family/add");
                  }
                }}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName || "Add your name"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        )}

        {menuSections.map((section) => (
          <div key={section.titleKey}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">{t(section.titleKey)}</p>
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
                          <p className="text-sm font-medium">{t(item.labelKey)}</p>
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

        {/* Share MediFamily */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-0">
            <button
              onClick={shareMediFamily}
              className="flex items-center gap-3 p-4 w-full hover:bg-primary/10 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">{t("more.share_app")}</p>
                <p className="text-xs text-muted-foreground">{t("more.share_app_desc")}</p>
              </div>
              <Share2 className="h-4 w-4 text-primary" />
            </button>
          </CardContent>
        </Card>

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
            <span className="text-xs">MediFamily v1.0 — Your data stays private</span>
          </div>
        </div>
      </div>
    </div>
  );
}
