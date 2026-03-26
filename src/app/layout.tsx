import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ignition Intelligence Platform",
  description: "Intelligence dashboard for Ignition Systems",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body style={{ backgroundColor: "#0a0a0f", color: "#fafafa", margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
