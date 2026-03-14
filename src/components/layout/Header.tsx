"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Home, User, PlusCircle, LogIn, UserPlus, Share2, ShieldCheck } from "lucide-react";
import { useRouter, useParams } from "next/navigation";

interface HeaderProps {
    roomId?: string;
    isAdmin?: boolean;
}

export default function Header({ roomId, isAdmin }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <nav className="flex flex-wrap justify-between items-center gap-2 px-3 py-2 sm:px-5 sm:py-3 glass-card shrink-0 sticky top-0 z-50 transition-all duration-300">
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <Image
            src="/logo-text.svg"
            alt="Logo"
            width={130}
            height={36}
            className="drop-shadow-[0_0_8px_rgba(255,0,0,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(255,0,0,0.4)] transition-all w-[100px] sm:w-[130px] h-auto"
          />
        </Link>
        
        {session && (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-2 text-[0.75rem] font-bold rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all border border-white/5"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline uppercase tracking-wider">Dashboard</span>
          </Link>
        )}

        {roomId && (
             <div className="flex items-center gap-2 pl-2 border-l border-white/10 ml-1">
                <span className="hidden md:inline text-[0.7rem] font-bold text-white/30 uppercase tracking-widest">Room</span>
                <code className="bg-primary/20 px-2.5 py-1 rounded-lg font-black text-primary text-xs tracking-tighter shadow-inner">
                    {roomId}
                </code>
             </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {roomId && (
            <button
                className="flex items-center gap-1.5 px-3 py-2 text-[0.75rem] font-bold rounded-xl bg-primary/10 text-white hover:bg-primary/20 transition-all border border-primary/20"
                onClick={() => {
                    const shareUrl = `${window.location.origin}/room/${roomId}`;
                    navigator.clipboard.writeText(shareUrl);
                    alert('Share link copied!');
                }}
            >
                <Share2 className="w-4 h-4 shrink-0 text-primary" />
                <span className="hidden sm:inline uppercase tracking-wider">Share</span>
            </button>
        )}

        {session ? (
          <div className="flex items-center gap-2">
            <Link href="/settings/profile" className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer ${isAdmin ? 'ring-1 ring-primary/30' : ''}`}>
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                {isAdmin ? <ShieldCheck className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-primary" />}
              </div>
              <span className="text-xs font-bold text-white/80">{session.user?.name}</span>
            </Link>
            
            <button
              className="group flex items-center justify-center w-10 h-10 sm:w-auto sm:px-4 sm:h-10 text-[0.75rem] font-bold rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/10"
              onClick={() => signOut({ callbackUrl: '/' })}
              title="Logout"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline ml-1.5 uppercase tracking-wider">Leave</span>
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-[0.75rem] font-bold rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all border border-white/5 uppercase tracking-wider"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 text-[0.75rem] font-bold rounded-xl bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 uppercase tracking-wider"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
