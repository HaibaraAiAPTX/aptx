import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "aptx SSR Auth Sample",
  description: "SSR auth isolation demo with sqlite sessions"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
