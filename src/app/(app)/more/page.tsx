"use client";

import Link from "next/link";
import {
  Settings,
  Share2,
  Download,
  LogOut,
  ChevronRight,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const menuItems = [
  {
    href: "/more/settings",
    icon: Settings,
    label: "Settings",
    description: "Language, theme, notifications, PIN",
  },
  {
    href: "/more/shared-links",
    icon: Share2,
    label: "Shared Links",
    description: "Manage active doctor sharing links",
  },
  {
    href: "/more/export",
    icon: Download,
    label: "Export Data",
    description: "Download all records as JSON or CSV",
  },
];

export default function MorePage() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <div>
      <AppHeader title="More" />
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <div key={item.href}>
                <Link href={item.href}>
                  <div className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
                {index < menuItems.length - 1 && <Separator />}
              </div>
            ))}
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
              <p className="text-sm font-medium">Sign Out</p>
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
