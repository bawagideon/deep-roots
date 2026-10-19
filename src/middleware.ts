import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isClerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY &&
  !process.env.CLERK_SECRET_KEY.includes("placeholder") &&
  !process.env.CLERK_SECRET_KEY.includes("mock") &&
  process.env.CLERK_SECRET_KEY.length > 25
);

const isPublicRoute = createRouteMatcher([
  "/",
  "/welcome(.*)",
  "/try(.*)",
  "/r/(.*)",
  "/invite/(.*)",
  "/offline(.*)",
  "/scan(.*)",
  "/root/(.*)",
  "/tree(.*)",
  "/me(.*)",
  "/history(.*)",
  "/settings(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/ai-disclosure(.*)",
  "/api/scan(.*)",
  "/api/guest-scan(.*)",
  "/api/claim-guest-root(.*)",
  "/api/webhooks/(.*)",
  "/api/og/(.*)",
  "/api/deepen(.*)",
  "/api/evidence(.*)",
  "/api/health(.*)",
  "/api/link(.*)",
  "/api/billing/(.*)",
  "/profile(.*)",
  "/upgrade(.*)",
  "/api/roots(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/manifest.json",
  "/sw.js",
  "/icon(.*)",
]);

const clerkAuthHandler = isClerkConfigured
  ? clerkMiddleware((auth, request) => {
      if (!isPublicRoute(request)) {
        auth().protect();
      }
    })
  : null;

export default function middleware(request: any, event: any) {
  if (!isClerkConfigured || !clerkAuthHandler) {
    return NextResponse.next();
  }
  return clerkAuthHandler(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
