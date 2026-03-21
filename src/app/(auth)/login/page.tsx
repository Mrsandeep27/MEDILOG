"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PWAInstallButton } from "@/components/pwa/install-button";

const loginSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${data.phone}`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      sessionStorage.setItem("medilog-phone", data.phone);
      toast.success("OTP sent to your phone!");
      router.push("/verify");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Heart className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">MediLog</h1>
        <p className="text-sm text-muted-foreground">
          Your family&apos;s digital health locker
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 border rounded-md bg-muted text-sm font-medium">
                +91
              </div>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter mobile number"
                  className="pl-10"
                  maxLength={10}
                  {...register("phone")}
                />
              </div>
            </div>
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            We&apos;ll send a 6-digit OTP to verify your number
          </p>
        </form>

        <div className="mt-4">
          <PWAInstallButton />
        </div>
      </CardContent>
    </Card>
  );
}
