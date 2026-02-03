"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Sidebar } from "@/components/sidebar";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <RequireAuth>
      <div className="grid min-h-screen grid-cols-[240px_1fr] bg-slate-50">
        <Sidebar />
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="text-lg font-semibold">CRM Fênix 2.0</div>
              <div className="text-xs text-slate-500">MVP</div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              Sair
            </Button>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
