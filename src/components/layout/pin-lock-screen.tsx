"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Shield, Delete } from "lucide-react";
import { verifyPin } from "@/lib/auth/pin";
import { useSettingsStore } from "@/stores/settings-store";
import { PIN_LENGTH, PIN_LOCK_TIMEOUT_MS } from "@/constants/config";
import { cn } from "@/lib/utils";

export function PinLockScreen() {
  const { pinEnabled, pinHash, setLastActiveAt } = useSettingsStore();
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  // Set up activity tracking + lock check (stable deps, no churn)
  useEffect(() => {
    if (!pinEnabled || !pinHash) return;

    // Check on mount if we should lock
    const timeSinceActive = Date.now() - useSettingsStore.getState().lastActiveAt;
    if (timeSinceActive > PIN_LOCK_TIMEOUT_MS) {
      setIsLocked(true);
    }

    const handleActivity = () => {
      if (!isLockedRef.current) {
        setLastActiveAt(Date.now());
      }
    };

    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    // Check lock periodically
    const interval = setInterval(() => {
      const timeSince = Date.now() - useSettingsStore.getState().lastActiveAt;
      if (timeSince > PIN_LOCK_TIMEOUT_MS) {
        setIsLocked(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      clearInterval(interval);
    };
  }, [pinEnabled, pinHash, setLastActiveAt]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= PIN_LENGTH) return;
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);

      if (newPin.length === PIN_LENGTH && pinHash) {
        verifyPin(newPin, pinHash).then((valid) => {
          if (valid) {
            setIsLocked(false);
            setPin("");
            setLastActiveAt(Date.now());
          } else {
            setError(true);
            setTimeout(() => setPin(""), 300);
          }
        });
      }
    },
    [pin, pinHash, setLastActiveAt]
  );

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }, []);

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6">
      <Shield className="h-12 w-12 text-primary mb-4" />
      <h2 className="text-xl font-semibold mb-1">MediLog is Locked</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Enter your PIN to unlock
      </p>

      {/* PIN dots */}
      <div className="flex gap-3 mb-8">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition-all",
              i < pin.length
                ? error
                  ? "bg-destructive border-destructive"
                  : "bg-primary border-primary"
                : "border-muted-foreground"
            )}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive mb-4">Incorrect PIN</p>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-4 max-w-[260px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map(
          (key) => {
            if (key === "") return <div key="empty" />;
            if (key === "del") {
              return (
                <button
                  key="del"
                  onClick={handleDelete}
                  className="h-16 w-16 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Delete className="h-6 w-6" />
                </button>
              );
            }
            return (
              <button
                key={key}
                onClick={() => handleDigit(key)}
                className="h-16 w-16 rounded-full text-2xl font-medium hover:bg-muted transition-colors"
              >
                {key}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}
