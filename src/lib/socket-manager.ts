import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { db, initDb } from "@/db";
import * as schema from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";

// Define types for Room state
export interface User {
    name: string;
    color: string;
    lastActive: number;
    isAdmin: boolean;
    isMuted: boolean;
    isTalking: boolean;
}

export interface VideoState {
    videoId: string;
    playlistId: string;
    time: number;
    playing: boolean;
    title?: string;
    uploadDate?: string;
}

export interface HistoryItem {
    videoId: string;
    title: string;
    timestamp: number;
}

export interface QueueItem {
    videoId: string;
    title: string;
    thumbnail?: string;
    uploadDate?: string;
    addedBy: string;
}

export interface Room {
    users: Record<string, User>;
    videoState: VideoState;
    history: HistoryItem[];
    queue: QueueItem[];
}

// Global state to persist across hot reloads in development
// In production, this only works on a single-instance server
const globalForSocket = global as unknown as {
    rooms: Record<string, Room>;
    io: SocketIOServer | undefined;
};

export const rooms = globalForSocket.rooms || {};
if (process.env.NODE_ENV !== "production") {
    globalForSocket.rooms = rooms;
}

const userColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#82E0AA', '#F0B27A', '#85C1E9'
];

function getRandomColor() {
    return userColors[Math.floor(Math.random() * userColors.length)];
}

// Simple in-memory rate limiting
const userLastMessageTime: Record<string, number> = {};
const MESSAGE_COOLDOWN = 500; // 500ms between messages

const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export function getRoomUsers(roomId: string, includeInactive = false) {
    if (!rooms[roomId]) return [];
    const now = Date.now();
    return Object.entries(rooms[roomId].users)
        .filter(([_, user]) => includeInactive || (now - user.lastActive < INACTIVITY_THRESHOLD))
        .map(([id, user]) => ({
            id,
            name: user.name,
            color: user.color,
            isAdmin: user.isAdmin,
            isMuted: user.isMuted,
            isTalking: user.isTalking
        }));
}

