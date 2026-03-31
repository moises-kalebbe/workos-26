import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const fontSans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WorkOS",
  description: "Sistema de produtividade premium",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

const DEV_AUTH_USER_ID = process.env.DEV_AUTH_USER_ID || process.env.NEXT_PUBLIC_DEV_AUTH_USER_ID || null;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const app = <Providers>{children}</Providers>;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontMono.variable} bg-background text-foreground antialiased`}>
        {DEV_AUTH_USER_ID ? app : (
          <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
            {app}
          </ClerkProvider>
        )}
      </body>
    </html>
  );
}

