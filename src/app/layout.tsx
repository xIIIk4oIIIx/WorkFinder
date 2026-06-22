import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { startCronJob } from "@/lib/cron";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const jetbrainsMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});


startCronJob();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WorkFinder - Job Aggregator",
  description: "Aggregate job offers from multiple sources",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, jetbrainsMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
