import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
