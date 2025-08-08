import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { LenisProvider } from "@/components/LenisProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Baytech Mortgage ERP",
  description: "Complete mortgage ERP system with employee management, lead tracking, and attendance monitoring",
  keywords: ["Baytech", "Mortgage", "ERP", "Employee Management", "Lead Tracking", "Attendance"],
  authors: [{ name: "Baytech Team" }],
  openGraph: {
    title: "Baytech Mortgage ERP",
    description: "Complete mortgage ERP system",
    url: "https://baytech.com",
    siteName: "Baytech Mortgage",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Baytech Mortgage ERP",
    description: "Complete mortgage ERP system",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <LenisProvider>
            {children}
          </LenisProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
