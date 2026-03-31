"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FolderOpen, MoreHorizontal, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/use-locale";

const navItems = [
  { href: "/home", labelKey: "nav.home", icon: Home },
  { href: "/family", labelKey: "nav.family", icon: Users },
  { href: "/scan", labelKey: "nav.scan", icon: ScanLine, isFab: true },
  { href: "/records", labelKey: "nav.records", icon: FolderOpen },
  { href: "/more", labelKey: "nav.more", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] mt-0.5 font-medium">
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
