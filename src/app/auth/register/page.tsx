"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import Image from "next/image";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card p-8 space-y-8 animate-fade-in relative ">
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl -z-10"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -z-10"></div>

        <div className="text-center space-y-2">
          <Link href="/" className="inline-block transform transition-transform hover:scale-105 active:scale-95">
            <Image src="/logo-text.svg" alt="Logo" width={180} height={50} className="mx-auto" />
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-4">Create account</h2>
          <p className="text-white/60">Join to create your own watch rooms</p>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-4 animate-bounce-in">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Account Created!</h3>
              <p className="text-white/60">Redirecting you to login...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">Confirm Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover text-white rounded-xl py-3 font-bold transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              Create Account
            </button>
          </form>
        )}

        <p className="text-center text-white/40 text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary font-bold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
