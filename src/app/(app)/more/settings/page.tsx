"use client";

import { useState } from "react";
import { Lock, Bell, Globe, Palette, Sun, Moon, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/layout/app-header";
import { useSettingsStore } from "@/stores/settings-store";
import { hashPin } from "@/lib/auth/pin";
import { toast } from "sonner";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const {
    pinEnabled,
    setPinEnabled,
    setPinHash,
    language,
    setLanguage,
    notificationsEnabled,
    setNotificationsEnabled,
  } = useSettingsStore();

  const { theme, setTheme: setNextTheme } = useTheme();
  const [pinInput, setPinInput] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);

  const handleSetPin = async () => {
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      toast.error("PIN must be 4 digits");
      return;
    }
    const hash = await hashPin(pinInput);
    setPinHash(hash);
    setPinEnabled(true);
    setPinInput("");
    setShowPinSetup(false);
    toast.success("PIN lock enabled!");
  };

  const handleDisablePin = () => {
    setPinEnabled(false);
    setPinHash(null);
    toast.success("PIN lock disabled");
  };

  return (
    <div>
      <AppHeader title="Settings" showBack />
      <div className="p-4 space-y-4">
        {/* PIN Lock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              App Lock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pinEnabled ? (
              <div className="flex items-center justify-between">
                <span className="text-sm">PIN Lock is enabled</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisablePin}
                >
                  Disable
                </Button>
              </div>
            ) : showPinSetup ? (
              <div className="space-y-2">
                <Label>Enter 4-digit PIN</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) =>
                      setPinInput(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="0000"
                    className="w-24 text-center text-lg tracking-widest"
                  />
                  <Button onClick={handleSetPin} size="sm">
                    Set PIN
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPinSetup(false);
                      setPinInput("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPinSetup(true)}
              >
                Enable PIN Lock
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Lock the app after 5 minutes of inactivity
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Medicine Reminders</p>
                <p className="text-xs text-muted-foreground">
                  Get notified for medicine reminders
                </p>
              </div>
              <Button
                variant={notificationsEnabled ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setNotificationsEnabled(!notificationsEnabled)
                }
              >
                {notificationsEnabled ? "On" : "Off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setNextTheme("light")}
              >
                <Sun className="h-4 w-4 mr-1" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setNextTheme("dark")}
              >
                <Moon className="h-4 w-4 mr-1" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setNextTheme("system")}
              >
                <Monitor className="h-4 w-4 mr-1" />
                System
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Language
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={language === "en" ? "default" : "outline"}
                size="sm"
                onClick={() => setLanguage("en")}
              >
                English
              </Button>
              <Button
                variant={language === "hi" ? "default" : "outline"}
                size="sm"
                onClick={() => setLanguage("hi")}
              >
                Hindi
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
