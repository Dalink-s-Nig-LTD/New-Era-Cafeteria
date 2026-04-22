import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";
import { useState, useEffect, useCallback } from "react";
import Index from "./pages/Index";
import { Auth } from "./pages/Auth";
import CustomerSelfOrder from "./pages/CustomerSelfOrder";
import NotFound from "./pages/NotFound";
import SplashScreen from "./components/SplashScreen";

const queryClient = new QueryClient();

// Import orderQueue and sync service for initialization
import { orderQueue } from "@/lib/orderQueue";
import { bootstrapHistoricalOrders } from "@/lib/bootstrapHistoricalOrders";
import { bootstrapReferenceData } from "@/lib/bootstrapReferenceData";
import { bootstrapAllOrders } from "@/lib/bootstrapAllOrders";
import { initConvexSync } from "@/lib/convexSync";

const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

const App = () => {
  const [initialized] = useState(true);
  const [showSplash, setShowSplash] = useState(isTauri);

  useEffect(() => {
    const init = async () => {
      try {
        if (isTauri) {
          await orderQueue.init();
          console.log("✅ Order queue initialized successfully");

          const bootstrapCount = await bootstrapHistoricalOrders(convex);
          console.log(
            `✅ Historical orders bootstrap complete: ${bootstrapCount} orders loaded`,
          );

          await bootstrapReferenceData(convex);
          console.log("✅ Reference cache bootstrap complete");

          await bootstrapAllOrders(convex);
          console.log("✅ All orders cache bootstrap complete");

          // Initialize background Convex sync service
          const syncService = initConvexSync(convex);
          console.log("✅ Convex sync service started");
        }
      } catch (e) {
        console.error("⚠️ Initialization warning, app will still load:", e);
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
                <Route path="/customer-order" element={<CustomerSelfOrder />} />
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
