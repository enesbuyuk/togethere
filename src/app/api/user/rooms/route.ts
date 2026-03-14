import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { rooms, roomMembers } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    // Rooms owned by user
    const ownedRooms = await db.select().from(rooms).where(eq(rooms.ownerId, userId));

    // Rooms joined by user (excluding owned ones to avoid duplication if needed, or just show all)
    const joinedRoomRecords = await db.select({
       roomId: roomMembers.roomId
    }).from(roomMembers).where(eq(roomMembers.userId, userId));
    
    const joinedRoomIds = joinedRoomRecords.map(r => r.roomId);
    
    let joinedRooms: any[] = [];
    if (joinedRoomIds.length > 0) {
        // Fetch room details for joined rooms
        // We filter out owned rooms from joinedRooms list for cleaner UI
        joinedRooms = await Promise.all(
            joinedRoomIds
            .filter(id => !ownedRooms.find(or => or.id === id))
            .map(async (id) => {
               const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
               return room;
            })
        );
        joinedRooms = joinedRooms.filter(Boolean);
    }

    return NextResponse.json({ ownedRooms, joinedRooms });
  } catch (error) {
    console.error("Fetch rooms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
