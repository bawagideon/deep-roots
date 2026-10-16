import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/scan(.*)",
  "/root/(.*)",
  "/tree(.*)",
  "/me(.*)",
  "/history(.*)",
  "/settings(.*)",
  "/welcome(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/ai-disclosure(.*)",
  "/api/scan(.*)",
  "/api/deepen(.*)",
  "/api/evidence(.*)",
  "/api/health(.*)",
  "/api/link(.*)",
  "/api/billing/(.*)",
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
