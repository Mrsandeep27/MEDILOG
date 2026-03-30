"use client";

import { useState } from "react";
import { ArrowLeft, Smartphone, CreditCard, Link2, Shield, Loader2, CheckCircle, AlertTriangle, Info, Fingerprint } from "lucide-react";
import Link from "next/link";
import { useMembers } from "@/hooks/use-members";

type Step =
  | "home"
  // Create new ABHA
  | "create-aadhaar" | "create-otp" | "create-mobile" | "create-mobile-otp"
  // Link via Mobile OTP
  | "link-mobile" | "link-mobile-otp"
  // Link via Aadhaar OTP
  | "link-aadhaar" | "link-aadhaar-otp"
  // Link via ABHA number directly
  | "link-abha-number" | "link-abha-otp"
  // Done
  | "success";

export default function AbhaPage() {
  const { members } = useMembers();
  const selfMember = members.find((m) => m.relation === "self");

  const [step, setStep] = useState<Step>("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [txnId, setTxnId] = useState("");
  const [linkMethod, setLinkMethod] = useState<"mobile" | "aadhaar" | "abha">("mobile");
  const [abhaResult, setAbhaResult] = useState<{
    abhaNumber?: string;
    abhaAddress?: string;
    name?: string;
  } | null>(null);

  // Form fields
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [mobile, setMobile] = useState("");
  const [healthId, setHealthId] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);

  async function callAbha(action: string, data: Record<string, string>) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/abha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.configured === false) {
          setNotConfigured(true);
          throw new Error(result.message);
        }
        throw new Error(result.error || "Operation failed");
      }
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setError("");
    setOtp("");
    if (step === "home") return;
    if (step.startsWith("create-")) {
      const createSteps: Step[] = ["create-aadhaar", "create-otp", "create-mobile", "create-mobile-otp"];
      const idx = createSteps.indexOf(step);
      setStep(idx > 0 ? createSteps[idx - 1] : "home");
    } else if (step.startsWith("link-")) {
      // Any link OTP step goes back to its input step, input steps go to home
      if (step.endsWith("-otp")) {
        if (linkMethod === "mobile") setStep("link-mobile");
        else if (linkMethod === "aadhaar") setStep("link-aadhaar");
        else setStep("link-abha-number");
      } else {
        setStep("home");
      }
    } else {
      setStep("home");
    }
  }

  async function saveToDexie(abhaNumber: string, abhaAddress: string) {
    if (!selfMember) return;
    try {
      const { db } = await import("@/lib/db/dexie");
      await db.members.update(selfMember.id!, {
        abha_number: abhaNumber,
        abha_address: abhaAddress,
        updated_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }
  }

  // ─── Create ABHA handlers ─────────────────────────────────────────────────
  async function handleGenerateAadhaarOtp() {
    if (aadhaar.length !== 12) { setError("Enter a valid 12-digit Aadhaar number"); return; }
    const result = await callAbha("generate-aadhaar-otp", { aadhaar });
    if (result?.txnId) { setTxnId(result.txnId); setStep("create-otp"); }
  }

  async function handleVerifyAadhaarOtp() {
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    const result = await callAbha("verify-aadhaar-otp", { txnId, otp });
    if (result) { setOtp(""); setStep("create-mobile"); }
  }

  async function handleGenerateMobileOtp() {
    if (mobile.length !== 10) { setError("Enter a valid 10-digit mobile number"); return; }
    const result = await callAbha("generate-mobile-otp", { txnId, mobile });
    if (result) { setStep("create-mobile-otp"); }
  }

  async function handleVerifyMobileAndCreate() {
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    const result = await callAbha("verify-mobile-create", { txnId, otp });
    if (result) {
      const num = result.healthIdNumber || result.abhaNumber || "";
      const addr = result.healthId || result.abhaAddress || "";
      setAbhaResult({ abhaNumber: num, abhaAddress: addr, name: result.name || result.firstName });
      await saveToDexie(num, addr);
      setStep("success");
    }
  }

  // ─── Link handlers (shared OTP verify + profile fetch) ────────────────────
  async function handleLinkInit(action: string, id: string) {
    const result = await callAbha(action, { healthId: id });
    if (result?.txnId) {
      setTxnId(result.txnId);
      if (linkMethod === "mobile") setStep("link-mobile-otp");
      else if (linkMethod === "aadhaar") setStep("link-aadhaar-otp");
      else setStep("link-abha-otp");
    }
  }

  async function handleLinkVerifyOtp() {
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    const result = await callAbha("confirm-auth", { txnId, otp });
    if (result?.token) {
      const profile = await callAbha("get-profile", { xToken: result.token });
      if (profile) {
        const num = profile.healthIdNumber || profile.abhaNumber || "";
        const addr = profile.healthId || profile.abhaAddress || "";
        setAbhaResult({
          abhaNumber: num, abhaAddress: addr,
          name: profile.name || `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
        });
        await saveToDexie(num, addr);
        setStep("success");
      }
    }
  }

  // ─── Shared OTP input component ───────────────────────────────────────────
  function OtpInput({ label, onSubmit, buttonText, buttonColor }: {
    label: string; onSubmit: () => void; buttonText: string; buttonColor: string;
  }) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Enter OTP</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit OTP"
            className="w-full border rounded-lg px-3 py-3 text-xl tracking-[0.3em] text-center font-mono"
            autoFocus
          />
        </div>
        <button
          onClick={onSubmit}
          disabled={loading || otp.length !== 6}
          className={`w-full ${buttonColor} text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {buttonText}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <button onClick={step === "home" ? undefined : goBack}>
          <Link href={step === "home" ? "/home" : "#"} onClick={step !== "home" ? (e) => { e.preventDefault(); goBack(); } : undefined}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </button>
        <h1 className="text-lg font-bold">ABHA Health ID</h1>
        <div className="ml-auto">
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
            <Shield className="h-4 w-4 text-green-600" />
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">
        {/* Not Configured Banner */}
        {notConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">ABDM Sandbox Pending</p>
              <p className="text-xs text-amber-600 mt-1">ABHA features will be available once ABDM sandbox credentials are configured.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* HOME — Already linked or 3 options                                 */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === "home" && (
          <>
            {/* ABHA Info Banner */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center shadow-sm">
                  <span className="text-white font-black text-sm">A</span>
                </div>
                <div>
                  <h2 className="font-bold text-green-800 text-base">ABHA Health ID</h2>
                  <p className="text-[10px] text-green-600 font-medium">Ayushman Bharat Digital Mission</p>
                </div>
                <div className="ml-auto flex items-center gap-1 bg-green-100 px-2 py-0.5 rounded-full">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[9px] font-bold text-green-700">GOVT. OF INDIA</span>
                </div>
              </div>
              <p className="text-sm text-green-700">
                Link your ABHA to pull verified records from hospitals, labs & pharmacies across India.
              </p>
            </div>

            {/* Already Linked — ABHA Card */}
            {selfMember?.abha_number ? (
              <div className="space-y-4">
                {/* Card */}
                <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                        <span className="text-white font-black text-xs">A</span>
                      </div>
                      <div>
                        <span className="text-xs font-bold">ABHA Health ID</span>
                        <p className="text-[9px] opacity-60">Ayushman Bharat Digital Mission</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">VERIFIED</span>
                  </div>
                  <p className="text-lg font-bold">{selfMember.name || "ABHA User"}</p>
                  <p className="text-xl font-mono tracking-wider mt-1">{
                    selfMember.abha_number.replace(/(\d{2})(\d{4})(\d{4})(\d{4})/, "$1-$2-$3-$4")
                  }</p>
                  {selfMember.abha_address && (
                    <p className="text-sm opacity-80 mt-1">{selfMember.abha_address}</p>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20">
                    <div>
                      {selfMember.gender && <span className="text-xs opacity-70">{selfMember.gender}</span>}
                      {selfMember.date_of_birth && (
                        <span className="text-xs opacity-70 ml-2">DOB: {selfMember.date_of_birth}</span>
                      )}
                    </div>
                    <span className="text-[9px] font-bold opacity-40">GOVT. OF INDIA</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 px-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">ABHA linked to MediLog</span>
                </div>
              </div>
            ) : (
              <>
                {/* ─── 3 LINK METHODS ─────────────────────────────────── */}
                <h3 className="font-semibold text-base pt-2">Link Existing ABHA</h3>

                {/* Method 1: Mobile OTP */}
                <button
                  onClick={() => { setLinkMethod("mobile"); setStep("link-mobile"); }}
                  className="w-full bg-white border-2 border-blue-200 rounded-xl p-4 flex items-center gap-4 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Smartphone className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">Mobile OTP</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Verify with OTP on your registered mobile</p>
                  </div>
                </button>

                {/* Method 2: Aadhaar OTP */}
                <button
                  onClick={() => { setLinkMethod("aadhaar"); setStep("link-aadhaar"); }}
                  className="w-full bg-white border-2 border-orange-200 rounded-xl p-4 flex items-center gap-4 hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <Fingerprint className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">Aadhaar OTP</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Verify with OTP on your Aadhaar-linked mobile</p>
                  </div>
                </button>

                {/* Method 3: ABHA Number */}
                <button
                  onClick={() => { setLinkMethod("abha"); setStep("link-abha-number"); }}
                  className="w-full bg-white border-2 border-green-200 rounded-xl p-4 flex items-center gap-4 hover:bg-green-50 transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CreditCard className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">ABHA Card Number</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Enter your 14-digit ABHA number or address</p>
                  </div>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 border-t" />
                  <span className="text-xs text-muted-foreground">OR</span>
                  <div className="flex-1 border-t" />
                </div>

                {/* Create New */}
                <button
                  onClick={() => setStep("create-aadhaar")}
                  className="w-full bg-green-600 text-white rounded-xl p-4 flex items-center gap-4 hover:bg-green-700 transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <Link2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Create New ABHA</h3>
                    <p className="text-xs text-green-100 mt-0.5">Don&apos;t have ABHA? Create with Aadhaar + Mobile</p>
                  </div>
                </button>
              </>
            )}

            {/* Benefits */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm">Why Link ABHA?</h3>
              {[
                { icon: "🏥", text: "Auto-pull records from hospitals & labs" },
                { icon: "💊", text: "Get verified prescription history" },
                { icon: "🩺", text: "Share records with any doctor instantly" },
                { icon: "🔒", text: "Consent-based — you control who sees what" },
                { icon: "🆓", text: "Completely free — government initiative" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 px-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                ABHA is part of Ayushman Bharat Digital Mission (ABDM) by Govt. of India. Your data is encrypted and shared only with your consent.
              </p>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* LINK METHOD 1: Mobile OTP                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === "link-mobile" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Link via Mobile OTP</h2>
            <p className="text-sm text-muted-foreground">Enter your ABHA number or ABHA address. We&apos;ll send an OTP to your registered mobile.</p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ABHA Number / Address</label>
              <input
                type="text"
                value={healthId}
                onChange={(e) => setHealthId(e.target.value)}
                placeholder="e.g. 14-digit number or name@abdm"
                className="w-full border rounded-lg px-3 py-3"
                autoFocus
              />
            </div>
            <button
              onClick={() => handleLinkInit("login-mobile-otp", healthId)}
              disabled={loading || !healthId}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send Mobile OTP
            </button>
          </div>
        )}

        {step === "link-mobile-otp" && (
          <>
            <h2 className="text-lg font-bold">Verify Mobile OTP</h2>
            <OtpInput
              label="Enter the OTP sent to your registered mobile number."
              onSubmit={handleLinkVerifyOtp}
              buttonText="Link ABHA"
              buttonColor="bg-blue-600"
            />
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* LINK METHOD 2: Aadhaar OTP                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === "link-aadhaar" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Link via Aadhaar OTP</h2>
            <p className="text-sm text-muted-foreground">Enter your ABHA number or address. We&apos;ll send an OTP to your Aadhaar-linked mobile.</p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ABHA Number / Address</label>
              <input
                type="text"
                value={healthId}
                onChange={(e) => setHealthId(e.target.value)}
                placeholder="e.g. 14-digit number or name@abdm"
                className="w-full border rounded-lg px-3 py-3"
                autoFocus
              />
            </div>
            <button
              onClick={() => handleLinkInit("login-aadhaar-otp", healthId)}
              disabled={loading || !healthId}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send Aadhaar OTP
            </button>
          </div>
        )}

        {step === "link-aadhaar-otp" && (
          <>
            <h2 className="text-lg font-bold">Verify Aadhaar OTP</h2>
            <OtpInput
              label="Enter the OTP sent to your Aadhaar-linked mobile number."
              onSubmit={handleLinkVerifyOtp}
              buttonText="Link ABHA"
              buttonColor="bg-orange-600"
            />
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* LINK METHOD 3: ABHA Card Number                                    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === "link-abha-number" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Link via ABHA Card</h2>
            <p className="text-sm text-muted-foreground">Enter the ABHA number printed on your ABHA card. We&apos;ll verify via mobile OTP.</p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">ABHA Card Number</label>
              <input
                type="text"
                inputMode="numeric"
                value={healthId}
                onChange={(e) => setHealthId(e.target.value.replace(/[^0-9-]/g, ""))}
                placeholder="XX-XXXX-XXXX-XXXX"
                className="w-full border rounded-lg px-3 py-3 text-lg tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">14-digit number on your ABHA card</p>
            </div>
            <button
              onClick={() => handleLinkInit("login-mobile-otp", healthId.replace(/-/g, ""))}
              disabled={loading || healthId.replace(/-/g, "").length < 14}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify ABHA Card
            </button>
          </div>
        )}

        {step === "link-abha-otp" && (
          <>
            <h2 className="text-lg font-bold">Verify ABHA Card</h2>
            <OtpInput
              label="Enter the OTP sent to your registered mobile number."
              onSubmit={handleLinkVerifyOtp}
              buttonText="Link ABHA"
              buttonColor="bg-green-600"
            />
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* CREATE: Step 1 — Aadhaar                                           */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === "create-aadhaar" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Create ABHA — Step 1/3</h2>
            <p className="text-sm text-muted-foreground">Enter your 12-digit Aadhaar number. OTP will be sent to your Aadhaar-linked mobile.</p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Aadhaar Number</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
                placeholder="12-digit Aadhaar"
                className="w-full border rounded-lg px-3 py-3 text-lg tracking-widest font-mono"
                autoFocus
              />
            </div>
            <button
              onClick={handleGenerateAadhaarOtp}
              disabled={loading || aadhaar.length !== 12}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send Aadhaar OTP
            </button>
          </div>
        )}

        {/* CREATE: Step 2 — Verify Aadhaar OTP */}
        {step === "create-otp" && (
          <>
            <h2 className="text-lg font-bold">Create ABHA — Step 2/3</h2>
            <OtpInput
              label="Enter the OTP sent to your Aadhaar-linked mobile."
              onSubmit={handleVerifyAadhaarOtp}
              buttonText="Verify OTP"
              buttonColor="bg-green-600"
            />
          </>
        )}

        {/* CREATE: Step 3a — Enter Mobile */}
        {step === "create-mobile" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Create ABHA — Step 3/3</h2>
            <p className="text-sm text-muted-foreground">Enter your mobile number to complete ABHA registration.</p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Mobile Number</label>
              <div className="flex items-center border rounded-lg overflow-hidden">
                <span className="px-3 py-3 bg-muted text-sm font-medium">+91</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit mobile"
                  className="flex-1 px-3 py-3 text-lg tracking-widest border-0 outline-none font-mono"
                  autoFocus
                />
              </div>
            </div>
            <button
              onClick={handleGenerateMobileOtp}
              disabled={loading || mobile.length !== 10}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send Mobile OTP
            </button>
          </div>
        )}

        {/* CREATE: Step 3b — Verify Mobile & Create */}
        {step === "create-mobile-otp" && (
          <>
            <h2 className="text-lg font-bold">Verify Mobile — Final Step</h2>
            <OtpInput
              label={`Enter the OTP sent to +91 ${mobile}`}
              onSubmit={handleVerifyMobileAndCreate}
              buttonText="Create ABHA"
              buttonColor="bg-green-600"
            />
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* SUCCESS                                                            */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {step === "success" && abhaResult && (
          <div className="space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-800">ABHA Linked Successfully!</h2>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left space-y-2">
              {abhaResult.name && <p className="text-sm"><span className="font-medium">Name:</span> {abhaResult.name}</p>}
              {abhaResult.abhaNumber && <p className="text-sm font-mono"><span className="font-medium font-sans">ABHA Number:</span> {abhaResult.abhaNumber}</p>}
              {abhaResult.abhaAddress && <p className="text-sm"><span className="font-medium">ABHA Address:</span> {abhaResult.abhaAddress}</p>}
            </div>

            <p className="text-sm text-muted-foreground">
              Your ABHA is now linked to MediLog. Hospital records will be automatically pulled when available.
            </p>

            <Link
              href="/home"
              className="inline-block w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium text-center"
            >
              Go to Home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
