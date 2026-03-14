"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Loader2, Save, ChevronLeft, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Link from "next/link";

export default function ProfileSettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated") {
      // Pre-fill from session for immediate feedback
      setFormData(prev => ({
        ...prev,
        name: session?.user?.name || prev.name,
        email: session?.user?.email || prev.email,
      }));
      fetchProfile();
    }
  }, [status, session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          name: data.name,
          email: data.email,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message);
        setFormData(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));

        // Update the session to reflect name changes
        await update({ name: formData.name });
      } else {
        setError(data.error || "Update failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-black">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-white">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-2xl">
          {/* Back button */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[#888888] hover:text-white transition-all mb-8 w-fit group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold uppercase tracking-widest">Back to Dashboard</span>
          </Link>

          <div className="glass-card p-6 sm:p-10 relative overflow-hidden">
            {/* Background decorative element */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Profile Settings</h1>
                  <p className="text-[#888888] text-sm">Manage your account details and security</p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3 text-green-500 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <p className="font-medium">{success}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* General Section */}
                <section>
                  <h2 className="text-[0.7rem] font-black text-[#666666] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full" />
                    General Information
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#AAAAAA] ml-1 uppercase tracking-wider">Full Name</label>
                      <div className="relative group">
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                          placeholder={formData.name || "Your Name"}
                          required
                        />
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] group-focus-within:text-primary transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#AAAAAA] ml-1 uppercase tracking-wider">Email Address</label>
                      <div className="relative group">
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                          placeholder={formData.email || "email@example.com"}
                          required
                        />
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] group-focus-within:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-white/5 w-full" />

                {/* Password Section */}
                <section>
                  <h2 className="text-[0.7rem] font-black text-[#666666] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full" />
                    Security & Password
                  </h2>
                  <p className="text-xs text-[#555555] mb-6 -mt-2 ml-3">Leave blank if you don't want to change your password</p>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[#AAAAAA] ml-1 uppercase tracking-wider">Current Password</label>
                      <div className="relative group">
                        <input
                          type="password"
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                          placeholder="••••••••"
                        />
                        <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] group-focus-within:text-primary transition-colors" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#AAAAAA] ml-1 uppercase tracking-wider">New Password</label>
                        <div className="relative group">
                          <input
                            type="password"
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleChange}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                            placeholder="Min. 6 chars"
                          />
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] group-focus-within:text-primary transition-colors" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[#AAAAAA] ml-1 uppercase tracking-wider">Confirm New Password</label>
                        <div className="relative group">
                          <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                            placeholder="••••••••"
                          />
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] group-focus-within:text-primary transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all hover:bg-primary-hover hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-primary/20 mt-4 group"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="uppercase tracking-widest text-sm">Save Changes</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center mt-8 text-[#444444] text-xs font-bold uppercase tracking-[0.2em]">
            Togethere &bull; Account Security
          </p>
        </div>
      </main>
    </div>
  );
}
