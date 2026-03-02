import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set. Please add your Convex deployment URL.");
}

// Remove trailing slash if present
const cleanUrl = convexUrl.endsWith('/') ? convexUrl.slice(0, -1) : convexUrl;

export const convex = new ConvexReactClient(cleanUrl);
