"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Rocket, Zap, MessageSquare, ListVideo, ArrowRight, ShieldCheck, Sparkles, Monitor, Mic, History, Users } from "lucide-react";
import Header from "@/components/layout/Header";

function LandingContent() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in relative ">
        {/* Background blobs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 animate-orb-move"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] -z-10 animate-orb-move [animation-delay:-5s]"></div>

        <div className="max-w-6xl w-full text-center space-y-12">
          {/* Hero Section */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-primary uppercase tracking-[0.2em] animate-fade-in-down">
              <Sparkles className="w-3.5 h-3.5" />
              Next Generation Watch Party
            </div>

            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-white leading-none tracking-tighter">
              Watch <span className="text-primary italic drop-shadow-[0_0_15px_rgba(255,0,0,0.4)]">Together</span>.<br />
              Feel <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Better</span>.
            </h1>

            <p className="text-white/60 text-lg sm:text-xl max-w-2xl mx-auto font-medium">
              Experience high-quality synchronized YouTube viewing with real-time chat and voice integration. No latency, just moments.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center pt-4">
            {session ? (
              <Link
                href="/dashboard"
                className="group flex items-center gap-3 px-8 py-5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl shadow-primary/30"
              >
                Go to Dashboard
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="group flex items-center gap-3 px-8 py-5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl shadow-primary/30"
                >
                  Start Watching
                  <Rocket className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                </Link>
                <Link
                  href="/auth/register"
                  className="flex items-center gap-3 px-8 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-xl transition-all border border-white/10 active:scale-95"
                >
                  Join the Community
                </Link>
              </>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 pt-16">
            {[
              { icon: <Zap />, color: "text-primary", title: "Live Sync", desc: "Military-grade synchronization." },
              { icon: <Mic />, color: "text-green-500", title: "Voice Chat", desc: "Crystal clear WebRTC audio." },
              { icon: <Monitor />, color: "text-purple-500", title: "Screen Share", desc: "Instantly share your desktop." },
              { icon: <MessageSquare />, color: "text-blue-500", title: "Smart Chat", desc: "Rich emojis and reactions." },
              { icon: <Users />, color: "text-amber-500", title: "Rooms", desc: "Private invite-only spaces." },
              { icon: <History />, color: "text-sky-500", title: "History", desc: "Never lose a shared moment." }
            ].map((feature, i) => (
              <div
                key={i}
                className="glass-card p-5 flex flex-col items-center gap-3 hover:bg-white/10 transition-all border border-white/5 group"
              >
                <div className={`${feature.color} bg-white/5 p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-md font-bold text-white whitespace-nowrap">{feature.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="p-8 text-center text-white/20 text-xs font-bold uppercase tracking-widest border-t border-white/5">
        &copy; 2026 Togethere. All rights reserved.
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-white">Loading...</div>}>
      <LandingContent />
    </Suspense>
  );
}
