"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import AdminLogin from "@/components/AdminLogin";
import { supabase } from "@/lib/supabase";
import { loadCurrentUser } from "@/lib/loadCurrentUser";
import { AppUser } from "@/lib/permissions";

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (mounted) setUser(null);
          return;
        }

        const currentUser = await loadCurrentUser();
        if (mounted) setUser(currentUser);
      } catch (error) {
        console.error("SESSION CHECK ERROR:", error);
        await supabase.auth.signOut();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          if (mounted) setUser(null);
          return;
        }

        try {
          const currentUser = await loadCurrentUser();
          if (mounted) setUser(currentUser);
        } catch (error) {
          console.error("AUTH STATE ERROR:", error);
          if (mounted) setUser(null);
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        Checking access...
      </main>
    );
  }

  if (!user) {
    return <AdminLogin onLogin={setUser} />;
  }

  return <AdminShell user={user} />;
}
