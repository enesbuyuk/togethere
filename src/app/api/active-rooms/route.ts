import { NextResponse } from "next/server";
import { rooms } from "@/lib/socket-manager";

export async function GET() {
    const roomList = Object.entries(rooms).map(([id, room]) => ({
        id,
        userCount: Object.keys(room.users).length,
        currentVideo: room.videoState.videoId
    }));

    return NextResponse.json(roomList);
}
