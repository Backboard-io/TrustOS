import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { LayoutShell } from "./components/LayoutShell";
import { AuthGuard } from "@/app/components/AuthGuard";

export const metadata: Metadata = {
  title: "TrustOS",
  description: "Compliance automation platform",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground transition-colors duration-300">
        <Providers>
          <AuthGuard>
            <LayoutShell>
              {children}
            </LayoutShell>
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
