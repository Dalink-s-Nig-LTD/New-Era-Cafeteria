import React, { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

type ForgotPasswordStep = "email" | "otp" | "success";

interface ForgotPasswordProps {
  onBack: () => void;
}

export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [step, setStep] = useState<ForgotPasswordStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestPasswordReset = useAction(
    api.sendPasswordResetEmail.requestPasswordReset,
  );
  const verifyResetCode = useQuery(
    api.passwordReset.verifyResetCode,
    otp && step === "otp" ? { email, code: otp } : "skip",
  );
  const resetPassword = useMutation(api.passwordReset.resetPassword);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error("Please enter your email");
      }

      const result = await requestPasswordReset({ email: email.trim() });

      if (result.success) {
        setSuccessMessage(
          "Check your email for a 6-digit reset code. You have 15 minutes to use it.",
        );
        setStep("otp");
      }
    } catch (err) {
      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        if (
          message.includes("brevo_api_key") ||
          message.includes("not configured")
        ) {
          setError(
            "Password reset email is temporarily unavailable. Please contact an administrator.",
          );
        } else if (
          message.includes("failed to send") ||
          message.includes("smtp")
        ) {
          setError(
            "Could not send reset email right now. Please try again in a moment.",
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to request password reset");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!otp.trim()) {
        throw new Error("Please enter the reset code from your email");
      }
      if (!newPassword.trim()) {
        throw new Error("Please enter a new password");
      }
      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const result = await resetPassword({
        email: email.trim(),
        code: otp.trim(),
        newPassword,
      });

      if (result.success) {
        setSuccessMessage(
          "Your password has been reset successfully. You can now login with your new password.",
        );
        setStep("success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={onBack}
            className="p-1 hover:bg-muted rounded transition-colors"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Reset Password
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "email" && "Enter your email to receive a reset code"}
              {step === "otp" && "Enter the reset code and your new password"}
              {step === "success" && "Password reset successful"}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {step === "email" && (
        <form onSubmit={handleRequestReset} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm text-foreground/70 font-normal"
            >
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-muted/50 border border-border rounded-lg pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base rounded-xl font-medium"
            disabled={loading || !email.trim()}
          >
            {loading ? "Sending..." : "Send Reset Code"}
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="otp"
              className="text-sm text-foreground/70 font-normal"
            >
              Reset Code (6 digits)
            </Label>
            <div className="flex gap-2 items-start">
              <Input
                id="otp"
                placeholder="000000"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                className="h-12 bg-muted/50 border border-border rounded-lg font-mono text-xl text-center tracking-widest"
                disabled={loading}
              />
              <Clock className="w-5 h-5 text-orange-600 mt-3.5 flex-shrink-0" />
            </div>
          </div>

          {otp && verifyResetCode && (
            <div
              className={`p-3 rounded-lg text-sm ${
                verifyResetCode.valid
                  ? "bg-green-50 border border-green-200 text-green-800 flex gap-2"
                  : "bg-red-50 border border-red-200 text-red-800 flex gap-2"
              }`}
            >
              {verifyResetCode.valid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>Code is valid. Enter your new password below.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{verifyResetCode.error}</span>
                </>
              )}
            </div>
          )}

          {otp && verifyResetCode?.valid && (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="new-password"
                  className="text-sm text-foreground/70 font-normal"
                >
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 8 chars, uppercase, lowercase, number"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12 bg-muted/50 border border-border rounded-lg"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirm-password"
                  className="text-sm text-foreground/70 font-normal"
                >
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 bg-muted/50 border border-border rounded-lg"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base rounded-xl font-medium"
            disabled={
              loading ||
              !otp.trim() ||
              !verifyResetCode?.valid ||
              !newPassword ||
              !confirmPassword ||
              newPassword !== confirmPassword
            }
          >
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      )}

      {step === "success" && (
        <div className="space-y-6 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
          <Button
            onClick={onBack}
            className="w-full h-12 text-base rounded-xl font-medium"
          >
            Return to Login
          </Button>
        </div>
      )}
    </div>
  );
}
