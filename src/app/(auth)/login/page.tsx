"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { PWAInstallButton } from "@/components/pwa/install-button";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const submittingRef = useRef(false);
  // Timestamp when form rendered — bot detection
  const formRenderedAt = useRef(Date.now());

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    // Double-submit guard
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    try {
      if (isSignup) {
        // Signup goes through backend API — rate limited, validated, bot-checked
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            website: "", // honeypot — always empty from real form
            _t: formRenderedAt.current,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error || "Unable to process request. Please try again.");
          return;
        }

        setEmailSent(data.email);
      } else {
        // Login — direct Supabase call (existing flow, kept intact)
        const supabase = createClient();
        const { data: result, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (error) {
          // Generic message — no email enumeration
          toast.error("Unable to sign in. Check your email and password.");
          return;
        }

        if (result.user) {
          // Enforce email verification
          if (!result.user.email_confirmed_at) {
            await supabase.auth.signOut();
            setEmailSent(data.email);
            toast.info("Please verify your email first. Check your inbox.");
            return;
          }

          useAuthStore.getState().setUser({
            id: result.user.id,
            email: result.user.email || "",
            name: result.user.user_metadata?.name || "",
          });

          toast.success("Welcome back!");

          // Check localStorage first (fast path)
          if (useAuthStore.getState().hasCompletedOnboarding) {
            window.location.replace("/home");
            return;
          }

          // Ask server — handles existing user on new device
          try {
            const res = await fetch("/api/check-onboarding");
            const { onboarded } = await res.json();
            if (onboarded) {
              useAuthStore.getState().setHasCompletedOnboarding(true);
              window.location.replace("/home");
              return;
            }
          } catch {
            // fall through
          }

          window.location.replace("/onboarding");
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  if (emailSent) {
    return (
      <Card>
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Check Your Email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to
          </p>
          <p className="font-medium text-sm">{emailSent}</p>
          <p className="text-xs text-muted-foreground">
            Click the link in the email to verify your account, then come back and sign in.
          </p>
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => { setEmailSent(null); setIsSignup(false); }}
          >
            Back to Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center space-y-2 pb-2">
        <div className="mx-auto">
          <Image
            src="/logo.png"
            alt="MediFamily"
            width={240}
            height={72}
            className="mx-auto object-contain"
            style={{ marginTop: "-20px", marginBottom: "-20px" }}
            priority
          />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Honeypot — hidden from real users, bots will fill it */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", opacity: 0 }}
          />

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-10"
                autoComplete="email"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={isSignup ? "Min 8 chars, uppercase + number" : "Enter your password"}
                className="pl-10 pr-10"
                autoComplete={isSignup ? "new-password" : "current-password"}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isSignup ? "Creating account..." : "Signing in..."
              : isSignup ? "Sign Up" : "Sign In"
            }
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                formRenderedAt.current = Date.now(); // Reset timestamp on mode switch
              }}
              className="text-primary font-medium hover:underline"
            >
              {isSignup ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </form>

        <div className="mt-4">
          <PWAInstallButton />
        </div>
      </CardContent>
    </Card>
  );
}
