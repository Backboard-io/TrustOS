"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const PUBLIC_PATHS = ["/login", "/signup"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, selectedApp, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAppsPage = pathname === "/apps";
  const isAdminPage = pathname.startsWith("/admin");

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublic) {
      router.replace("/login");
      return;
    }

    if (user && isPublic) {
      router.replace("/apps");
      return;
    }

    // Authenticated but no app selected — send to /apps unless already there or on admin
    if (user && !selectedApp && !isPublic && !isAppsPage && !isAdminPage) {
      router.replace("/apps");
    }
  }, [isLoading, user, selectedApp, isPublic, isAppsPage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-5 w-5 rounded-full border-2 border-bb-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  // Don't render nav/main on public pages
  if (isPublic) return <>{children}</>;

  // While redirecting to login/apps, show nothing
  if (!user || (!selectedApp && !isAppsPage && !isAdminPage)) return null;

  return <>{children}</>;
}
