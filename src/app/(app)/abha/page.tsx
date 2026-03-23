"use client";

import { useState } from "react";
import { ArrowLeft, CreditCard, Link2, Shield, Search, Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import Link from "next/link";
import { useMembers } from "@/hooks/use-members";

type Step = "home" | "create-aadhaar" | "create-otp" | "create-mobile" | "create-mobile-otp" | "link-search" | "link-otp" | "success";

export default function AbhaPage() {
  const { members } = useMembers();
  const selfMember = members.find((m) => m.relation === "self");

  const [step, setStep] = useState<Step>("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [txnId, setTxnId] = useState("");
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

  // Step handlers
  async function handleGenerateAadhaarOtp() {
    if (aadhaar.length !== 12) {
      setError("Please enter a valid 12-digit Aadhaar number");
      return;
    }
    const result = await callAbha("generate-aadhaar-otp", { aadhaar });
    if (result?.txnId) {
      setTxnId(result.txnId);
      setStep("create-otp");
    }
  }

  async function handleVerifyAadhaarOtp() {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    const result = await callAbha("verify-aadhaar-otp", { txnId, otp });
    if (result) {
      setOtp("");
      setStep("create-mobile");
    }
  }

  async function handleGenerateMobileOtp() {
    if (mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    const result = await callAbha("generate-mobile-otp", { txnId, mobile });
    if (result) {
      setStep("create-mobile-otp");
    }
  }

  async function handleVerifyMobileAndCreate() {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    const result = await callAbha("verify-mobile-create", { txnId, otp });
    if (result) {
      setAbhaResult({
        abhaNumber: result.healthIdNumber || result.abhaNumber,
        abhaAddress: result.healthId || result.abhaAddress,
        name: result.name || result.firstName,
      });
      // Save to member profile in Dexie
      if (selfMember && result.healthIdNumber) {
        try {
          const { db } = await import("@/lib/db/dexie");
          await db.members.update(selfMember.id!, {
            abha_number: result.healthIdNumber,
            abha_address: result.healthId || "",
            updated_at: new Date().toISOString(),
          });
        } catch { /* ignore */ }
      }
      setStep("success");
    }
  }

  async function handleSearchAbha() {
    if (!healthId) {
      setError("Please enter your ABHA number or address");
      return;
    }
    const result = await callAbha("login-mobile-otp", { healthId });
    if (result?.txnId) {
      setTxnId(result.txnId);
      setStep("link-otp");
    }
  }

  async function handleLinkVerifyOtp() {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    const result = await callAbha("confirm-auth", { txnId, otp });
    if (result?.token) {
      // Get profile with token
      const profile = await callAbha("get-profile", { xToken: result.token });
      if (profile) {
        setAbhaResult({
          abhaNumber: profile.healthIdNumber || profile.abhaNumber,
          abhaAddress: profile.healthId || profile.abhaAddress,
          name: profile.name || `${profile.firstName} ${profile.lastName}`,
        });
        // Save to member
        if (selfMember) {
          try {
            const { db } = await import("@/lib/db/dexie");
            await db.members.update(selfMember.id!, {
              abha_number: profile.healthIdNumber || "",
              abha_address: profile.healthId || "",
              updated_at: new Date().toISOString(),
            });
          } catch { /* ignore */ }
        }
        setStep("success");
      }
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Link href={step === "home" ? "/home" : "#"} onClick={step !== "home" ? (e) => { e.preventDefault(); setStep("home"); setError(""); setOtp(""); } : undefined}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">ABHA Integration</h1>
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
              <p className="text-xs text-amber-600 mt-1">
                We&apos;re waiting for ABDM sandbox approval. ABHA features will be available once credentials are configured.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ============================================================ */}
        {/* HOME — Choose Create or Link */}
        {/* ============================================================ */}
        {step === "home" && (
          <>
            {/* Info Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <img src="/abha-logo.png" alt="ABHA" className="h-6" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <h2 className="font-bold text-green-800">Ayushman Bharat Health Account</h2>
              </div>
              <p className="text-sm text-green-700">
                Link your ABHA to automatically pull verified health records from hospitals, labs, and pharmacies across India.
              </p>
            </div>

            {/* Current ABHA Status */}
            {selfMember?.abha_number ? (
              <div className="bg-green-50 border border-green-300 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-bold text-green-800">ABHA Linked</span>
                </div>
                <p className="text-sm text-green-700">Number: {selfMember.abha_number}</p>
                {selfMember.abha_address && (
                  <p className="text-sm text-green-700">Address: {selfMember.abha_address}</p>
                )}
              </div>
            ) : (
              <>
                {/* Create New ABHA */}
                <button
                  onClick={() => setStep("create-aadhaar")}
                  className="w-full bg-white border-2 border-green-200 rounded-xl p-5 flex items-center gap-4 hover:bg-green-50 transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CreditCard className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">Create New ABHA</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Using your Aadhaar card + mobile number
                    </p>
                  </div>
                </button>

                {/* Link Existing ABHA */}
                <button
                  onClick={() => setStep("link-search")}
                  className="w-full bg-white border-2 border-blue-200 rounded-xl p-5 flex items-center gap-4 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Link2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">Link Existing ABHA</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Already have an ABHA number? Link it to MediLog
                    </p>
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

            {/* Info */}
            <div className="flex items-start gap-2 px-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                ABHA is part of Ayushman Bharat Digital Mission (ABDM) by Govt. of India.
                Your data is encrypted and shared only with your consent.
              </p>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* CREATE: Step 1 — Enter Aadhaar */}
        {/* ============================================================ */}
        {step === "create-aadhaar" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Create ABHA — Step 1/3</h2>
            <p className="text-sm text-muted-foreground">Enter your 12-digit Aadhaar number. An OTP will be sent to your Aadhaar-linked mobile.</p>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Aadhaar Number</label>
              <input
                type="text"
                maxLength={12}
                value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 12-digit Aadhaar"
                className="w-full border rounded-lg px-3 py-2.5 text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground mt-1">OTP will be sent to your Aadhaar-linked mobile</p>
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

        {/* ============================================================ */}
        {/* CREATE: Step 2 — Verify Aadhaar OTP */}
        {/* ============================================================ */}
        {step === "create-otp" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Create ABHA — Step 2/3</h2>
            <p className="text-sm text-muted-foreground">Enter the OTP sent to your Aadhaar-linked mobile number.</p>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Aadhaar OTP</label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit OTP"
                className="w-full border rounded-lg px-3 py-2.5 text-lg tracking-widest text-center"
              />
            </div>

            <button
              onClick={handleVerifyAadhaarOtp}
              disabled={loading || otp.length !== 6}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify OTP
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* CREATE: Step 3a — Enter Mobile */}
        {/* ============================================================ */}
        {step === "create-mobile" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Create ABHA — Step 3/3</h2>
            <p className="text-sm text-muted-foreground">Enter your mobile number for ABHA registration.</p>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Mobile Number</label>
              <div className="flex items-center border rounded-lg overflow-hidden">
                <span className="px-3 py-2.5 bg-muted text-sm">+91</span>
                <input
                  type="text"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 10-digit mobile"
                  className="flex-1 px-3 py-2.5 text-lg tracking-widest border-0 outline-none"
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

        {/* ============================================================ */}
        {/* CREATE: Step 3b — Verify Mobile OTP & Create */}
        {/* ============================================================ */}
        {step === "create-mobile-otp" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Verify Mobile — Final Step</h2>
            <p className="text-sm text-muted-foreground">Enter the OTP sent to +91 {mobile}</p>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Mobile OTP</label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit OTP"
                className="w-full border rounded-lg px-3 py-2.5 text-lg tracking-widest text-center"
              />
            </div>

            <button
              onClick={handleVerifyMobileAndCreate}
              disabled={loading || otp.length !== 6}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create ABHA
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* LINK: Search existing ABHA */}
        {/* ============================================================ */}
        {step === "link-search" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Link Existing ABHA</h2>
            <p className="text-sm text-muted-foreground">Enter your ABHA number or ABHA address. An OTP will be sent to verify.</p>

            <div>
              <label className="text-sm font-medium mb-1.5 block">ABHA Number or Address</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={healthId}
                  onChange={(e) => setHealthId(e.target.value)}
                  placeholder="e.g. 1234567890123456 or yourname@abdm"
                  className="w-full border rounded-lg pl-10 pr-3 py-2.5"
                />
              </div>
            </div>

            <button
              onClick={handleSearchAbha}
              disabled={loading || !healthId}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify & Send OTP
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* LINK: Verify OTP */}
        {/* ============================================================ */}
        {step === "link-otp" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Verify Your ABHA</h2>
            <p className="text-sm text-muted-foreground">Enter the OTP sent to your registered mobile number.</p>

            <div>
              <label className="text-sm font-medium mb-1.5 block">OTP</label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit OTP"
                className="w-full border rounded-lg px-3 py-2.5 text-lg tracking-widest text-center"
              />
            </div>

            <button
              onClick={handleLinkVerifyOtp}
              disabled={loading || otp.length !== 6}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Link ABHA to MediLog
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* SUCCESS */}
        {/* ============================================================ */}
        {step === "success" && abhaResult && (
          <div className="space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-800">ABHA Linked Successfully!</h2>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left space-y-2">
              {abhaResult.name && (
                <p className="text-sm"><span className="font-medium">Name:</span> {abhaResult.name}</p>
              )}
              {abhaResult.abhaNumber && (
                <p className="text-sm"><span className="font-medium">ABHA Number:</span> {abhaResult.abhaNumber}</p>
              )}
              {abhaResult.abhaAddress && (
                <p className="text-sm"><span className="font-medium">ABHA Address:</span> {abhaResult.abhaAddress}</p>
              )}
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
