"use client";

/**
 * Request browser notification permission.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Get the active Service Worker registration.
 * Returns null if SW is not available.
 */
async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

/**
 * Show a notification via Service Worker (works in background + mobile).
 * Falls back to basic Notification API if SW is unavailable.
 */
export async function showNotification(
  title: string,
  options?: NotificationOptions & { data?: Record<string, unknown> }
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const reg = await getSWRegistration();

  if (reg) {
    // Use SW — works in background, on mobile, with action buttons
    await reg.showNotification(title, {
      icon: "/logo.png",
      badge: "/logo.png",
      ...options,
    });
  } else {
    // Fallback — basic Notification API (foreground only)
    const notification = new Notification(title, {
      icon: "/logo.png",
      badge: "/logo.png",
      ...options,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

/**
 * Show an appointment reminder notification.
 * Fired ~3 hours before the scheduled appointment time.
 */
export async function showAppointmentNotification(
  doctorName: string,
  hospital: string,
  memberName: string,
  timeLabel: string,
  appointmentId: string
): Promise<void> {
  const bodyParts = [
    `In 3 hours · ${timeLabel}`,
    hospital || null,
    memberName ? `for ${memberName}` : null,
  ].filter((v): v is string => !!v);

  await showNotification(`📅 Upcoming: Dr. ${doctorName}`, {
    body: bodyParts.join(" · "),
    tag: `appointment-${appointmentId}`,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      type: "appointment-reminder",
      appointmentId,
      url: "/appointments",
    },
  } as NotificationOptions & { data: Record<string, unknown> });
}

/**
 * Show a medicine reminder notification with action buttons.
 * Uses SW for background delivery + vibration.
 */
export async function showReminderNotification(
  medicineName: string,
  memberName: string,
  dosage?: string,
  beforeFood?: boolean,
  reminderId?: string
): Promise<void> {
  const bodyParts = [
    dosage,
    beforeFood !== undefined
      ? beforeFood
        ? "Before food"
        : "After food"
      : null,
    memberName ? `for ${memberName}` : null,
  ].filter((v): v is string => v !== null && v !== undefined);

  const body = bodyParts.join(" · ");

  await showNotification(`💊 Time for ${medicineName}`, {
    body,
    tag: `reminder-${reminderId || medicineName}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: "taken", title: "✅ Taken" },
      { action: "snooze", title: "⏰ Snooze 10min" },
    ],
    data: {
      type: "medicine-reminder",
      reminderId: reminderId || "",
      medicineName,
      url: "/reminders",
    },
  } as NotificationOptions & { data: Record<string, unknown> });
}
