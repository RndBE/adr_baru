import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontSans, fontMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistem Monitoring Deformasi",
  description:
    "Sistem monitoring deformasi real-time dengan data sensor RTS, dan instrumentasi keamanan bendungan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
