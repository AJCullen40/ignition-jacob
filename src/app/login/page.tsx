"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setError("Invalid credentials");
      setLoading(false);
      return;
    }

    router.push("/admin/leads");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0f",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#111118",
          border: "1px solid #1e1e2e",
          borderRadius: 16,
          padding: "2.5rem 2rem",
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #d4af37, #22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18,
              color: "#0a0a0f",
              marginBottom: 16,
            }}
          >
            IP
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#fafafa",
              margin: 0,
              textAlign: "center",
            }}
          >
            Ignition Intelligence Platform
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#71717a",
              margin: "8px 0 0",
              textAlign: "center",
            }}
          >
            Enter credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: 13,
              color: "#a1a1aa",
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #1e1e2e",
              background: "#0a0a0f",
              color: "#fafafa",
              fontSize: 14,
              outline: "none",
              marginBottom: 16,
            }}
          />

          <label
            htmlFor="password"
            style={{
              display: "block",
              fontSize: 13,
              color: "#a1a1aa",
              marginBottom: 6,
              fontWeight: 500,
            }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #1e1e2e",
              background: "#0a0a0f",
              color: "#fafafa",
              fontSize: 14,
              outline: "none",
              marginBottom: 24,
            }}
          />

          {error && (
            <p
              style={{
                color: "#ef4444",
                fontSize: 13,
                margin: "0 0 16px",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: loading ? "#27272a" : "#fafafa",
              color: loading ? "#71717a" : "#0a0a0f",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 150ms",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
