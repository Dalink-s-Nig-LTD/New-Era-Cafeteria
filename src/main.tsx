import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (e) {
  console.error("❌ Failed to mount app:", e);
  // Force remove splash if app crashes during mount
  const splash = document.getElementById("native-splash");
  if (splash) splash.remove();
  document.getElementById("root")!.innerHTML = `
    <div style="padding:40px;text-align:center;font-family:system-ui;">
      <h2>Failed to load application</h2>
      <p style="color:#666;">${e instanceof Error ? e.message : "Unknown error"}</p>
      <button onclick="location.reload()" style="margin-top:16px;padding:8px 24px;background:#f97316;color:white;border:none;border-radius:8px;cursor:pointer;">Retry</button>
    </div>`;
}