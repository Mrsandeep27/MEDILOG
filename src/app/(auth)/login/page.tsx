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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const submittingRef = useRef(false);
  // Timestamp when form rendered — bot detection
  const formRenderedAt = useRef(Date.now());

  // Google OAuth — works for both new signups and existing users.
  // Supabase handles account creation on first use, then redirects to
  // /auth/callback which exchanges the code for a session.
  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Force account chooser even if user is already logged into one Google account
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) {
        toast.error(error.message || "Couldn't open Google sign-in. Try again.");
        setGoogleLoading(false);
      }
      // On success the browser navigates to Google — no further code runs here
    } catch {
      toast.error("Network error. Try again.");
      setGoogleLoading(false);
    }
  };

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
          // Show the real reason so users can fix it. Supabase status + message
          // categorized into clear, actionable buckets.
          const msg = (error.message || "").toLowerCase();
          const status = error.status;

          if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
            toast.error("Wrong email or password. If you signed up via Google, use the Google button.");
          } else if (msg.includes("email not confirmed") || msg.includes("not verified")) {
            setEmailSent(data.email);
            toast.info("Email not verified yet. Check your inbox for the verification link.");
          } else if (msg.includes("rate limit") || status === 429) {
            toast.error("Too many attempts. Wait a minute and try again.");
          } else if (status && status >= 500) {
            toast.error("Server is having trouble. Try again in a moment.");
          } else {
            // Last resort — surface the actual error so the user can report it
            toast.error(error.message || "Sign-in failed. Try again.");
          }
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
        {/* Google one-tap sign-in — works for both new and returning users */}
        <Button
          type="button"
          variant="outline"
          className="w-full mb-3 h-11"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
        >
          {googleLoading ? (
            "Opening Google..."
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </>
          )}
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or use email</span>
          </div>
        </div>

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
