import { NextApiRequest, NextApiResponse } from "next";
import { initSocketIO } from "@/lib/socket-manager";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import type { Server as SocketIOServer } from "socket.io";

interface SocketServer extends HTTPServer {
    io?: SocketIOServer;
}

interface SocketWithIO extends NetSocket {
    server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
    socket: SocketWithIO;
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (res.socket.server.io) {
        console.log("Socket.IO: Server already running on this instance");
        res.status(200).json({ success: true, message: "Socket already active" });
        return;
    }

    try {
        const io = initSocketIO(res.socket.server);
        res.socket.server.io = io;
        res.status(200).json({ success: true });
    } catch (err: any) {
        console.error("Socket initialization error:", err);
        res.status(500).json({ error: "Failed to initialize socket server", message: err.message });
    }
}
