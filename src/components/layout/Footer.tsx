import React from "react";

export function Footer() {
  // Hide footer in desktop app
  const isTauri = "__TAURI__" in window;

  if (isTauri) {
    return null;
  }

  return (
    <footer className="bg-card border-t border-border py-6 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground">
          © 2026 Redeemers University. All rights reserved.
        </p>
        <p className="text-sm font-semibold text-primary mt-1">
          New Era Cafeteria
        </p>
      </div>
    </footer>
  );
}
