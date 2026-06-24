import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ClientProviders } from "@/lib/client-providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Second Brain — AI Chief of Staff",
  description: "A dark-canvas productivity system that predicts task failures, creates autonomous daily plans, and combats procrastination with sharp, personalized coaching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-canvas scroll-smooth">
      <body className={`${inter.variable} antialiased font-sans bg-canvas text-body`}>
        <AuthProvider>
          <ClientProviders>
            {children}
          </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
