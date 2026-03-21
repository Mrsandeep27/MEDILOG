"use client";

import { Download, Share, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePWAInstall } from "@/hooks/use-pwa-install";

export function PWAInstallBanner() {
  const { canInstall, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  // iOS instructions
  if (isIOS) {
    return (
      <Card className="mx-4 mt-4 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Install MediLog</p>
                <p className="text-xs text-muted-foreground">
                  Tap <Share className="h-3 w-3 inline" /> then &quot;Add to Home Screen&quot;
                </p>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="p-1">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Chrome/Android install prompt
  if (canInstall) {
    return (
      <Card className="mx-4 mt-4 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Install MediLog</p>
                <p className="text-xs text-muted-foreground">
                  Add to home screen for quick access
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                Later
              </Button>
              <Button size="sm" onClick={install}>
                Install
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export function PWAInstallButton() {
  const { canInstall, isInstalled, isIOS, install } = usePWAInstall();

  if (isInstalled) return null;

  if (isIOS) {
    return (
      <Button variant="outline" className="w-full gap-2">
        <Share className="h-4 w-4" />
        Tap Share → Add to Home Screen
      </Button>
    );
  }

  if (canInstall) {
    return (
      <Button onClick={install} className="w-full gap-2">
        <Download className="h-4 w-4" />
        Install MediLog App
      </Button>
    );
  }

  return null;
}
