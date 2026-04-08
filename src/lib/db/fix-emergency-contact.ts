"use client";

import { db } from "./dexie";

const FIX_FLAG = "medifamily-fix-emergency-contact-v1";
const PHONE_RE = /^[6-9]\d{9}$/;

/**
 * One-time data fixup: if a member's emergency_contact_name looks like
 * an Indian mobile number AND emergency_contact_phone is empty, move
 * the value into the phone field. Caused by an earlier form version
 * that only had a single combined field.
 *
 * Safe to call multiple times — guarded by a localStorage flag.
 */
export async function fixEmergencyContactFields(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(FIX_FLAG) === "done") return;

  try {
    const members = await db.members.toArray();
    let fixed = 0;

    for (const m of members) {
      const name = (m.emergency_contact_name || "").trim();
      const phone = (m.emergency_contact_phone || "").trim();

      if (PHONE_RE.test(name) && !phone) {
        await db.members.update(m.id, {
          emergency_contact_name: "",
          emergency_contact_phone: name,
          updated_at: new Date().toISOString(),
          sync_status: "pending",
        });
        fixed++;
      }
    }

    if (fixed > 0) {
      console.log(`[fix-emergency-contact] Moved phone-shaped value out of name field on ${fixed} member(s)`);
    }

    localStorage.setItem(FIX_FLAG, "done");
  } catch (err) {
    console.error("[fix-emergency-contact] Failed:", err);
    // Don't set the flag — retry next load
  }
}
