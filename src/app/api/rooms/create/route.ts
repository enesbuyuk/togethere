import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { rooms, roomMembers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { roomId, name } = await req.json();
    const userId = (session.user as any).id;

    const newRoom = {
      id: roomId || uuidv4().substring(0, 8).toUpperCase(),
      name: name || `${session.user.name}'s Room`,
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Verify user exists in DB before linking
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!dbUser) {
        return NextResponse.json({ error: "User session is stale. Please log in again." }, { status: 400 });
    }

    await db.insert(rooms).values(newRoom);
    
    // Auto join the owner
    await db.insert(roomMembers).values({
      userId,
      roomId: newRoom.id,
      joinedAt: new Date(),
    });

    return NextResponse.json(newRoom, { status: 201 });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
