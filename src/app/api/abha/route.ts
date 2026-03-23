import { NextRequest, NextResponse } from "next/server";
import {
  generateAadhaarOtp,
  verifyAadhaarOtp,
  generateMobileOtp,
  verifyMobileOtpAndCreate,
  createHealthId,
  searchByHealthId,
  loginWithMobile,
  confirmAuth,
  getAbhaProfile,
} from "@/lib/abha/client";

// POST /api/abha — handles all ABHA operations via "action" field
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Check if ABDM is configured
    if (!process.env.ABDM_CLIENT_ID || !process.env.ABDM_CLIENT_SECRET) {
      return NextResponse.json(
        {
          error: "ABDM integration not configured yet",
          message: "Sandbox credentials pending. Please check back later.",
          configured: false,
        },
        { status: 503 }
      );
    }

    switch (action) {
      // ============================================================
      // M1: ABHA Creation via Aadhaar
      // ============================================================
      case "generate-aadhaar-otp": {
        const { aadhaar } = body;
        if (!aadhaar || aadhaar.length !== 12) {
          return NextResponse.json({ error: "Valid 12-digit Aadhaar required" }, { status: 400 });
        }
        const result = await generateAadhaarOtp(aadhaar);
        return NextResponse.json(result);
      }

      case "verify-aadhaar-otp": {
        const { txnId, otp } = body;
        if (!txnId || !otp) {
          return NextResponse.json({ error: "txnId and otp required" }, { status: 400 });
        }
        const result = await verifyAadhaarOtp(txnId, otp);
        return NextResponse.json(result);
      }

      case "generate-mobile-otp": {
        const { txnId, mobile } = body;
        if (!txnId || !mobile) {
          return NextResponse.json({ error: "txnId and mobile required" }, { status: 400 });
        }
        const result = await generateMobileOtp(txnId, mobile);
        return NextResponse.json(result);
      }

      case "verify-mobile-create": {
        const { txnId, otp } = body;
        if (!txnId || !otp) {
          return NextResponse.json({ error: "txnId and otp required" }, { status: 400 });
        }
        const result = await verifyMobileOtpAndCreate(txnId, otp);
        return NextResponse.json(result);
      }

      case "create-health-id": {
        const { txnId, healthId, firstName, lastName } = body;
        const result = await createHealthId(txnId, healthId, firstName, lastName);
        return NextResponse.json(result);
      }

      // ============================================================
      // M1: ABHA Linking (existing ABHA)
      // ============================================================
      case "search-abha": {
        const { healthId } = body;
        if (!healthId) {
          return NextResponse.json({ error: "healthId required" }, { status: 400 });
        }
        const result = await searchByHealthId(healthId);
        return NextResponse.json(result);
      }

      case "login-mobile-otp": {
        const { healthId } = body;
        if (!healthId) {
          return NextResponse.json({ error: "healthId required" }, { status: 400 });
        }
        const result = await loginWithMobile(healthId);
        return NextResponse.json(result);
      }

      case "confirm-auth": {
        const { txnId, otp } = body;
        if (!txnId || !otp) {
          return NextResponse.json({ error: "txnId and otp required" }, { status: 400 });
        }
        const result = await confirmAuth(txnId, otp);
        return NextResponse.json(result);
      }

      case "get-profile": {
        const { xToken } = body;
        if (!xToken) {
          return NextResponse.json({ error: "xToken required" }, { status: 400 });
        }
        const result = await getAbhaProfile(xToken);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "ABHA operation failed";
    console.error("[ABHA API Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