export function initSocketIO(httpServer: HTTPServer) {
    const serverWithIO = httpServer as any;
    if (serverWithIO.io) {
        console.log("Socket.IO: Already attached to this httpServer instance.");
        return serverWithIO.io;
    }

    console.log("Socket.IO: Initializing new instance on httpServer...");
    initDb(); // Ensure SQLite tables exist
    
    const io = new SocketIOServer(httpServer, {
        path: "/api/socket",
        addTrailingSlash: false,
        cors: { origin: "*" }
    });

    serverWithIO.io = io;
    globalForSocket.io = io;

    io.on('connection', (socket) => {
        console.log(`[+] User connected: ${socket.id}`);

        const socketData: any = socket as any;

        socket.on('join-room', async ({ roomId, userName, userId }) => {
            // Create room if not exists in memory
            if (!rooms[roomId]) {
                // Try to load from DB
                const [dbRoom] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, roomId));
                
                if (dbRoom) {
                    // Load from DB
                    const dbHistory = await db.select().from(schema.history).where(eq(schema.history.roomId, roomId)).orderBy(asc(schema.history.timestamp));
                    const dbQueue = await db.select().from(schema.queue).where(eq(schema.queue.roomId, roomId)).orderBy(asc(schema.queue.position));

                    rooms[roomId] = {
                        users: {},
                        videoState: {
                            videoId: dbRoom.videoId,
                            playlistId: dbRoom.playlistId,
                            time: dbRoom.videoTime,
                            playing: dbRoom.isPlaying,
                            title: dbRoom.videoTitle || undefined,
                            uploadDate: dbRoom.uploadDate || undefined
                        },
                        history: dbHistory.map(h => ({ videoId: h.videoId, title: h.title, timestamp: h.timestamp.getTime() })),
                        queue: dbQueue.map(q => ({ 
                            videoId: q.videoId, 
                            title: q.title, 
                            thumbnail: q.thumbnail || undefined, 
                            uploadDate: q.uploadDate || undefined, 
                            addedBy: q.addedBy 
                        }))
                    };
                } else {
                    // Create new in DB with explicit defaults to satisfy NOT NULL constraints
                    await db.insert(schema.rooms).values({
                        id: roomId,
                        name: `${userName}'s Room`,
                        ownerId: userId || null, // Set owner if user is logged in
                        videoId: '',
                        playlistId: '',
                        videoTime: 0,
                        isPlaying: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    rooms[roomId] = {
                        users: {},
                        videoState: { videoId: '', playlistId: '', time: 0, playing: false },
                        history: [],
                        queue: []
                    };
                }
            }

            // Persistence: Add user to room members if they have a userId (logged in)
            if (userId) {
                try {
                    const [existingMember] = await db.select().from(schema.roomMembers)
                        .where(and(
                            eq(schema.roomMembers.userId, userId),
                            eq(schema.roomMembers.roomId, roomId)
                        ));
                    
                    if (!existingMember) {
                        // VERIFY USER EXISTS TO PREVENT FK ERROR
                        const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
                        
                        if (dbUser) {
                            await db.insert(schema.roomMembers).values({
                                userId,
                                roomId,
                                joinedAt: new Date()
                            });
                            console.log(`[DB] User ${userId} linked to room ${roomId}`);
                        } else {
                            console.warn(`[DB] Cannot link membership: User ${userId} not found in DB (stale session?)`);
                        }
                    }
                } catch (e) {
                    console.error("DB Membership Error:", e);
                }
            }
            // ... rest of the join logic ...
            // Cleanup any existing session for the same username to handle refreshes gracefully
            Object.keys(rooms[roomId].users).forEach(id => {
                if (rooms[roomId].users[id].name === userName) {
                    delete rooms[roomId].users[id];
                }
            });

            // Fetch room owner from DB
            const [dbRoom] = await db.select({ ownerId: schema.rooms.ownerId })
                .from(schema.rooms)
                .where(eq(schema.rooms.id, roomId));
            
            const isOwner = dbRoom?.ownerId === userId && userId !== undefined;

            // Check if there's any active admin left
            const activeUsers = getRoomUsers(roomId);
            const hasAdmin = activeUsers.some(u => u.isAdmin);

            // Admin logic: Owner is ALWAYS admin. If no admin in room, the joining user becomes admin.
            const isAdmin = isOwner || !hasAdmin;
            const color = getRandomColor();

            rooms[roomId].users[socket.id] = {
                name: userName,
                color,
                lastActive: Date.now(),
                isAdmin,
                isMuted: true,
                isTalking: false
            };

            socket.join(roomId);
            socketData.currentRoom = roomId;
            socketData.userName = userName;
            socketData.userColor = color;

            console.log(`[Room ${roomId}] ${userName} joined. Admin: ${isAdmin}`);

            socket.emit('room-joined', {
                roomId,
                videoState: rooms[roomId].videoState,
                users: getRoomUsers(roomId),
                history: rooms[roomId].history,
                queue: rooms[roomId].queue,
                yourColor: color,
                isAdmin: rooms[roomId].users[socket.id].isAdmin
            });


            socket.to(roomId).emit('user-joined', {
                id: socket.id,
                name: userName,
                color,
                isAdmin: rooms[roomId].users[socket.id].isAdmin, // explicitly send this
                users: getRoomUsers(roomId)
            });

            io.to(roomId).emit('chat-message', {
                type: 'system',
                text: `${userName} joined the room 👋`
            });
        });

        socket.on('video-update', async (data) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId]) return;

            // Permission Check
            if (!rooms[roomId].users[socket.id]?.isAdmin) {
                return socket.emit('chat-message', { type: 'system', text: '⚠️ Only admins can control the video.' });
            }

            console.log(`[Sync] Room ${roomId} - Type: ${data.type} - Time: ${data.time} by ${socketData.userName}`);

            rooms[roomId].videoState = {
                videoId: data.videoId || rooms[roomId].videoState.videoId,
                playlistId: data.playlistId || rooms[roomId].videoState.playlistId,
                time: data.time,
                playing: data.type === 'PLAY'
            };

            // 1. Broadcast IMMEDIATELY to other users for zero latency
            socket.to(roomId).emit('video-sync', {
                ...data,
                senderName: socketData.userName
            });

            // 2. Persist to DB in the background
            db.update(schema.rooms).set({
                videoId: rooms[roomId].videoState.videoId || '',
                playlistId: rooms[roomId].videoState.playlistId || '',
                videoTime: rooms[roomId].videoState.time || 0,
                isPlaying: rooms[roomId].videoState.playing || false,
                updatedAt: new Date()
            }).where(eq(schema.rooms.id, roomId)).catch(err => console.error("DB Sync Error:", err));
        });

        socket.on('change-video', async ({ videoId, playlistId, title, uploadDate }) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId]) return;

            // Permission Check
            if (!rooms[roomId].users[socket.id]?.isAdmin) {
                return socket.emit('chat-message', { type: 'system', text: '⚠️ Only admins can change the video.' });
            }

            rooms[roomId].videoState = { videoId, playlistId, time: 0, playing: false, title, uploadDate };
            
            // Sync to DB
            await db.update(schema.rooms).set({
                videoId,
                playlistId: playlistId || '',
                videoTime: 0,
                isPlaying: false,
                videoTitle: title,
                uploadDate,
                updatedAt: new Date()
            }).where(eq(schema.rooms.id, roomId));

            io.to(roomId).emit('video-changed', { videoId, playlistId, changedBy: socketData.userName, title, uploadDate });

            // Proactively add to history if we have a videoId
            if (videoId) {
                await addToHistory(roomId, videoId, title || "YouTube Video");
            }

            io.to(roomId).emit('chat-message', {
                type: 'system',
                text: `${socketData.userName} changed the ${playlistId ? 'playlist' : 'video'} 🎬`
            });
        });

        async function addToHistory(roomId: string, videoId: string, title: string) {
            if (!rooms[roomId]) return;
            const history = rooms[roomId].history;
            const lastItem = history.at(-1);

            if (!lastItem || lastItem.videoId !== videoId) {
                const newItem = {
                    videoId,
                    title: title || "YouTube Video",
                    timestamp: Date.now()
                };
                rooms[roomId].history.push(newItem);
                
                // Add to DB
                await db.insert(schema.history).values({
                    roomId,
                    videoId,
                    title: title || "YouTube Video",
                    timestamp: new Date(newItem.timestamp)
                });

                if (rooms[roomId].history.length > 20) { // Increased limit slightly
                    rooms[roomId].history.shift();
                    // Optional: cleanup old history in DB if needed, or just let it grow
                }
                io.to(roomId).emit('history-updated', rooms[roomId].history);
                console.log(`[Room ${roomId}] History updated: ${videoId}`);
            } else if (lastItem && lastItem.title === "YouTube Video" && title && title !== "YouTube Video") {
                lastItem.title = title;
                // Update in DB
                await db.update(schema.history).set({
                    title
                }).where(eq(schema.history.roomId, roomId)); // Note: this updates all items in room with this title, ideally we'd have IDs
                
                io.to(roomId).emit('history-updated', rooms[roomId].history);
            }
        }

        socket.on('update-video-info', async ({ videoId, title }) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId]) return;

            // Permission Check
            if (!rooms[roomId].users[socket.id]?.isAdmin) return;

            if (rooms[roomId].videoState.videoId === videoId) {
                rooms[roomId].videoState.title = title;
                // Update DB
                await db.update(schema.rooms).set({ videoTitle: title }).where(eq(schema.rooms.id, roomId));
            }

            await addToHistory(roomId, videoId, title);
        });

        socket.on('toggle-admin', ({ targetUserId }) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId]) return;

            // Only current admins can toggle other admins
            if (!rooms[roomId].users[socket.id]?.isAdmin) return;

            if (rooms[roomId].users[targetUserId]) {
                const targetUser = rooms[roomId].users[targetUserId];
                targetUser.isAdmin = !targetUser.isAdmin;

                io.to(roomId).emit('user-joined', { users: getRoomUsers(roomId) });
                io.to(roomId).emit('chat-message', {
                    type: 'system',
                    text: `🛡️ ${targetUser.name} is ${targetUser.isAdmin ? 'now an Admin' : 'no longer an Admin'}`
                });
            }
        });

        socket.on('clear-history', async () => {
            const roomId = socketData.currentRoom;
            const userId = socket.id;
            console.log(`[History] Clear request from ${userId} in room ${roomId}`);

            if (!roomId || !rooms[roomId]) {
                console.log(`[History] Clear failed: Room ${roomId} not found`);
                return;
            }

            const user = rooms[roomId].users[userId];
            if (!user || !user.isAdmin) {
                console.log(`[History] Clear failed: User ${user?.name} is not an admin`);
                return socket.emit('chat-message', { type: 'system', text: '⚠️ Only admins can clear history.' });
            }

            console.log(`[History] Clearing history for room ${roomId}`);
            rooms[roomId].history = [];
            
            // Clear DB
            await db.delete(schema.history).where(eq(schema.history.roomId, roomId));

            io.to(roomId).emit('history-updated', []);
            io.to(roomId).emit('chat-message', {
                type: 'system',
                text: `${user.name} cleared the watch history 🧹`
            });
        });

        socket.on('add-to-queue', async ({ videoId, title, thumbnail, uploadDate }) => {
            const roomId = socketData.currentRoom;
            console.log(`[Queue] Add request from ${socketData.userName} in room ${roomId}: ${title}`);
            if (!roomId || !rooms[roomId]) {
                console.log(`[Queue] Room not found: ${roomId}`);
                return;
            }

            // Safety check for queue existence
            if (!rooms[roomId].queue) rooms[roomId].queue = [];

            // Only admin can add to queue
            const user = rooms[roomId].users[socket.id];
            if (!user || !user.isAdmin) {
                console.log(`[Queue] Permission denied for ${socketData.userName}`);
                return;
            }

            const newItem = { videoId, title, thumbnail, uploadDate, addedBy: socketData.userName };
            rooms[roomId].queue.push(newItem);
            
            // Add to DB
            await db.insert(schema.queue).values({
                roomId,
                videoId,
                title,
                thumbnail,
                uploadDate,
                addedBy: socketData.userName,
                position: rooms[roomId].queue.length
            });

            console.log(`[Queue] New queue size: ${rooms[roomId].queue.length}`);
            io.to(roomId).emit('queue-updated', rooms[roomId].queue);

            io.to(roomId).emit('chat-message', {
                type: 'system',
                text: `➕ ${socketData.userName} added "${title}" to the queue.`
            });
        });

        socket.on('remove-from-queue', async (index: number) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId]) return;

            // Safety check
            if (!rooms[roomId].queue) rooms[roomId].queue = [];

            if (!rooms[roomId].users[socket.id]?.isAdmin) return;

            if (index >= 0 && index < rooms[roomId].queue.length) {
                rooms[roomId].queue.splice(index, 1);
                
                // Sync DB (Simpler to clear and re-insert or just delete by position)
                await db.delete(schema.queue).where(eq(schema.queue.roomId, roomId));
                if (rooms[roomId].queue.length > 0) {
                   for (let i = 0; i < rooms[roomId].queue.length; i++) {
                       const item = rooms[roomId].queue[i];
                       await db.insert(schema.queue).values({
                           roomId,
                           ...item,
                           position: i
                       });
                   }
                }

                io.to(roomId).emit('queue-updated', rooms[roomId].queue);
            }
        });

        socket.on('play-next', async () => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId]) return;

            // Permission Check
            if (!rooms[roomId].users[socket.id]?.isAdmin) return;

            const room = rooms[roomId];
            if (room.queue.length === 0) return;

            // Simple throttle: don't play next if we just changed video in the last 2 seconds
            const now = Date.now();
            if ((room as any)._lastQueuePop && (now - (room as any)._lastQueuePop < 2000)) {
                return;
            }

            const nextItem = room.queue.shift();
            if (nextItem) {
                (room as any)._lastQueuePop = now;
                room.videoState = {
                    videoId: nextItem.videoId,
                    playlistId: '',
                    time: 0,
                    playing: true,
                    title: nextItem.title,
                    uploadDate: nextItem.uploadDate
                };

                // Sync Room State in DB
                await db.update(schema.rooms).set({
                    videoId: nextItem.videoId,
                    playlistId: '',
                    videoTime: 0,
                    isPlaying: true,
                    videoTitle: nextItem.title,
                    uploadDate: nextItem.uploadDate,
                    updatedAt: new Date()
                }).where(eq(schema.rooms.id, roomId));

                // Sync Queue in DB
                await db.delete(schema.queue).where(eq(schema.queue.roomId, roomId));
                if (room.queue.length > 0) {
                    for (let i = 0; i < room.queue.length; i++) {
                        const item = room.queue[i];
                        await db.insert(schema.queue).values({
                            roomId,
                            ...item,
                            position: i
                        });
                    }
                }

                io.to(roomId).emit('video-changed', {
                    videoId: nextItem.videoId,
                    playlistId: '',
                    title: nextItem.title,
                    uploadDate: nextItem.uploadDate
                });
                io.to(roomId).emit('queue-updated', room.queue);
                await addToHistory(roomId, nextItem.videoId, nextItem.title);

                io.to(roomId).emit('chat-message', {
                    type: 'system',
                    text: `🎬 Now playing from queue: "${nextItem.title}"`
                });
            }
        });

        socket.on('toggle-mic', ({ isMuted }) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId] || !rooms[roomId].users[socket.id]) return;

            rooms[roomId].users[socket.id].isMuted = isMuted;
            if (isMuted) rooms[roomId].users[socket.id].isTalking = false;
            io.to(roomId).emit('user-joined', { users: getRoomUsers(roomId) });
        });

        socket.on('is-talking', ({ isTalking }) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId] || !rooms[roomId].users[socket.id]) return;

            rooms[roomId].users[socket.id].isTalking = isTalking;
            io.to(roomId).emit('user-joined', { users: getRoomUsers(roomId) });
        });

        // WebRTC Signaling
        socket.on('signal', (data) => {
            const roomId = socketData.currentRoom;
            if (!roomId) return;
            // Send signal to specific peer
            io.to(data.to).emit('signal', {
                from: socket.id,
                signal: data.signal
            });
        });

        socket.on('request-signal', (data) => {
            const roomId = socketData.currentRoom;
            if (!roomId) return;
            io.to(data.to).emit('request-signal', { from: socket.id });
        });

        socket.on('send-message', ({ text }) => {
            const roomId = socketData.currentRoom;
            if (!roomId || !text || !text.trim() || !rooms[roomId]?.users[socket.id]) return;

            // Basic Rate Limiting
            const now = Date.now();
            const lastMessage = userLastMessageTime[socket.id] || 0;
            if (now - lastMessage < MESSAGE_COOLDOWN) {
                return; // Silently drop fast messages or could notify user
            }
            userLastMessageTime[socket.id] = now;

            // Trim very long messages to prevent UI breakage/storage issues
            const safeText = text.trim().substring(0, 1000);

            // Mark active on message
            rooms[roomId].users[socket.id].lastActive = now;

            io.to(roomId).emit('chat-message', {
                type: 'user',
                senderId: socket.id,
                senderName: socketData.userName,
                senderColor: socketData.userColor,
                text: safeText,
                timestamp: now
            });
        });

        socket.on('heartbeat', () => {
            const roomId = socketData.currentRoom;
            if (roomId && rooms[roomId]?.users[socket.id]) {
                rooms[roomId].users[socket.id].lastActive = Date.now();
            }
        });

        socket.on('ping', () => {
            socket.emit('pong');
        });

        socket.on('disconnect', () => {
            const roomId = socketData.currentRoom;
            if (!roomId || !rooms[roomId]) return;

            const wasAdmin = rooms[roomId].users[socket.id]?.isAdmin;
            delete rooms[roomId].users[socket.id];

            const remainingUserIds = Object.keys(rooms[roomId].users);
            if (remainingUserIds.length === 0) {
                delete rooms[roomId];
            } else {
                // If the admin left, promote the next person
                if (wasAdmin) {
                    const nextAdminId = remainingUserIds[0];
                    rooms[roomId].users[nextAdminId].isAdmin = true;

                    io.to(roomId).emit('chat-message', {
                        type: 'system',
                        text: `👑 ${rooms[roomId].users[nextAdminId].name} is now the host.`
                    });
                }

                const remainingUsers = getRoomUsers(roomId);
                socket.to(roomId).emit('user-left', {
                    id: socket.id,
                    name: socketData.userName,
                    users: remainingUsers
                });
                io.to(roomId).emit('chat-message', {
                    type: 'system',
                    text: `${socketData.userName} left the room 👋`
                });
            }
            console.log(`[-] User disconnected: ${socket.id}`);
        });
    });

    // Background interval to check for inactivity
    setInterval(() => {
        Object.keys(rooms).forEach(roomId => {
            // Broadcast update to all rooms to keep lists in sync
            io.to(roomId).emit('user-joined', { users: getRoomUsers(roomId) });
        });
    }, 30000); // Check every 30 seconds

    return io;
}
