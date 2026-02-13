import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Home } from "lucide-react";
import ruLogo from "@/assets/ru-logo.jpg";
import logo from "@/assets/logo.png";

type AuthMode = "signin" | "signup";

export function Auth() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isTauri = "__TAURI__" in window;

  const signInMutation = useMutation(api.adminAuth.signIn);
  const signUpMutation = useMutation(api.adminAuth.signUp);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [passwordStrength, setPasswordStrength] = useState<string>("");

  // Password strength checker
  const checkPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) {
      setPasswordStrength("");
      return;
    }

    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
    setPasswordStrength(labels[strength - 1] || "Very Weak");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Add timeout to prevent infinite loading in production builds
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError("Connection timeout. Please check your internet connection and try again.");
    }, 15000); // 15 second timeout

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          clearTimeout(timeoutId);
          throw new Error("Passwords do not match");
        }
        if (password.length < 8) {
          clearTimeout(timeoutId);
          throw new Error("Password must be at least 8 characters");
        }

        const result = await signUpMutation({
          email,
          password,
          name,
        });

        clearTimeout(timeoutId);

        // Store session info
        localStorage.setItem("sessionId", result.sessionId);
        localStorage.setItem("userRole", result.user.role);
        localStorage.setItem("userName", result.user.name);
        localStorage.setItem("sessionCreated", Date.now().toString());
      } else {
        const result = await signInMutation({
          email,
          password,
        });

        clearTimeout(timeoutId);

        // Store session info
        localStorage.setItem("sessionId", result.sessionId);
        localStorage.setItem("userRole", result.user.role);
        localStorage.setItem("userName", result.user.name);
        localStorage.setItem("sessionCreated", Date.now().toString());
      }

      // Reload page to ensure AuthContext picks up the new role
      window.location.href = "/";
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Auth error:", err);
      let msg = "Authentication failed. Please try again.";
      if (err instanceof Error) {
        const errMsg = err.message.toLowerCase();

        // Check specific errors first
        if (
          errMsg.includes("wrong password") ||
          errMsg.includes("wrong password or email")
        ) {
          msg = "Wrong password or email";
        } else if (errMsg.includes("email already registered")) {
          msg = "This email is already registered";
        } else if (errMsg.includes("invalid email")) {
          msg = "Please enter a valid email address";
        } else if (errMsg.includes("password must")) {
          msg = err.message; // Keep password requirement messages
        } else if (errMsg.includes("locked")) {
          msg = err.message; // Keep account locked messages
        } else if (errMsg.includes("name must")) {
          msg = "Name must be between 2 and 100 characters";
        } else if (errMsg.includes("timeout")) {
          msg = "Connection timeout. Please check your internet connection.";
        } else if (
          errMsg.includes("[convex") ||
          errMsg.includes("server error")
        ) {
          // Generic Convex errors only if not caught above
          msg = "Incorrect email or password.";
        } else {
          msg = "Authentication failed. Please try again.";
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-primary">
      {/* Home button for desktop */}
      {isTauri && (
        <Button
          onClick={() => navigate("/")}
          variant="outline"
          className="absolute top-4 left-4 z-10 gap-2 bg-white/90 hover:bg-white shadow-lg"
        >
          <Home className="w-4 h-4" />
          Home
        </Button>
      )}

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Main Card */}
      <Card className="relative w-full max-w-5xl overflow-hidden shadow-2xl border-0 flex flex-col lg:flex-row rounded-3xl">
        {/* Left Side - Form */}
        <div className="flex-1 p-6 sm:p-10 lg:p-14 flex flex-col justify-center bg-white">
          <div className="max-w-sm mx-auto w-full lg:mx-0">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-8">
              {mode === "signin" ? "Login" : "Sign Up"}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-sm text-muted-foreground font-normal"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 bg-[#f5f5f7] border-0 rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm text-muted-foreground font-normal"
                >
                  Username or email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-[#f5f5f7] border-0 rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-sm text-muted-foreground font-normal"
                  >
                    Password
                  </Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (mode === "signup")
                        checkPasswordStrength(e.target.value);
                    }}
                    className="h-12 bg-[#f5f5f7] border-0 rounded-lg pr-12 focus-visible:ring-1 focus-visible:ring-primary"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {mode === "signup" && passwordStrength && (
                  <p
                    className={`text-xs ${
                      passwordStrength === "Strong"
                        ? "text-green-600"
                        : passwordStrength === "Good"
                          ? "text-blue-600"
                          : passwordStrength === "Fair"
                            ? "text-yellow-600"
                            : "text-red-600"
                    }`}
                  >
                    Password strength: {passwordStrength}
                  </p>
                )}
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground">
                    Must be 8+ characters with uppercase, lowercase, and number
                  </p>
                )}
              </div>

              {mode === "signup" && (
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-sm text-muted-foreground font-normal"
                  >
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-12 bg-[#f5f5f7] border-0 rounded-lg focus-visible:ring-1 focus-visible:ring-primary"
                    required
                  />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base rounded-xl font-medium"
                disabled={loading}
              >
                {loading ? (
                  <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                ) : mode === "signin" ? (
                  "Login"
                ) : (
                  "Sign Up"
                )}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              {mode === "signin"
                ? "Don't have an account ?"
                : "Already have an account ?"}
              <button
                type="button"
                className="ml-1 text-primary hover:underline font-medium"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
              >
                {mode === "signin" ? "Sign up" : "Login"}
              </button>
            </p>
          </div>
        </div>

        {/* Right Side - Illustration with curved corner */}
        <div className="hidden lg:block relative w-[45%]">
          {/* Curved background shape */}
          <div className="absolute inset-0 bg-[#f0f4f8] rounded-tl-[80px]" />

          {/* Content */}
          <div className="relative h-full flex flex-col items-center justify-center p-8">
            {/* Illustration area */}
            <div className="relative w-full max-w-xs mb-8">
              {/* Central phone/device mockup */}
              <div className="relative mx-auto">
                {/* Floating elements around */}
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-[#ff6b6b]/20 flex items-center justify-center">
                  <span className="text-xl">🍕</span>
                </div>
                <div className="absolute -top-8 right-4 w-10 h-10 rounded-full bg-[#4ecdc4]/20 flex items-center justify-center">
                  <span className="text-lg">🍔</span>
                </div>
                <div className="absolute top-8 -right-6 w-11 h-11 rounded-full bg-[#ff9f43]/20 flex items-center justify-center">
                  <span className="text-lg">🍜</span>
                </div>
                <div className="absolute bottom-4 -left-8 w-10 h-10 rounded-full bg-[#6c5ce7]/20 flex items-center justify-center">
                  <span className="text-lg">🥗</span>
                </div>
                <div className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#00b894]/20 flex items-center justify-center">
                  <span className="text-lg">🍰</span>
                </div>

                {/* Center logo */}
                <div className="w-48 h-48 mx-auto flex items-center justify-center">
                  <img
                    src={logo}
                    alt="New Era Cafeteria Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Text content */}
            <div className="text-center max-w-xs">
              <h2 className="text-xl font-display font-bold text-foreground mb-3">
                New Era Cafeteria POS
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed"></p>
            </div>

            {/* Dots indicator */}
            <div className="flex items-center justify-center gap-2 mt-8">
              <span className="w-6 h-1.5 rounded-full bg-primary" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
