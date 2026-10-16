import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { BottomTabBar } from "@/components/navigation/BottomTabBar";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Deep Roots — Everything has roots",
  description: "Snap, paste, or type anything. See what it's made of, where it came from, and what it connects to.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E1411",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#FFC857",
          colorBackground: "#0E1411",
          colorText: "#EAF1EC",
          colorTextSecondary: "#9AAAA0",
          colorInputBackground: "#151D18",
          colorInputText: "#EAF1EC",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className="min-h-screen bg-[#0E1411] text-[#EAF1EC] antialiased selection:bg-[#FFC857] selection:text-[#0E1411]">
          <main className="mx-auto flex min-h-screen max-w-[440px] flex-col relative shadow-2xl bg-[#0E1411] border-x border-[#1A231E]">
            {children}
            <BottomTabBar />
            <ServiceWorkerRegister />
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}

