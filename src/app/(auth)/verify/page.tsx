"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

export default function VerifyPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem("medilog-phone");
    if (!stored) {
      router.replace("/login");
      return;
    }
    setPhone(stored);
    inputRefs.current[0]?.focus();
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < text.length; i++) {
      newOtp[i] = text[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token: code,
        type: "sms",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || "",
          name: data.user.user_metadata?.name || "",
          phone: phone,
        });
        sessionStorage.removeItem("medilog-phone");
        toast.success("Phone verified!");
        router.push("/onboarding");
      }
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${phone}`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("OTP resent!");
      }
    } catch {
      toast.error("Failed to resend OTP");
    }
  };

  return (
    <Card>
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Verify OTP</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to +91 {phone}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <Input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-bold"
            />
          ))}
        </div>

        <Button
          onClick={handleVerify}
          className="w-full"
          disabled={loading || otp.join("").length !== 6}
        >
          {loading ? "Verifying..." : "Verify & Continue"}
        </Button>

        <p className="text-sm text-center text-muted-foreground">
          Didn&apos;t receive the code?{" "}
          <button
            onClick={handleResend}
            className="text-primary font-medium hover:underline"
          >
            Resend OTP
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
