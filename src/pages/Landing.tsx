import React from "react";
import { AccessCard } from "@/components/landing/AccessCard";
import { FoodSlider } from "@/components/landing/FoodSlider";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { UserPlus, Shield } from "lucide-react";
import logo from "@/assets/logo.png";

interface LandingProps {
  onLogin: () => void;
}

export function Landing({ onLogin }: LandingProps) {
  const navigate = useNavigate();
  const isTauri = "__TAURI__" in window;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

      {/* Desktop Admin Button */}
      {isTauri && (
        <div className="absolute top-4 right-4 z-20">
          <Button
            onClick={() => navigate("/auth")}
            variant="outline"
            className="gap-2 shadow-lg hover:shadow-xl transition-all"
          >
            <Shield className="h-5 w-5" />
            Admin Access
          </Button>
        </div>
      )}

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {/* Logo & Title */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in">
          <div
            className="mx-auto mb-4 sm:mb-6 flex items-center justify-center"
            style={{ width: 180, height: 180 }}
          >
            <img
              src={logo}
              alt="New Era Cafeteria Logo"
              className="max-w-full max-h-full"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 sm:mb-3">
            New Era Cafeteria
          </h1>
          <p className="text-lg sm:text-xl text-gradient font-semibold mb-2">
            Redeemers University, Ede, Osun State
          </p>
        </div>

        {/* Food Slider */}
        <div
          className="w-full mb-6 sm:mb-10 animate-fade-in"
          style={{ animationDelay: "0.1s" }}
        >
          <FoodSlider />
        </div>

        {/* Access Cards */}
        <div
          className="flex justify-center w-full max-w-2xl px-4 animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          <AccessCard type="cashier" onSuccess={onLogin} />
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
