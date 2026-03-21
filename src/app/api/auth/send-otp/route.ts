import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit Indian mobile number" },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Upsert user by phone
    let user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          email: `${phone}@medilog.app`,
          password_hash: otp, // Store OTP temporarily as password_hash
          name: "",
        },
      });
    }

    // Store OTP (reuse password_hash field for simplicity)
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: `otp:${otp}:${expiresAt.toISOString()}` },
    });

    // In production: send OTP via SMS (Twilio/MSG91)
    // For now: return OTP in response for development
    const isDev = process.env.NODE_ENV !== "production";

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
      ...(isDev && { otp }), // Only show OTP in development
      isNewUser: !user.name,
    });
  } catch (err) {
    console.error("Send OTP error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
