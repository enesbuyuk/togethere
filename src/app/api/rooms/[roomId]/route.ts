import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const userId = (session.user as any).id;

  try {
    // Ensure the user is the owner of the room
    const [room] = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.ownerId, userId)));

    if (!room) {
      return NextResponse.json(
        { error: "Room not found or you are not the owner" },
        { status: 404 }
      );
    }

    // Delete the room (cascades will handle members, history, queue)
    await db.delete(rooms).where(eq(rooms.id, roomId));

    return NextResponse.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Delete room error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
