import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomTabBar } from "@/components/navigation/BottomTabBar";

export const metadata: Metadata = {
  title: "Deep Roots — Everything has roots",
  description: "Snap, paste, or type anything. See what it's made of, where it came from, and what it connects to.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0E1411] text-[#EAF1EC] antialiased selection:bg-[#FFC857] selection:text-[#0E1411]">
        <main className="mx-auto flex min-h-screen max-w-[440px] flex-col relative shadow-2xl bg-[#0E1411] border-x border-[#1A231E]">
          {children}
          <BottomTabBar />
        </main>
      </body>
    </html>
  );
}

