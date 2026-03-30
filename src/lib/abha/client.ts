// ABDM (Ayushman Bharat Digital Mission) ABHA V3 API Client
// Fully compliant with ABDM V3 specification
// Docs: docs/ABDM_ABHA_V3_AP_Is_V1_31_07_2025_869ab8cda9.pdf

import crypto from "crypto";

// ─── Environment ────────────────────────────────────────────────────────────
const ABDM_BASE = process.env.ABDM_ENV === "production"
  ? "https://abhasbx.abdm.gov.in"     // Production: https://abha.abdm.gov.in
  : "https://abhasbx.abdm.gov.in";    // Sandbox

const CLIENT_ID = process.env.ABDM_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ABDM_CLIENT_SECRET || "";

// ─── Token Management (V3: Section 1.0) ─────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAbdmToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("ABDM credentials not configured");
  }

  const res = await fetch(`${ABDM_BASE}/api/v3/token/generate-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      grantType: "client_credentials",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ABDM token generation failed: ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.accessToken || data.token,
    expiresAt: Date.now() + ((data.expiresIn || 1800) - 60) * 1000, // expire 1 min early
  };

  return cachedToken.token;
}

// ─── RSA Encryption (V3: Section 2.0 — MANDATORY) ───────────────────────────
// All Aadhaar, Mobile, OTP values MUST be encrypted before sending to ABDM

let cachedPublicKey: { key: string; expiresAt: number } | null = null;

async function getAbdmPublicKey(): Promise<string> {
  if (cachedPublicKey && Date.now() < cachedPublicKey.expiresAt) {
    return cachedPublicKey.key;
  }

  const token = await getAbdmToken();
  const res = await fetch(`${ABDM_BASE}/api/v3/profile/public/certificate`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch ABDM public key");
  }

  const data = await res.json();
  const publicKey = data.publicKey || data.certificate || data;

  cachedPublicKey = {
    key: typeof publicKey === "string" ? publicKey : JSON.stringify(publicKey),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // cache 12 hours
  };

  return cachedPublicKey.key;
}

async function encryptWithAbdmKey(plainText: string): Promise<string> {
  const publicKeyPem = await getAbdmPublicKey();
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(plainText, "utf-8")
  );
  return encrypted.toString("base64");
}

// ─── Authenticated Fetch Helper ─────────────────────────────────────────────
async function abdmFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAbdmToken();

  const res = await fetch(`${ABDM_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      REQUEST_ID: crypto.randomUUID(),
      TIMESTAMP: new Date().toISOString(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "Unknown error");
    console.error(`[ABDM] ${path} failed:`, res.status, errorBody);
    throw new Error(`ABDM API error (${res.status}): ${errorBody}`);
  }

  return res;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABHA CREATION VIA AADHAAR (V3: Section 3.0)
// Flow: Generate OTP → Verify OTP → Enrol ABHA → Mobile Verify → Create Address
// ═══════════════════════════════════════════════════════════════════════════════

// Step 1: Generate Aadhaar OTP (V3: Section 3.0, Step 1)
export async function generateAadhaarOtp(aadhaar: string) {
  const encryptedAadhaar = await encryptWithAbdmKey(aadhaar);

  const res = await abdmFetch("/api/v3/enrollment/request/otp", {
    method: "POST",
    body: JSON.stringify({
      scope: ["abha-enrol", "dl-flow"],
      loginHint: "aadhaar",
      loginId: encryptedAadhaar,
      otpSystem: "aadhaar",
    }),
  });

  return res.json();
}

// Step 2: Verify Aadhaar OTP (V3: Section 3.0, Step 3)
export async function verifyAadhaarOtp(txnId: string, otp: string) {
  const encryptedOtp = await encryptWithAbdmKey(otp);

  const res = await abdmFetch("/api/v3/enrollment/auth/byAadhaar", {
    method: "POST",
    body: JSON.stringify({
      authData: {
        authMethods: ["otp"],
        otp: { txnId, otpValue: encryptedOtp },
      },
    }),
  });

  return res.json();
}

// Step 3: Generate Mobile OTP for ABHA creation (V3: Section 3.0, Step 4)
export async function generateMobileOtp(txnId: string, mobile: string) {
  const encryptedMobile = await encryptWithAbdmKey(mobile);

  const res = await abdmFetch("/api/v3/enrollment/request/otp", {
    method: "POST",
    body: JSON.stringify({
      scope: ["abha-enrol", "mobile-verify"],
      loginHint: "mobile",
      loginId: encryptedMobile,
      otpSystem: "abdm",
      txnId,
    }),
  });

  return res.json();
}

// Step 4: Verify Mobile OTP & Create ABHA (V3: Section 3.0, Step 4+5)
export async function verifyMobileOtpAndCreate(txnId: string, otp: string) {
  const encryptedOtp = await encryptWithAbdmKey(otp);

  const res = await abdmFetch("/api/v3/enrollment/auth/byAbdm", {
    method: "POST",
    body: JSON.stringify({
      authData: {
        authMethods: ["otp"],
        otp: { txnId, otpValue: encryptedOtp },
      },
    }),
  });

  return res.json();
}

// Step 5: Create Health ID / ABHA Address (V3: Section 3.0, Step 6)
export async function createHealthId(
  txnId: string,
  healthId: string,
  firstName: string,
  lastName: string
) {
  const res = await abdmFetch("/api/v3/enrollment/enrol/abha-address", {
    method: "POST",
    body: JSON.stringify({
      txnId,
      abhaAddress: healthId,
      preferred: true,
    }),
  });

  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABHA VERIFICATION / LOGIN (V3: Section 7.0)
// ═══════════════════════════════════════════════════════════════════════════════

// Search by Health ID
export async function searchByHealthId(healthId: string) {
  const res = await abdmFetch("/api/v3/profile/login/request/otp", {
    method: "POST",
    body: JSON.stringify({
      scope: ["abha-login"],
      loginHint: "abha-number",
      loginId: healthId,
      otpSystem: "abdm",
    }),
  });

  return res.json();
}

// Login via Mobile OTP (V3: Section 7.4)
export async function loginWithMobile(healthId: string) {
  const encryptedId = await encryptWithAbdmKey(healthId);

  const res = await abdmFetch("/api/v3/profile/login/request/otp", {
    method: "POST",
    body: JSON.stringify({
      scope: ["abha-login", "mobile-verify"],
      loginHint: "mobile",
      loginId: encryptedId,
      otpSystem: "abdm",
    }),
  });

  return res.json();
}

// Login via Aadhaar OTP (V3: Section 7.1)
export async function loginWithAadhaar(healthId: string) {
  const encryptedId = await encryptWithAbdmKey(healthId);

  const res = await abdmFetch("/api/v3/profile/login/request/otp", {
    method: "POST",
    body: JSON.stringify({
      scope: ["abha-login", "aadhaar-verify"],
      loginHint: "aadhaar",
      loginId: encryptedId,
      otpSystem: "aadhaar",
    }),
  });

  return res.json();
}

// Confirm Login with OTP (V3: Section 7.1-7.4, verify step)
export async function confirmAuth(txnId: string, otp: string) {
  const encryptedOtp = await encryptWithAbdmKey(otp);

  const res = await abdmFetch("/api/v3/profile/login/verify", {
    method: "POST",
    body: JSON.stringify({
      authData: {
        authMethods: ["otp"],
        otp: { txnId, otpValue: encryptedOtp },
      },
    }),
  });

  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE (V3: Section 9.0)
// ═══════════════════════════════════════════════════════════════════════════════

// Get ABHA profile
export async function getAbhaProfile(xToken: string) {
  const res = await abdmFetch("/api/v3/profile/account", {
    method: "GET",
    headers: { "X-Token": `Bearer ${xToken}` },
  });

  return res.json();
}

// Get ABHA card (QR code)
export async function getAbhaCard(xToken: string) {
  const token = await getAbdmToken();
  const res = await fetch(`${ABDM_BASE}/api/v3/profile/account/abha-card`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Token": `Bearer ${xToken}`,
    },
  });

  return res.blob();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIU — Health Information (Consent-based record pull)
// ═══════════════════════════════════════════════════════════════════════════════

// Allowed domains — prevent SSRF
const ALLOWED_DATA_PUSH_DOMAINS = [
  "abhasbx.abdm.gov.in",
  "abha.abdm.gov.in",
  "live.abdm.gov.in",
  "dev.abdm.gov.in",
  "medi--log.vercel.app",
];

function validateDataPushUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_DATA_PUSH_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Request consent to access patient records
export async function requestConsent(
  patientId: string,
  hiuId: string,
  purpose: string = "CAREMGT"
) {
  const requestId = crypto.randomUUID();
  const res = await abdmFetch("/v0.5/consent-requests/init", {
    method: "POST",
    body: JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      consent: {
        purpose: { text: "Health record access", code: purpose },
        patient: { id: patientId },
        hiu: { id: hiuId },
        requester: {
          name: "MediLog",
          identifier: {
            type: "REGNO",
            value: hiuId,
            system: "https://medi--log.vercel.app",
          },
        },
        hiTypes: [
          "OPConsultation",
          "Prescription",
          "DischargeSummary",
          "DiagnosticReport",
          "ImmunizationRecord",
          "HealthDocumentRecord",
          "WellnessRecord",
        ],
        permission: {
          accessMode: "VIEW",
          dateRange: {
            from: "2020-01-01T00:00:00.000Z",
            to: new Date().toISOString(),
          },
          dataEraseAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          frequency: { unit: "HOUR", value: 1, repeats: 0 },
        },
      },
    }),
  });

  return { requestId, response: await res.json() };
}

// Fetch health information after consent granted
export async function fetchHealthInfo(
  consentId: string,
  dataPushUrl: string,
  keyMaterial: { publicKey: string; nonce: string }
) {
  if (!validateDataPushUrl(dataPushUrl)) {
    throw new Error("Invalid dataPushUrl: must be HTTPS to an allowed ABDM domain");
  }

  const requestId = crypto.randomUUID();
  const res = await abdmFetch("/v0.5/health-information/cm/request", {
    method: "POST",
    body: JSON.stringify({
      requestId,
      timestamp: new Date().toISOString(),
      hiRequest: {
        consent: { id: consentId },
        dateRange: {
          from: "2020-01-01T00:00:00.000Z",
          to: new Date().toISOString(),
        },
        dataPushUrl,
        keyMaterial: {
          cryptoAlg: "ECDH",
          curve: "Curve25519",
          dhPublicKey: {
            expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            parameters: "Curve25519/32byte random key",
            keyValue: keyMaterial.publicKey,
          },
          nonce: keyMaterial.nonce,
        },
      },
    }),
  });

  return { requestId, response: await res.json() };
}
