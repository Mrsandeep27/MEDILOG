import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  // Honeypot — bots fill this, real users don't see it
  website: z.string().max(0).optional().default(""),
  // Timestamp when form was rendered (bot detection)
  _t: z.number(),
});

// Prevent duplicate in-flight signups (per-instance, same as rate limiter)
const inflightEmails = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Unable to process request. Please check your input." },
        { status: 400 }
      );
    }

    const { email, password, website, _t } = parsed.data;

    // Bot check 1: honeypot field must be empty
    if (website && website.length > 0) {
      // Return success-like response to not tip off the bot
      return NextResponse.json({ success: true, message: "Check your email" });
    }

    // Bot check 2: form must have been open for at least 2 seconds
    const elapsed = Date.now() - _t;
    if (elapsed < 2000) {
      return NextResponse.json({ success: true, message: "Check your email" });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Idempotency: prevent duplicate in-flight signups for same email
    if (inflightEmails.has(normalizedEmail)) {
      return NextResponse.json({ success: true, message: "Check your email" });
    }

    inflightEmails.add(normalizedEmail);

    try {
      const origin = request.headers.get("origin") || request.nextUrl.origin;

      const { error } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: false,
      });

      if (error) {
        // Don't reveal whether the email exists — always return generic success
        // Log server-side for debugging
        console.error("[signup] Supabase error:", error.message);
      }

      // Send verification email regardless (Supabase handles dedup)
      // Use the regular client to trigger the email flow
      const { createClient } = await import("@supabase/supabase-js");
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // If user already exists, this won't create a duplicate
      // If user was just created, this sends the verification email
      await anonClient.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      // Always return same response — prevents email enumeration
      return NextResponse.json({
        success: true,
        message: "Check your email",
      });
    } finally {
      inflightEmails.delete(normalizedEmail);
    }
  } catch (err) {
    console.error("[signup] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unable to process request. Please try again." },
      { status: 500 }
    );
  }
}
