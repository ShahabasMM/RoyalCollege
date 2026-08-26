"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadCurrentUser } from "@/lib/loadCurrentUser";
import { AppUser } from "@/lib/permissions";

export default function AdminLogin({
  onLogin,
}: {
  onLogin: (user: AppUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) throw loginError;
      if (!data.user) throw new Error("Unable to sign in.");

      const appUser = await loadCurrentUser();

      if (!appUser) {
        await supabase.auth.signOut();
        throw new Error("Faculty / Staff profile not found.");
      }

      onLogin(appUser);
    } catch (err: any) {
      console.error("LOGIN ERROR:", err);
      await supabase.auth.signOut();
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f4f6f9",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          border: "1px solid #d9dde5",
          borderRadius: 20,
          padding: 32,
          boxShadow: "0 18px 45px rgba(0,0,0,.08)",
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1,
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Royal College
          </div>

          <h1
            style={{
              margin: "8px 0 6px",
              fontSize: 30,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Administrator
          </h1>

          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            Sign in to manage the college system.
          </p>
        </div>

        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 7,
          }}
        >
          Email
        </label>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@royalcollege.com"
          autoComplete="email"
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 48,
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: "0 14px",
            fontSize: 14,
            marginBottom: 18,
            outline: "none",
          }}
        />

        <label
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 7,
          }}
        >
          Password
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
          placeholder="Enter password"
          autoComplete="current-password"
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 48,
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: "0 14px",
            fontSize: 14,
            marginBottom: 16,
            outline: "none",
          }}
        />

        {error && (
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              color: "#be123c",
              borderRadius: 10,
              padding: "11px 13px",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || !email.trim() || !password}
          style={{
            width: "100%",
            height: 50,
            border: "2px solid #111827",
            borderRadius: 10,
            background: "#111827",
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 800,
            cursor: loading ? "wait" : "pointer",
            opacity: !email.trim() || !password ? 0.6 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </main>
  );
}
