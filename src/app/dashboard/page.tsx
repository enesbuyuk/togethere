"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { PlusCircle, Play, History, Users, Loader2, ArrowRight, Video, User, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { data: session } = useSession();
  const [ownedRooms, setOwnedRooms] = useState<any[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/user/rooms");
      const data = await res.json();
      if (res.ok) {
        setOwnedRooms(data.ownedRooms || []);
        setJoinedRooms(data.joinedRooms || []);
      }
    } catch (err) {
      console.error("Failed to fetch rooms");
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    setCreating(true);
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({ roomId, name: `${session?.user?.name}'s Room` }),
        headers: { "Content-Type": "application/json" }
      });

      if (res.ok) {
        router.push(`/room/${roomId}`);
      }
    } catch (err) {
      console.error("Create room failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!confirm("Are you sure you want to delete this room? This action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setOwnedRooms(ownedRooms.filter(r => r.id !== roomId));
      } else {
        alert("Failed to delete room");
      }
    } catch (err) {
      console.error("Delete room failed", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 space-y-10 animate-fade-in">

        <section className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 glass-card p-8 relative overflow-hidden backdrop-blur-3xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-white">Welcome back, {session?.user?.name}!</h1>
            <p className="text-white/60 text-lg font-medium">Ready to watch something amazing with your friends?</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            {/* Join Room Input Group */}
            <div className="flex items-center gap-2 w-full sm:w-auto bg-black/40 p-1.5 rounded-2xl border border-white/10 focus-within:border-primary/50 transition-all">
              <input
                type="text"
                placeholder="ROOM ID"
                className="bg-transparent border-none px-4 py-2 text-white font-black uppercase tracking-widest outline-none w-full sm:w-32 text-sm"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoomId && router.push(`/room/${joinRoomId}`)}
              />
              <button
                onClick={() => joinRoomId && router.push(`/room/${joinRoomId}`)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95"
              >
                Join
              </button>
            </div>

            <div className="hidden sm:block w-px h-10 bg-white/10" />

            {/* Create Room Button */}
            <button
              onClick={createRoom}
              disabled={creating}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-primary/30 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
              <span>Create Room</span>
            </button>
          </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <span className="text-white/40 font-bold uppercase tracking-widest text-sm">Loading your rooms...</span>
          </div>
        ) : (
          <>
            {/* Owned Rooms */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Video className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-black text-white uppercase tracking-wider">Your Rooms</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedRooms.length > 0 ? ownedRooms.map((room) => (
                  <RoomCard key={room.id} room={room} isOwner onDelete={() => deleteRoom(room.id)} />
                )) : (
                  <div className="col-span-full py-12 glass-card border-dashed border-white/10 flex flex-col items-center justify-center gap-4 text-white/30">
                    <PlusCircle className="w-12 h-12 opacity-20" />
                    <p className="font-bold">You haven&apos;t created any rooms yet.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Recently Joined */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <History className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-wider">Recently Joined</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {joinedRooms.length > 0 ? joinedRooms.map((room) => (
                  <RoomCard key={room.id} room={room} />
                )) : (
                  <div className="col-span-full py-12 glass-card border-dashed border-white/10 flex flex-col items-center justify-center gap-4 text-white/30">
                    <Users className="w-12 h-12 opacity-20" />
                    <p className="font-bold">No recently joined rooms found.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RoomCard({ room, isOwner, onDelete }: { room: any; isOwner?: boolean; onDelete?: () => void }) {
  return (
    <Link
      href={`/room/${room.id}`}
      className="group glass-card p-5 space-y-4 hover:bg-white/10 transition-all border border-white/5 hover:border-primary/30 flex flex-col relative"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors truncate">{room.name || 'Untitled Room'}</h3>
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{room.id}</span>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isOwner && (
            <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-[0.6rem] font-black uppercase tracking-widest border border-primary/20">Host</span>
          )}
          {isOwner && onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/10 opacity-0 group-hover:opacity-100"
              title="Delete Room"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="aspect-video bg-black/40 rounded-xl relative overflow-hidden">
        {room.videoId ? (
          <img
            src={`https://img.youtube.com/vi/${room.videoId}/mqdefault.jpg`}
            alt=""
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="w-full h-full flex flex-center items-center justify-center">
            <Video className="w-8 h-8 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
          <span className="text-[0.7rem] text-white/80 font-medium truncate">{room.videoTitle || 'No video playing'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-white/5 border-2 border-[#0a0a0a] flex items-center justify-center">
                <User className="w-3 h-3 text-white/20" />
              </div>
            ))}
          </div>
          <span className="text-xs font-bold text-white/40 tracking-wider">Public Room</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-all">
          <ArrowRight className="w-4 h-4 text-primary group-hover:text-white" />
        </div>
      </div>
    </Link>
  );
}
