import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { convex } from "@/lib/convex";
import { useState, useEffect, useCallback } from "react";
import Index from "./pages/Index";
import { Auth } from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";

const queryClient = new QueryClient();

// Import orderQueue for initialization
import { orderQueue } from "@/lib/orderQueue";

const isTauri = typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

const App = () => {
  const [initialized, setInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(isTauri);

  useEffect(() => {
    const init = async () => {
      try {
        if (isTauri) {
          await Promise.race([
            orderQueue.init(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Order queue init timed out")), 5000))
          ]);
          console.log("✅ Order queue initialized successfully");
        }
      } catch (e) {
        console.error("⚠️ Order queue init failed, app will still load:", e);
      } finally {
        setInitialized(true);
      }
    };
    init();
  }, []);

  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  if (!initialized) return null;

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ConvexProvider>
    </>
  );
};

export default App;
