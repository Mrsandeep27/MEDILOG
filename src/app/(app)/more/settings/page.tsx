"use client";

import { useState } from "react";
import { Lock, Bell, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { useSettingsStore } from "@/stores/settings-store";
import { hashPin } from "@/lib/auth/pin";
import { toast } from "sonner";
import { useLocale } from "@/lib/i18n/use-locale";
import { requestNotificationPermission } from "@/lib/notifications/web-push";

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

  const { t } = useLocale();
  const [pinInput, setPinInput] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);

  const handleSetPin = async () => {
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      toast.error(t("settings.pin_error"));
      return;
    }
    const hash = await hashPin(pinInput);
    setPinHash(hash);
    setPinEnabled(true);
    setPinInput("");
    setShowPinSetup(false);
    toast.success(t("settings.pin_success"));
  };

  const handleDisablePin = () => {
    setPinEnabled(false);
    setPinHash(null);
    toast.success(t("settings.pin_disabled"));
  };

  return (
    <div>
      <AppHeader title={t("settings.title")} showBack />
      <div className="p-4 space-y-4">
        {/* PIN Lock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {t("settings.pin_lock")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pinEnabled ? (
              <div className="flex items-center justify-between">
                <span className="text-sm">{t("settings.pin_enabled")}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisablePin}
                >
                  {t("settings.pin_disable")}
                </Button>
              </div>
            ) : showPinSetup ? (
              <div className="space-y-2">
                <Label>{t("settings.pin_enter")}</Label>
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
                    {t("settings.pin_set")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPinSetup(false);
                      setPinInput("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPinSetup(true)}
              >
                {t("settings.pin_enable")}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {t("settings.pin_desc")}
            </p>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t("settings.notifications")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("settings.medicine_reminders")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("settings.medicine_reminders_desc")}
                </p>
              </div>
              <Button
                variant={notificationsEnabled ? "default" : "outline"}
                size="sm"
                onClick={async () => {
                  if (!notificationsEnabled) {
                    const granted = await requestNotificationPermission();
                    if (!granted) {
                      toast.error(t("common.error"));
                      return;
                    }
                  }
                  setNotificationsEnabled(!notificationsEnabled);
                }}
              >
                {notificationsEnabled ? t("settings.on") : t("settings.off")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("settings.language")}
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
