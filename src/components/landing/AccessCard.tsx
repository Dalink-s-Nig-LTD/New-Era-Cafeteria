import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, User, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AccessCardProps {
  type: "cashier" | "admin";
  onSuccess: () => void;
}

export function AccessCard({ type, onSuccess }: AccessCardProps) {
  const { login, setUserName, role, userName } = useAuth();
  const { toast } = useToast();

  // If cashier already verified code but hasn't entered name, start at name step
  const [code, setCode] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [step, setStep] = useState<"code" | "name">(
    role === "cashier" && !userName ? "name" : "code"
  );
  const [isLoading, setIsLoading] = useState(false);

  const isCashier = type === "cashier";

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Connection Timeout",
        description: "Could not connect to server. Please check your internet connection.",
        variant: "destructive",
      });
      setCode("");
    }, 10000);

    try {
      const result = await login(code);
      clearTimeout(timeoutId);

      if (result.success) {
        if (result.role === "cashier") {
          // Cashiers must enter their name before continuing
          setStep("name");
          toast({
            title: "Code Verified",
            description: "Please enter your name to continue.",
          });
        } else {
          // Admin/other roles proceed directly
          toast({
            title: "Access Granted",
            description: "Welcome to the Admin Dashboard",
          });
          onSuccess();
        }
      } else {
        toast({
          title: "Access Denied",
          description: result.error || "Incorrect Access Code",
          variant: "destructive",
        });
        setCode("");
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = cashierName.trim();
    if (trimmedName.length < 2) {
      toast({
        title: "Invalid Name",
        description: "Please enter your full name (at least 2 characters).",
        variant: "destructive",
      });
      return;
    }

    setUserName(trimmedName);
    toast({
      title: "Access Granted",
      description: `Welcome, ${trimmedName}!`,
    });
    onSuccess();
  };

  return (
    <Card
      className={`
      relative overflow-hidden hover-lift cursor-pointer group
      border-0 shadow-card hover:shadow-glow
      ${isCashier ? "bg-gradient-to-br from-primary to-navy" : "bg-gradient-to-br from-accent to-gold-dark"}
    `}
    >
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-500" />

      <CardContent className="relative z-10 p-8 min-h-[320px] flex flex-col justify-between">
        <div>
          <div
            className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mb-6
            ${isCashier ? "bg-white/20" : "bg-foreground/20"}
          `}
          >
            {isCashier ? (
              <User className="w-8 h-8 text-primary-foreground" />
            ) : (
              <Shield className="w-8 h-8 text-accent-foreground" />
            )}
          </div>

          <h2
            className={`
            text-2xl font-display font-bold mb-2
            ${isCashier ? "text-primary-foreground" : "text-accent-foreground"}
          `}
          >
            {step === "name" ? "Enter Your Name" : isCashier ? "Cashier" : "Admin"}
          </h2>

          <p
            className={`
            text-sm mb-6 opacity-80
            ${isCashier ? "text-primary-foreground" : "text-accent-foreground"}
          `}
          >
            {step === "name"
              ? "Please enter your name to proceed"
              : isCashier
                ? "Process orders, manage cart, and print receipts"
                : "View reports, analytics, and manage menu items"}
          </p>
        </div>

        {step === "code" ? (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="relative">
              <Lock
                className={`
                absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                ${isCashier ? "text-primary-foreground/60" : "text-accent-foreground/60"}
              `}
              />
              <Input
                type="password"
                placeholder="Enter access code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={4}
                className={`
                  pl-10 border-0 
                  ${
                    isCashier
                      ? "bg-white/20 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-white/50"
                      : "bg-foreground/20 text-accent-foreground placeholder:text-accent-foreground/50 focus-visible:ring-foreground/50"
                  }
                `}
              />
            </div>

            <Button
              type="submit"
              disabled={code.length !== 4 || isLoading}
              className={`
                w-full font-semibold group/btn
                ${
                  isCashier
                    ? "bg-white text-primary hover:bg-white/90"
                    : "bg-foreground text-accent hover:bg-foreground/90"
                }
              `}
            >
              {isLoading ? "Verifying..." : "Access Dashboard"}
              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/60"
              />
              <Input
                type="text"
                placeholder="Enter your full name"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                maxLength={50}
                autoFocus
                className="pl-10 border-0 bg-white/20 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-white/50"
              />
            </div>

            <Button
              type="submit"
              disabled={cashierName.trim().length < 2}
              className="w-full font-semibold group/btn bg-white text-primary hover:bg-white/90"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
