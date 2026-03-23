// ABDM (Ayushman Bharat Digital Mission) API Client
// Sandbox: https://healthidsbx.abdm.gov.in
// Production: https://healthid.abdm.gov.in

const ABDM_BASE = process.env.ABDM_ENV === "production"
  ? "https://healthid.abdm.gov.in"
  : "https://healthidsbx.abdm.gov.in";

const ABDM_GATEWAY = process.env.ABDM_ENV === "production"
  ? "https://live.abdm.gov.in"
  : "https://dev.abdm.gov.in";

const CLIENT_ID = process.env.ABDM_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ABDM_CLIENT_SECRET || "";

let cachedToken: { token: string; expiresAt: number } | null = null;

// Get ABDM access token (cached)
export async function getAbdmToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("ABDM credentials not configured");
  }

  const res = await fetch(`${ABDM_GATEWAY}/gateway/v0.5/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ABDM auth failed: ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expiresIn - 60) * 1000, // expire 1 min early
  };

  return cachedToken.token;
}

// Helper to make authenticated ABDM API calls
export async function abdmFetch(
  path: string,
  options: RequestInit = {},
  useGateway = false
): Promise<Response> {
  const token = await getAbdmToken();
  const base = useGateway ? ABDM_GATEWAY : ABDM_BASE;

  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CM-ID": process.env.ABDM_ENV === "production" ? "abdm" : "sbx",
      ...options.headers,
    },
  });
}

// ============================================================
// M1: ABHA Creation & Linking
// ============================================================

// Step 1: Generate Aadhaar OTP
export async function generateAadhaarOtp(aadhaar: string) {
  const res = await abdmFetch("/api/v1/registration/aadhaar/generateOtp", {
    method: "POST",
    body: JSON.stringify({ aadhaar }),
  });
  return res.json();
}

// Step 2: Verify Aadhaar OTP
export async function verifyAadhaarOtp(txnId: string, otp: string) {
  const res = await abdmFetch("/api/v1/registration/aadhaar/verifyOTP", {
    method: "POST",
    body: JSON.stringify({ txnId, otp }),
  });
  return res.json();
}

// Step 3: Generate Mobile OTP
export async function generateMobileOtp(txnId: string, mobile: string) {
  const res = await abdmFetch("/api/v1/registration/aadhaar/generateMobileOTP", {
    method: "POST",
    body: JSON.stringify({ txnId, mobile }),
  });
  return res.json();
}

// Step 4: Verify Mobile OTP & Create ABHA
export async function verifyMobileOtpAndCreate(txnId: string, otp: string) {
  const res = await abdmFetch("/api/v1/registration/aadhaar/verifyMobileOTP", {
    method: "POST",
    body: JSON.stringify({ txnId, otp }),
  });
  return res.json();
}

// Create Health ID after verification
export async function createHealthId(
  txnId: string,
  healthId: string,
  firstName: string,
  lastName: string
) {
  const res = await abdmFetch("/api/v1/registration/aadhaar/createHealthIdWithPreVerified", {
    method: "POST",
    body: JSON.stringify({
      txnId,
      healthId,
      firstName,
      lastName,
    }),
  });
  return res.json();
}

// Search ABHA by Health ID
export async function searchByHealthId(healthId: string) {
  const res = await abdmFetch("/api/v1/search/searchByHealthId", {
    method: "POST",
    body: JSON.stringify({ healthId }),
  });
  return res.json();
}

// Login with ABHA number + Aadhaar OTP
export async function loginWithAadhaar(aadhaar: string) {
  const res = await abdmFetch("/api/v2/auth/init", {
    method: "POST",
    body: JSON.stringify({
      authMethod: "AADHAAR_OTP",
      healthid: aadhaar,
    }),
  });
  return res.json();
}

// Login with ABHA number + Mobile OTP
export async function loginWithMobile(healthId: string) {
  const res = await abdmFetch("/api/v2/auth/init", {
    method: "POST",
    body: JSON.stringify({
      authMethod: "MOBILE_OTP",
      healthid: healthId,
    }),
  });
  return res.json();
}

// Confirm login with OTP
export async function confirmAuth(txnId: string, otp: string) {
  const res = await abdmFetch("/api/v2/auth/confirmWithAadhaarOtp", {
    method: "POST",
    body: JSON.stringify({ txnId, otp }),
  });
  return res.json();
}

// Get ABHA profile
export async function getAbhaProfile(xToken: string) {
  const res = await abdmFetch("/api/v1/account/profile", {
    method: "GET",
    headers: { "X-Token": xToken },
  });
  return res.json();
}

// Get ABHA card (QR code)
export async function getAbhaCard(xToken: string) {
  const res = await abdmFetch("/api/v1/account/getCard", {
    method: "GET",
    headers: { "X-Token": xToken },
  });
  return res.blob();
}

// ============================================================
// M3: HIU - Fetch Patient Records (Consent-based)
// ============================================================

// Request consent to access patient records
export async function requestConsent(
  patientId: string,
  hiuId: string,
  purpose: string = "CAREMGT"
) {
  const requestId = crypto.randomUUID();
  const res = await abdmFetch(
    "/gateway/v0.5/consent-requests/init",
    {
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
            ).toISOString(), // 30 days
            frequency: { unit: "HOUR", value: 1, repeats: 0 },
          },
        },
      }),
    },
    true // use gateway
  );
  return { requestId, response: await res.json() };
}

// Fetch health information after consent granted
export async function fetchHealthInfo(
  consentId: string,
  dataPushUrl: string,
  keyMaterial: { publicKey: string; nonce: string }
) {
  const requestId = crypto.randomUUID();
  const res = await abdmFetch(
    "/gateway/v0.5/health-information/cm/request",
    {
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
    },
    true
  );
  return { requestId, response: await res.json() };
}
