"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { io, Socket } from "socket.io-client";
import { LogOut, Send, Users, Youtube, Share2, History, Clock, MessageSquare, ShieldCheck, ShieldAlert, Mic, MicOff, Settings, ChevronDown, Search, Loader2, Trash2, ListVideo, PlayCircle, PlusCircle, Home, Smile, Volume2, VolumeX, Monitor, MonitorOff } from "lucide-react";
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

interface User {
    id: string;
    name: string;
    color: string;
    isAdmin: boolean;
    isMuted: boolean;
    isTalking: boolean;
}

interface HistoryItem {
    videoId: string;
    title: string;
    timestamp: number;
}

interface VideoState {
    videoId: string;
    playlistId: string;
    time: number;
    playing: boolean;
    title?: string;
    uploadDate?: string;
}

interface QueueItem {
    videoId: string;
    title: string;
    thumbnail?: string;
    uploadDate?: string;
    addedBy: string;
}

interface Message {
    type: 'user' | 'system';
    text: string;
    senderName?: string;
    senderColor?: string;
    senderId?: string;
    timestamp?: number;
}

interface SearchResult {
    id?: string;
    title: string;
    thumbnail?: string;
    duration?: string;
    views?: string;
    author?: string;
    uploadDate?: string;
    isSuggestion?: boolean;
}

export default function RoomPage() {
    const params = useParams();
    const roomId = params?.roomId as string;
    const router = useRouter();
    const { data: session, status } = useSession();

    const [socket, setSocket] = useState<Socket | null>(null);
    const [userName, setUserName] = useState<string>("");
    const [users, setUsers] = useState<User[]>([]);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const isAdminRef = useRef<boolean>(false);
    const [isMuted, setIsMuted] = useState<boolean>(true);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
    const polite = useRef<Record<string, boolean>>({});
    const makingOffer = useRef<Record<string, boolean>>({});
    const ignoreOffer = useRef<Record<string, boolean>>({});
    const remoteStreams = useRef<Record<string, MediaStream>>({});
    const [talkingUsers, setTalkingUsers] = useState<Set<string>>(new Set());
    const [ping, setPing] = useState<number>(0);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicId, setSelectedMicId] = useState<string>("");
    const [showMicSettings, setShowMicSettings] = useState(false);
    const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});
    const [videoVolume, setVideoVolume] = useState<number>(50);
    const [isMutedVideo, setIsMutedVideo] = useState<boolean>(false);
    const [openSettingsUserId, setOpenSettingsUserId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [sharingScreenUserId, setSharingScreenUserId] = useState<string | null>(null);
    const screenShareRef = useRef<HTMLVideoElement | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const hasJoinedRoom = useRef(false);

    const [currentVideoId, setCurrentVideoId] = useState<string>("");
    const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("");
    const [currentVideoUploadDate, setCurrentVideoUploadDate] = useState<string>("");
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [activeTab, setActiveTab] = useState<'chat' | 'users' | 'history' | 'queue'>('chat');

    const lastRoomState = useRef<VideoState>({ videoId: '', playlistId: '', time: 0, playing: false });
    const lastSyncAt = useRef<number>(Date.now());

    const playerRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [sidebarHeight, setSidebarHeight] = useState<number>(500);
    const [isMounted, setIsMounted] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const isSyncing = useRef(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const notificationSound = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        notificationSound.current = new Audio('/notification.mp3');
        notificationSound.current.volume = 0.4;
        setIsMounted(true);

        // Load saved volume
        const savedVolume = localStorage.getItem('videoVolume');
        const savedMute = localStorage.getItem('isMutedVideo');
        if (savedVolume) setVideoVolume(parseInt(savedVolume));
        if (savedMute) setIsMutedVideo(savedMute === 'true');

        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('videoVolume', videoVolume.toString());
            localStorage.setItem('isMutedVideo', isMutedVideo.toString());
        }
    }, [videoVolume, isMutedVideo, isMounted]);

    useEffect(() => {
        if (playerRef.current && isPlayerReady) {
            if (isMutedVideo) {
                playerRef.current.mute();
            } else {
                playerRef.current.unMute();
                playerRef.current.setVolume(videoVolume);
            }
        }
    }, [videoVolume, isMutedVideo, isPlayerReady]);

    useEffect(() => {
        isAdminRef.current = isAdmin;
    }, [isAdmin]);

    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated") {
            router.push(`/auth/login?callbackUrl=/room/${roomId}`);
            return;
        }

        if (status === "authenticated" && session?.user?.name) {
            setUserName(session.user.name);
        }

        // If we already have a socket connected, don't re-initialize
        if (socketRef.current && socketRef.current.connected) {
            // But if the socket exists but the state doesn't reflect it, sync them
            if (!socket) setSocket(socketRef.current);
            return;
        }

        setMessages([{ type: 'system', text: 'Connecting to room...' }]);

        const initSocket = async () => {
            try {
                let success = false;
                for (let i = 0; i < 3; i++) {
                    try {
                        const res = await fetch('/api/init-socket');
                        if (res.ok) {
                            success = true;
                            break;
                        }
                    } catch (e) {
                        console.error(`Socket init fetch attempt ${i + 1} failed`, e);
                        await new Promise(r => setTimeout(r, 500));
                    }
                }

                if (!success) throw new Error("Could not initialize socket server");

                const newSocket = io({
                    path: '/api/socket',
                    addTrailingSlash: false,
                    reconnectionAttempts: 10,
                    reconnectionDelay: 1000,
                    timeout: 20000,
                });

                socketRef.current = newSocket;
                setSocket(newSocket);
            } catch (err) {
                console.error("Socket initialization failed:", err);
                setMessages([{ type: 'system', text: 'Failed to connect. Please refresh.' }]);
            }
        };

        initSocket();

        return () => {
            // We only want to disconnect if the roomId literally changed
            // or if the whole component is unmounting.
            // Note: In development React 18, this might still trigger twice.
        };
    }, [router, roomId, status]);

    // Separate effect for true cleanup on unmount or roomId change
    useEffect(() => {
        return () => {
            if (socketRef.current) {
                console.log("[Client] Disconnecting socket due to unmount/room change");
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
            Object.values(peerConnections.current).forEach(pc => pc.close());
            hasJoinedRoom.current = false;
        };
    }, [roomId]);

    useEffect(() => {
        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        const handleDeviceSwitch = async () => {
            if (!localStreamRef.current || !selectedMicId) return;

            // Prevent switching to the same device
            const currentTrack = localStreamRef.current.getAudioTracks()[0];
            if (currentTrack?.getSettings().deviceId === selectedMicId) return;

            try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: selectedMicId } }
                });

                const newTrack = newStream.getAudioTracks()[0];

                for (const targetId in peerConnections.current) {
                    const pc = peerConnections.current[targetId];
                    if (pc && pc.connectionState !== 'closed' && pc.signalingState !== 'closed') {
                        const senders = pc.getSenders();
                        const audioSender = senders.find(s => s.track?.kind === 'audio');
                        if (audioSender) {
                            await audioSender.replaceTrack(newTrack);
                        }
                    }
                }

                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach(track => track.stop());
                }

                setLocalStream(newStream);
                localStreamRef.current = newStream;
            } catch (err) {
                console.error("Failed to switch microphone:", err);
            }
        };

        handleDeviceSwitch();
    }, [selectedMicId]);

    const toggleMic = async () => {
        try {
            if (!localStreamRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
                });
                setLocalStream(stream);
                localStreamRef.current = stream;
                setIsMuted(false);
                socket?.emit('toggle-mic', { isMuted: false });

                for (const targetId in peerConnections.current) {
                    const pc = peerConnections.current[targetId];
                    if (pc.connectionState !== 'closed') {
                        stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));
                    }
                }
            } else {
                const newMuteState = !isMuted;
                localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !newMuteState);
                setIsMuted(newMuteState);
                socket?.emit('toggle-mic', { isMuted: newMuteState });
            }
        } catch (err) {
            console.error("Mic access denied:", err);
            alert("Could not access microphone.");
        }
    };

    const toggleScreenShare = async () => {
        if (isSharingScreen) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    };

    const startScreenShare = async () => {
        if (sharingScreenUserId && sharingScreenUserId !== socket?.id) {
            alert("Someone is already sharing their screen.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });

            setScreenStream(stream);
            screenStreamRef.current = stream;
            setIsSharingScreen(true);
            setSharingScreenUserId(socket?.id || null);
            socket?.emit('start-screen-share');

            // Add all tracks (video and potentially audio) to peer connections
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    stopScreenShare();
                };

                for (const targetId in peerConnections.current) {
                    const pc = peerConnections.current[targetId];
                    if (pc.connectionState !== 'closed') {
                        pc.addTrack(track, stream);
                    }
                }
            });
        } catch (err) {
            console.error("Screen share error:", err);
        }
    };

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => {
                track.stop();
                // Remove from peer connections
                for (const targetId in peerConnections.current) {
                    const pc = peerConnections.current[targetId];
                    if (pc.connectionState !== 'closed') {
                        const sender = pc.getSenders().find(s => s.track === track);
                        if (sender) pc.removeTrack(sender);
                    }
                }
            });
            setScreenStream(null);
            screenStreamRef.current = null;
        }
        setIsSharingScreen(false);
        setSharingScreenUserId(null);
        socket?.emit('stop-screen-share');
    };

    const createPC = (targetId: string) => {
        if (peerConnections.current[targetId]) return peerConnections.current[targetId];

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        polite.current[targetId] = socket?.id! > targetId;

        pc.onnegotiationneeded = async () => {
            try {
                makingOffer.current[targetId] = true;
                const offer = await pc.createOffer();
                if (pc.signalingState !== "stable") return;
                await pc.setLocalDescription(offer);
                socket?.emit('signal', { to: targetId, signal: { sdp: pc.localDescription } });
            } catch (err) {
                console.error("Negotiation error:", err);
            } finally {
                makingOffer.current[targetId] = false;
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket?.emit('signal', { to: targetId, signal: { candidate: event.candidate } });
            }
        };

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            
            // If the track is part of a stream with video, it's likely a screen share
            if (event.track.kind === 'video' || stream.getVideoTracks().length > 0) {
                setScreenStream(stream);
                setSharingScreenUserId(targetId);
                // The <video> element will handle playing both video and audio from this stream
                return;
            }

            // Otherwise it's a microphone track
            remoteStreams.current[targetId] = stream;

            let audio = document.getElementById(`audio-${targetId}`) as HTMLAudioElement;
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = `audio-${targetId}`;
                audio.autoplay = true;
                audio.style.position = 'fixed';
                audio.style.left = '-9999px';
                audio.style.top = '-9999px';
                document.body.appendChild(audio);
            }
            audio.srcObject = stream;
            audio.volume = userVolumes[targetId] ?? 1.0;
            audio.play().catch(e => {
                console.log("Audio play failed - requires user interaction:", e);
                const unlock = () => {
                    audio.play();
                    document.removeEventListener('click', unlock);
                };
                document.addEventListener('click', unlock);
            });
        };

        const currentStream = localStreamRef.current;
        if (currentStream) {
            currentStream.getAudioTracks().forEach(track => {
                pc.addTrack(track, currentStream);
            });
        }

        const currentScreenStream = screenStreamRef.current;
        if (currentScreenStream && isSharingScreen) {
            currentScreenStream.getVideoTracks().forEach(track => {
                pc.addTrack(track, currentScreenStream);
            });
        }

        peerConnections.current[targetId] = pc;
        return pc;
    };

    useEffect(() => {
        if (!localStreamRef.current || isMuted) return;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyzer = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(localStreamRef.current);
        source.connect(analyzer);

        analyzer.fftSize = 256;
        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let lastTalkingState = false;
        let silenceCount = 0;

        const checkTalking = () => {
            analyzer.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const isCurrentlyTalking = average > 15;

            if (isCurrentlyTalking) {
                silenceCount = 0;
                if (!lastTalkingState) {
                    lastTalkingState = true;
                    socket?.emit('is-talking', { isTalking: true });
                }
            } else {
                silenceCount++;
                if (silenceCount > 20 && lastTalkingState) {
                    lastTalkingState = false;
                    socket?.emit('is-talking', { isTalking: false });
                }
            }
            requestAnimationFrame(checkTalking);
        };

        checkTalking();

        return () => {
            audioContext.close();
        };
    }, [localStream, isMuted, socket]);

    useEffect(() => {
        if (!socket || !userName || !roomId) return;

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                initPlayer();
            };
        } else {
            initPlayer();
        }

        function initPlayer() {
            if (playerRef.current) return;

            playerRef.current = new window.YT.Player('player', {
                height: '100%',
                width: '100%',
                videoId: '',
                playerVars: {
                    'autoplay': 0,
                    'controls': 1,
                    'rel': 0,
                    'modestbranding': 1
                },
                events: {
                    'onReady': () => {
                        setIsPlayerReady(true);
                    },
                    'onStateChange': (event: any) => {
                        const state = event.data;

                        if (!isAdminRef.current) {
                            // Non-admin local control logic
                            if (state === window.YT.PlayerState.PLAYING && !isSyncing.current) {
                                // When a non-admin resumes, jump to the live room time
                                const elapsed = lastRoomState.current.playing ? (Date.now() - lastSyncAt.current) / 1000 : 0;
                                const liveTime = lastRoomState.current.time + elapsed;

                                const diff = Math.abs(playerRef.current.getCurrentTime() - liveTime);
                                if (diff > 2) {
                                    isSyncing.current = true;
                                    playerRef.current.seekTo(liveTime, true);
                                    setTimeout(() => isSyncing.current = false, 500);
                                }
                            }
                            return;
                        }

                        const data = playerRef.current?.getVideoData?.();
                        if (data && data.video_id && data.video_id !== 'item') {
                            setCurrentVideoId(data.video_id);
                            setCurrentVideoTitle(data.title);
                            socket?.emit('update-video-info', {
                                videoId: data.video_id,
                                title: data.title || "YouTube Video"
                            });
                        }

                        if (isSyncing.current) return;

                        const time = playerRef.current.getCurrentTime();
                        const videoData = playerRef.current.getVideoData();
                        const videoId = videoData ? videoData.video_id : null;

                        // Only broadcast specific states to avoid noise
                        if (state === window.YT.PlayerState.PLAYING) {
                            console.log("[Client Admin] Emitting PLAY at:", time);
                            socket?.emit('video-update', { type: 'PLAY', time, videoId });
                        } else if (state === window.YT.PlayerState.PAUSED) {
                            console.log("[Client Admin] Emitting PAUSE at:", time);
                            socket?.emit('video-update', { type: 'PAUSE', time, videoId });
                        } else if (state === window.YT.PlayerState.ENDED) {
                            socket?.emit('play-next');
                        }
                    }
                }
            });
        }

        socket.on('room-joined', ({ videoState, users, history: roomHistory, queue: roomQueue, isAdmin: userIsAdmin, screenShareBy }) => {
            setUsers(users);
            setIsAdmin(!!userIsAdmin);
            lastRoomState.current = videoState;
            lastSyncAt.current = Date.now();
            if (roomHistory) setHistory(roomHistory);
            if (roomQueue) setQueue(roomQueue);
            if (screenShareBy) setSharingScreenUserId(screenShareBy);
            
            if (videoState.videoId) {
                setCurrentVideoId(videoState.videoId);
                setCurrentVideoTitle(videoState.title || "");
                setCurrentVideoUploadDate(videoState.uploadDate || "");
            }
            if (videoState.playlistId || videoState.videoId) {
                isSyncing.current = true;
                if (videoState.playlistId) {
                    playerRef.current.loadPlaylist({
                        list: videoState.playlistId,
                        listType: 'playlist',
                        index: videoState.playlistIndex || 0,
                        startSeconds: videoState.time
                    });
                } else {
                    playerRef.current.loadVideoById(videoState.videoId, videoState.time);
                }
                if (!videoState.playing) playerRef.current.pauseVideo();
                setTimeout(() => isSyncing.current = false, 1000);
            }
        });

        socket.on('user-joined', (data) => {
            setUsers(data.users);
            const me = data.users.find((u: any) => u.id === socket.id);
            if (me) setIsAdmin(me.isAdmin);

            data.users.forEach((user: any) => {
                if (user.id !== socket.id && !peerConnections.current[user.id]) {
                    createPC(user.id);
                }
            });
        });

        socket.on('signal', async ({ from, signal }) => {
            try {
                let pc = peerConnections.current[from];
                if (!pc) pc = createPC(from);

                // Guard: Ensure connection exists and isn't closed
                if (!pc || (pc.signalingState as string) === 'closed') return;

                if (signal.sdp) {
                    const offerCollision = (signal.sdp.type === "offer") &&
                        (makingOffer.current[from] || pc.signalingState !== "stable");

                    ignoreOffer.current[from] = !polite.current[from] && offerCollision;
                    if (ignoreOffer.current[from]) return;

                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

                    // Re-check after await: connection might have been closed/removed
                    pc = peerConnections.current[from];
                    if (!pc || (pc.signalingState as string) === 'closed') return;

                    if (signal.sdp.type === 'offer') {
                        const answer = await pc.createAnswer();
                        if (pc.signalingState as string !== 'closed') {
                            await pc.setLocalDescription(answer);
                            socket.emit('signal', { to: from, signal: { sdp: pc.localDescription } });
                        }
                    }
                } else if (signal.candidate) {
                    try {
                        if (pc.signalingState as string !== 'closed') {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        }
                    } catch (err) {
                        if (!ignoreOffer.current[from]) throw err;
                    }
                }
            } catch (err) {
                console.error("Signaling error:", err);
            }
        });

        socket.on('user-left', ({ id, users: updatedUsers }) => {
            setUsers(updatedUsers);
            if (peerConnections.current[id]) {
                peerConnections.current[id].close();
                delete peerConnections.current[id];
            }
            if (sharingScreenUserId === id) {
                setScreenStream(null);
                setSharingScreenUserId(null);
            }
            const audio = document.getElementById(`audio-${id}`);
            if (audio) audio.remove();
        });

        socket.on('video-sync', (data) => {
            console.log("[Client Sync] Received:", data);

            // Update last known room state
            lastRoomState.current = {
                ...lastRoomState.current,
                time: data.time,
                playing: data.type === 'PLAY',
                videoId: data.videoId || lastRoomState.current.videoId
            };
            lastSyncAt.current = Date.now();

            isSyncing.current = true;

            // Check if we need to load a different video first
            const currentVideoData = playerRef.current?.getVideoData?.();
            const isDifferentVideo = data.videoId && currentVideoData?.video_id !== data.videoId;

            if (isDifferentVideo && !data.playlistId) {
                playerRef.current.loadVideoById(data.videoId, data.time);
                setCurrentVideoId(data.videoId);
            }

            if (data.type === 'PLAY') {
                const diff = Math.abs(playerRef.current.getCurrentTime() - data.time);
                if (diff > 1.5) { // Only seek if difference is significant to avoid studdering
                    playerRef.current.seekTo(data.time, true);
                }
                playerRef.current.playVideo();
            } else if (data.type === 'PAUSE') {
                playerRef.current.pauseVideo();
                playerRef.current.seekTo(data.time, true);
            } else if (data.type === 'SEEK') {
                playerRef.current.seekTo(data.time, true);
            }

            // Release the sync lock shortly after the expected state change
            setTimeout(() => {
                isSyncing.current = false;
            }, 800);
        });

        socket.on('video-changed', (data) => {
            isSyncing.current = true;
            if (data.videoId) {
                setCurrentVideoId(data.videoId);
                setCurrentVideoTitle(data.title || "");
                setCurrentVideoUploadDate(data.uploadDate || "");
            }
            if (data.playlistId) {
                playerRef.current.loadPlaylist({
                    list: data.playlistId,
                    listType: 'playlist'
                });
            } else if (data.videoId) {
                playerRef.current.loadVideoById(data.videoId);
            }
            setTimeout(() => isSyncing.current = false, 1000);
        });

        socket.on('chat-message', (data) => {
            setMessages(prev => [...prev, data]);
            if (data.type === 'user' && data.senderId !== socket.id) {
                notificationSound.current?.play().catch(() => { });
            }
        });

        socket.on('screen-share-started', ({ userId }) => {
            setSharingScreenUserId(userId);
            // If we are already connected to this user, they will send a track which will trigger ontrack
        });

        socket.on('screen-share-stopped', ({ userId }) => {
            if (sharingScreenUserId === userId) {
                setScreenStream(null);
                setSharingScreenUserId(null);
            }
        });
        socket.on('history-updated', (newHistory) => {
            setHistory(newHistory);
        });
        socket.on('queue-updated', (newQueue) => {
            setQueue(newQueue);
        });

        socket.on('pong', () => {
            const lastPingTime = (socket as any)._pingStart;
            if (lastPingTime) {
                setPing(Date.now() - lastPingTime);
            }
        });

        // Dedicated Room Joining Logic
        if (socket && isPlayerReady && userName && !hasJoinedRoom.current) {
            console.log("[Client] Emitting join-room...");
            socket.emit('join-room', {
                roomId,
                userName: session?.user?.name || "Guest",
                userId: (session?.user as any)?.id
            });
            hasJoinedRoom.current = true;
        }

        const pingInterval = setInterval(() => {
            (socket as any)._pingStart = Date.now();
            socket.emit('ping');
        }, 3000);

        const updateDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const mics = devices.filter(d => d.kind === 'audioinput');
                setDevices(mics);
                if (mics.length > 0 && !selectedMicId) {
                    setSelectedMicId(mics[0].deviceId);
                }
            } catch (err) {
                console.error("Error listing devices:", err);
            }
        };
        updateDevices();

        return () => {
            clearInterval(pingInterval);
            socket.off('room-joined');
            socket.off('user-joined');
            socket.off('user-left');
            socket.off('video-sync');
            socket.off('video-changed');
            socket.off('chat-message');
            socket.off('history-updated');
            socket.off('signal');
            socket.off('pong');
            hasJoinedRoom.current = false;
        };
    }, [socket, userName, roomId, isPlayerReady]);

    useEffect(() => {
        if (screenShareRef.current && screenStream) {
            screenShareRef.current.srcObject = screenStream;
        }
    }, [screenStream]);

    useEffect(() => {
        if (!socket) return;
        const interval = setInterval(() => {
            socket.emit('heartbeat');
        }, 30000);
        return () => clearInterval(interval);
    }, [socket]);

    useEffect(() => {
        if (!videoContainerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setSidebarHeight(entry.contentRect.height);
            }
        });

        observer.observe(videoContainerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const extractMediaIds = (url: string) => {
        let videoId = null;
        let playlistId = null;
        try {
            const urlObj = new URL(url.includes('://') ? url : `https://${url}`);
            if (urlObj.hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1);
            } else if (urlObj.pathname.startsWith('/shorts/')) {
                videoId = urlObj.pathname.split('/')[2];
            } else {
                videoId = urlObj.searchParams.get('v');
                playlistId = urlObj.searchParams.get('list');
            }
        } catch (err) {
            if (url.length === 11) videoId = url;
        }
        return { videoId, playlistId };
    };

    const handleSendMessage = () => {
        if (!chatInput.trim() || !socket) return;
        socket.emit('send-message', { text: chatInput.trim() });
        setChatInput("");
    };

    const handleSearch = async (query: string) => {
        if (!query.trim() || query.includes('youtube.com') || query.includes('youtu.be')) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);
        setShowResults(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            setSearchResults(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Search error:", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSearchResult = (query: string) => {
        setVideoUrl(query);
        setShowResults(false);
    };

    const handleChangeVideo = async (overrideUrl?: string) => {
        const urlToUse = (overrideUrl || videoUrl).trim();
        if (!urlToUse || !socket) return;

        const { videoId, playlistId } = extractMediaIds(urlToUse);
        if (videoId || playlistId) {
            socket.emit('change-video', { videoId, playlistId });
            setVideoUrl("");
            setShowResults(false);
        } else if (!overrideUrl) {
            handleSearch(urlToUse);
        }
    };

    const copyRoomLink = () => {
        navigator.clipboard.writeText(roomId);
        alert('Room ID copied: ' + roomId);
    };
    return (
        <div className="flex flex-col h-screen max-h-screen">
            <Header roomId={roomId} isAdmin={isAdmin} />
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-3 p-2 sm:p-4 lg:p-5 ">

                {/* ── MAIN (left column on desktop) ───────────────────────────── */}
                <main className="flex flex-col gap-3 min-w-0">
                    {/* Video Player */}
                    <div ref={videoContainerRef} className="relative rounded-[16px] sm:rounded-[20px]  bg-black glass-card shrink-0"
                        style={{ aspectRatio: '16/9' }}
                    >
                        <div id="player" className={`absolute inset-0 w-full h-full ${sharingScreenUserId ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />

                        {sharingScreenUserId && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20">
                                {screenStream ? (
                                    <video
                                        ref={screenShareRef}
                                        autoPlay
                                        playsInline
                                        muted={sharingScreenUserId === socket?.id}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                        <p className="text-white font-medium">Connecting to screen share...</p>
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
                                    <Monitor className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-[0.7rem] font-bold text-white tracking-wider uppercase">
                                        {sharingScreenUserId === socket?.id ? "You are sharing" : `${users.find(u => u.id === sharingScreenUserId)?.name || "Someone"} is sharing`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {!currentVideoId && !sharingScreenUserId && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#0a0a0a] z-10">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4 sm:mb-6 animate-pulse">
                                    <Youtube className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                                </div>
                                <h2 className="text-lg sm:text-2xl font-bold mb-2 sm:mb-3 text-white">Ready to Watch?</h2>
                                <p className="text-[#AAAAAA] max-w-xs sm:max-w-sm leading-relaxed text-sm sm:text-base">
                                    Paste a YouTube link or search below to start watching with your friends!
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Search / URL Input */}
                    <div className="relative">
                        <div className={`flex gap-2 p-3 sm:p-4 glass-card ${!isAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex-1 relative min-w-0">
                                <input
                                    type="text"
                                    disabled={!isAdmin}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white text-sm outline-none transition-all duration-300 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed"
                                    placeholder={isAdmin ? "Search YouTube or Paste Link..." : "Only admins can change videos"}
                                    value={videoUrl}
                                    onChange={(e) => {
                                        setVideoUrl(e.target.value);
                                        if (e.target.value.length > 2) handleSearch(e.target.value);
                                        else setShowResults(false);
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && handleChangeVideo()}
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] pointer-events-none" />
                            </div>
                            <button
                                disabled={!isAdmin}
                                className="bg-primary text-white border-none rounded-xl px-4 sm:px-6 py-2 font-bold text-sm cursor-pointer transition-all hover:bg-primary-hover hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                                onClick={() => handleChangeVideo()}
                            >
                                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
                            </button>
                        </div>

                        {/* Search Results Dropdown */}
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl  z-50 backdrop-blur-xl">
                                <div className="p-3 border-b border-white/5 flex items-center justify-between">
                                    <span className="text-[0.7rem] font-bold text-[#AAAAAA] uppercase tracking-widest pl-2">Search Suggestions</span>
                                    <button onClick={() => setShowResults(false)} className="text-[0.7rem] text-primary hover:underline px-2">Close</button>
                                </div>
                                <div className="max-h-[280px] overflow-y-auto">
                                    {searchResults.map((result, idx) => (
                                        <div
                                            key={idx}
                                            className="w-full px-3 sm:px-4 py-3 hover:bg-white/5 flex items-center gap-3 transition-all border-b border-white/5 last:border-0 group"
                                        >
                                            {result.thumbnail && (
                                                <div className="w-[80px] sm:w-[100px] aspect-video rounded-lg  flex-shrink-0 border border-white/10 shadow-lg group-hover:border-primary transition-colors relative">
                                                    <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
                                                    {result.duration && (
                                                        <span className="absolute bottom-1 right-1 bg-black/80 text-[0.6rem] px-1 py-0.5 rounded font-bold text-white">{result.duration}</span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-[0.85rem] font-bold text-white/90 truncate leading-snug mb-0.5">
                                                    {result.title}
                                                </h4>
                                                {result.author && (
                                                    <div className="flex items-center gap-1.5 text-[0.7rem] text-[#888888] font-medium flex-wrap">
                                                        <span className="truncate max-w-[100px]">{result.author}</span>
                                                        {result.views && <span>• {result.views}</span>}
                                                    </div>
                                                )}
                                            </div>
                                            {isAdmin && result.id && (
                                                <div className="flex gap-1.5 shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            socket?.emit('change-video', {
                                                                videoId: result.id,
                                                                title: result.title,
                                                                uploadDate: result.uploadDate
                                                            });
                                                            setVideoUrl("");
                                                            setShowResults(false);
                                                        }}
                                                        className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all"
                                                        title="Play Now"
                                                    >
                                                        <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            socket?.emit('add-to-queue', {
                                                                videoId: result.id,
                                                                title: result.title,
                                                                thumbnail: result.thumbnail,
                                                                uploadDate: result.uploadDate
                                                            });
                                                            setVideoUrl("");
                                                            setShowResults(false);
                                                        }}
                                                        className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-all"
                                                        title="Add to Queue"
                                                    >
                                                        <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </button>
                                                </div>
                                            )}
                                            {!isAdmin && (
                                                <span className="text-[0.65rem] text-[#555555] italic shrink-0">Admin Only</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Now Playing Card */}
                    {currentVideoId && (
                        <div className="p-3 sm:p-4 glass-card flex gap-3 items-center shrink-0">
                            <div className="w-[90px] sm:w-[130px] aspect-video rounded-lg  flex-shrink-0 border border-white/10 shadow-lg relative group">
                                <img
                                    src={`https://img.youtube.com/vi/${currentVideoId}/mqdefault.jpg`}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover"
                                />
                                {isAdmin && queue.length > 0 && (
                                    <button
                                        onClick={() => socket?.emit('play-next')}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1 font-bold text-[0.75rem] text-white"
                                    >
                                        <PlayCircle className="w-4 h-4 text-primary" />
                                        Next
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Youtube className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    <span className="text-[0.7rem] font-bold text-[#AAAAAA] uppercase tracking-widest">Now Playing</span>
                                </div>
                                <h3 className="text-[0.9rem] sm:text-[1rem] font-bold truncate mb-1 text-white">
                                    {currentVideoTitle || "Untitled Video"}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2">
                                    <a
                                        href={`https://youtube.com/watch?v=${currentVideoId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[0.75rem] text-primary hover:underline flex items-center gap-1 opacity-80 hover:opacity-100 transition-all font-medium"
                                    >
                                        <Share2 className="w-3 h-3" />
                                        <span className="truncate max-w-[160px] sm:max-w-none">{currentVideoId}</span>
                                    </a>
                                    {currentVideoUploadDate && (
                                        <span className="text-[0.75rem] text-[#888888] font-medium">• {currentVideoUploadDate}</span>
                                    )}
                                </div>
                                <div className="mt-3 flex items-center gap-3 bg-white/5 py-1.5 px-3 rounded-lg border border-white/5 w-fit">
                                    <button 
                                        onClick={() => setIsMutedVideo(!isMutedVideo)}
                                        className="text-[#AAAAAA] hover:text-white transition-colors"
                                    >
                                        {isMutedVideo || videoVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={isMutedVideo ? 0 : videoVolume}
                                        onChange={(e) => {
                                            setVideoVolume(parseInt(e.target.value));
                                            if (isMutedVideo) setIsMutedVideo(false);
                                        }}
                                        className="w-24 sm:w-32 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <span className="text-[0.7rem] font-bold text-primary w-8">{isMutedVideo ? 0 : videoVolume}%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Queue — Desktop only */}
                    {queue.length > 0 && (
                        <div className="hidden lg:block glass-card ">
                            <div className="p-3 border-b border-white/5 flex items-center justify-between px-5">
                                <div className="flex items-center gap-2">
                                    <ListVideo className="w-4 h-4 text-primary" />
                                    <span className="text-[0.75rem] font-bold text-[#AAAAAA] uppercase tracking-widest">Up Next ({queue.length})</span>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => socket?.emit('play-next')}
                                        className="text-[0.75rem] font-bold text-primary hover:underline"
                                    >
                                        Play Next
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col">
                                {queue.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 px-5 hover:bg-white/5 transition-all border-b border-white/5 last:border-0 group">
                                        <div className="w-[80px] aspect-video rounded  flex-shrink-0 relative">
                                            <img src={item.thumbnail || `https://img.youtube.com/vi/${item.videoId}/default.jpg`} className="w-full h-full object-cover" alt="" />
                                            <span className="absolute top-1 left-1 bg-black/70 text-[0.6rem] w-4 h-4 flex items-center justify-center rounded-full text-white font-bold">{idx + 1}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-[0.85rem] font-bold text-white/90 truncate group-hover:text-primary transition-colors">{item.title}</h4>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[0.7rem] text-[#555555] font-medium">Added by {item.addedBy}</span>
                                                {item.uploadDate && <span className="text-[0.7rem] text-[#444444]"> • {item.uploadDate}</span>}
                                            </div>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                onClick={() => socket?.emit('remove-from-queue', idx)}
                                                className="p-1.5 rounded-lg text-transparent group-hover:text-red-500/50 hover:!text-red-500 hover:bg-red-500/10 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>

                {/* ── ASIDE (right column on desktop) ─────────────────────────── */}
                <aside
                    className="flex flex-col gap-3"
                    style={{ height: isMounted && window.innerWidth >= 1024 ? `${sidebarHeight}px` : 'auto' }}
                >
                    {/* Unified Sliding Tab Bar */}
                    <div className="flex items-center p-1 bg-white/5 rounded-2xl border border-white/5 shrink-0 relative mb-1">
                        <div
                            className="absolute top-1 bottom-1 transition-all duration-500 ease-in-out bg-primary rounded-xl shadow-[0_0_20px_rgba(255,0,0,0.3)] z-0"
                            style={{
                                left: activeTab === 'chat' ? '1%' : activeTab === 'users' ? '26%' : activeTab === 'queue' ? '51%' : '76%',
                                width: '23%'
                            }}
                        />
                        {(['chat', 'users', 'queue', 'history'] as const).map((tab) => {
                            const icons = {
                                chat: <MessageSquare className="w-4 h-4" />,
                                users: <Users className="w-4 h-4" />,
                                queue: <ListVideo className="w-4 h-4" />,
                                history: <History className="w-4 h-4" />,
                            };
                            const labels = { chat: 'Chat', users: 'People', queue: 'Queue', history: 'History' };
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all text-[0.6rem] font-bold uppercase tracking-tighter z-10 ${activeTab === tab ? 'text-white' : 'text-[#888888] hover:text-white'}`}
                                >
                                    {icons[tab]}
                                    {labels[tab]}
                                </button>
                            );
                        })}
                    </div>

                    <div className={`
                    ${activeTab === 'users' ? 'flex' : 'hidden'}
                    flex-col p-4 glass-card  flex-1
                `}>



                        <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-[#AAAAAA] mb-3 uppercase tracking-wider shrink-0">
                            <Users className="w-4 h-4" /> Watching Now ({users.length})
                        </span>
                        <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar">
                            {users.map(user => (
                                <div key={user.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/8 transition-all">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {user.isAdmin ? (
                                                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                                            ) : (
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: user.color }} />
                                            )}
                                            <span className={`text-[0.85rem] font-bold truncate ${user.id === socket?.id ? 'text-white' : 'text-[#AAAAAA]'}`}>
                                                {user.name}{user.id === socket?.id ? ' (You)' : ''}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {user.isTalking && (
                                                <div className="flex gap-[2px] items-center h-3">
                                                    <div className="w-[2px] bg-green-500 animate-[pulse_0.8s_infinite] h-full rounded-full" />
                                                    <div className="w-[2px] bg-green-500 animate-[pulse_0.6s_infinite] h-[60%] rounded-full" />
                                                    <div className="w-[2px] bg-green-500 animate-[pulse_1s_infinite] h-[80%] rounded-full" />
                                                </div>
                                            )}
                                            {user.isMuted && <MicOff className="w-3.5 h-3.5 text-red-500/50" />}
                                            {user.id !== socket?.id && (
                                                <button
                                                    onClick={() => setOpenSettingsUserId(openSettingsUserId === user.id ? null : user.id)}
                                                    className={`p-1.5 rounded-lg transition-all hover:bg-white/10 ${openSettingsUserId === user.id ? 'text-primary bg-primary/10' : 'text-[#555555]'}`}
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {openSettingsUserId === user.id && (
                                        <div className="p-3 bg-black/40 border border-white/10 rounded-xl">
                                            <div className="flex flex-col gap-3">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[0.65rem] font-bold text-[#AAAAAA] uppercase tracking-wider">Volume</span>
                                                        <span className="text-[0.65rem] font-bold text-primary">{Math.round((userVolumes[user.id] ?? 1) * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={userVolumes[user.id] ?? 1}
                                                        onChange={(e) => {
                                                            const vol = parseFloat(e.target.value);
                                                            setUserVolumes(prev => ({ ...prev, [user.id]: vol }));
                                                            const audio = document.getElementById(`audio-${user.id}`) as HTMLAudioElement;
                                                            if (audio) audio.volume = vol;
                                                        }}
                                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                                    />
                                                </div>
                                                {isAdmin && (
                                                    <div className="pt-2 border-t border-white/5">
                                                        <button
                                                            onClick={() => socket?.emit('toggle-admin', { targetUserId: user.id })}
                                                            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[0.7rem] font-bold transition-all cursor-pointer ${user.isAdmin ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                                                        >
                                                            {user.isAdmin ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                                            {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`${activeTab === 'chat' ? 'flex' : 'hidden'} flex-col  glass-card flex-1 min-h-0`}>

                        <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-[#AAAAAA]" />
                                <span className="text-[0.8rem] font-semibold text-[#AAAAAA] uppercase tracking-wider">Live Chat</span>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${isSharingScreen ? 'bg-primary text-white' : (sharingScreenUserId ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/5 text-[#555555] hover:text-[#AAAAAA]')}`}
                                    onClick={toggleScreenShare}
                                    title={isSharingScreen ? "Stop Sharing" : (sharingScreenUserId ? "Someone is sharing" : "Share Screen")}
                                    disabled={!!(sharingScreenUserId && sharingScreenUserId !== socket?.id)}
                                >
                                    {isSharingScreen ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                                </button>
                                <button
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${isMuted ? 'bg-red-500/10 text-red-500' : 'bg-green-500/20 text-green-500'}`}
                                    onClick={toggleMic}
                                    title={isMuted ? "Unmute" : "Mute"}
                                >
                                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                                <button
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${showMicSettings ? 'bg-primary/20 text-primary' : 'bg-white/5 text-[#555555] hover:text-[#AAAAAA]'}`}
                                    onClick={() => setShowMicSettings(!showMicSettings)}
                                    title="Microphone Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 custom-scrollbar min-h-0">
                            {messages.map((msg, i) => (
                                <div key={i} className={`
                                text-[0.9rem] leading-[1.4] max-w-[85%] break-words
                                ${msg.type === 'system'
                                        ? 'self-center text-[#AAAAAA] text-[0.75rem] italic bg-white/5 px-3 py-1 rounded-lg'
                                        : msg.senderId === socket?.id ? 'self-end' : 'self-start'
                                    }
                            `}>
                                    {msg.type === 'user' && msg.senderId !== socket?.id && (
                                        <div className="font-extrabold text-[0.7rem] mb-1 uppercase" style={{ color: msg.senderColor }}>{msg.senderName}</div>
                                    )}
                                    <div className={`px-3.5 py-2.5 rounded-[16px] ${msg.type === 'system' ? '' : msg.senderId === socket?.id ? 'bg-primary' : 'bg-white/8'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-3 sm:p-4 border-t border-white/10 flex flex-col gap-2.5 shrink-0">
                            {showMicSettings && devices.length > 0 && (
                                <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[0.65rem] font-bold text-[#AAAAAA] uppercase tracking-wider">Select Microphone</span>
                                        <button onClick={() => setShowMicSettings(false)} className="text-[#AAAAAA] hover:text-white">
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <select
                                        value={selectedMicId}
                                        onChange={(e) => setSelectedMicId(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary transition-all"
                                    >
                                        {devices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId} className="bg-[#1a1a1a]">
                                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex gap-2 relative">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 min-w-0"
                                        placeholder="Type a message..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                    />
                                    <button
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-primary transition-colors"
                                    >
                                        <Smile className="w-5 h-5" />
                                    </button>
                                </div>
                                <button
                                    className="w-11 h-11 flex items-center justify-center bg-primary text-white rounded-xl font-bold cursor-pointer transition-all hover:bg-primary-hover active:scale-95 shrink-0"
                                    onClick={handleSendMessage}
                                >
                                    <Send className="w-4 h-4" />
                                </button>

                                {showEmojiPicker && (
                                    <div ref={emojiPickerRef} className="absolute bottom-full right-0 mb-2 z-[100] scale-90 sm:scale-100 origin-bottom-right">
                                        <EmojiPicker
                                            theme={Theme.DARK}
                                            onEmojiClick={(emojiData: EmojiClickData) => {
                                                setChatInput(prev => prev + emojiData.emoji);
                                            }}
                                            width={300}
                                            height={400}
                                            lazyLoadEmojis={true}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Queue Panel */}
                    <div className={`${activeTab === 'queue' ? 'flex' : 'hidden'} flex-col flex-1  glass-card`}>


                        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <ListVideo className="w-4 h-4 text-[#AAAAAA]" />
                                <span className="text-[0.8rem] font-semibold text-[#AAAAAA] uppercase tracking-wider">Queue</span>
                            </div>
                            {isAdmin && queue.length > 0 && (
                                <button onClick={() => socket?.emit('play-next')} className="text-[0.75rem] font-bold text-primary hover:underline">
                                    Play Next
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {queue.length > 0 ? queue.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 px-4 hover:bg-white/5 transition-all border-b border-white/5 last:border-0 group">
                                    <div className="w-[72px] aspect-video rounded  flex-shrink-0 relative">
                                        <img src={item.thumbnail || `https://img.youtube.com/vi/${item.videoId}/default.jpg`} className="w-full h-full object-cover" alt="" />
                                        <span className="absolute top-1 left-1 bg-black/70 text-[0.6rem] w-4 h-4 flex items-center justify-center rounded-full text-white font-bold">{idx + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[0.85rem] font-bold text-white/90 truncate">{item.title}</h4>
                                        <span className="text-[0.7rem] text-[#555555] font-medium">Added by {item.addedBy}</span>
                                    </div>
                                    {isAdmin && (
                                        <button onClick={() => socket?.emit('remove-from-queue', idx)} className="text-red-500/50 hover:text-red-500 p-2 transition-colors shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )) : (
                                <div className="text-center py-10 text-[#555555] text-sm">Queue is empty</div>
                            )}
                        </div>
                    </div>

                    {/* History Panel */}
                    <div className={`${activeTab === 'history' ? 'flex' : 'hidden'} flex-col  glass-card flex-1`}>

                        <div className="p-3 sm:p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-[#AAAAAA]" />
                                <span className="text-[0.8rem] font-semibold text-[#AAAAAA] uppercase tracking-wider">Recent Views</span>
                            </div>
                            {isAdmin && history.length > 0 && (
                                <button
                                    onClick={() => {
                                        if (confirm('Clear watch history?')) socket?.emit('clear-history');
                                    }}
                                    className="p-1.5 rounded-lg text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar min-h-0">
                            {history.length === 0 ? (
                                <div className="text-center py-6 text-[#555555] text-sm">No history yet</div>
                            ) : (
                                history.slice().reverse().map((item, idx) => (
                                    <div
                                        key={`${item.videoId}-${idx}`}
                                        className="flex gap-3 items-center group cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all"
                                        onClick={() => {
                                            setVideoUrl(item.videoId);
                                            socket?.emit('change-video', { videoId: item.videoId });
                                        }}
                                    >
                                        <div className="w-[56px] aspect-video rounded-md  bg-black flex-shrink-0 border border-white/5">
                                            <img src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-[0.75rem] font-bold text-white/90 truncate group-hover:text-primary transition-colors">{item.title}</h4>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <Clock className="w-3 h-3 text-[#555555]" />
                                                <span className="text-[0.65rem] text-[#555555]">
                                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </aside>

                {/* ── FOOTER ─────────────────────────────────────────────────── */}
                <footer className="
                hidden md:flex
                fixed bottom-2 left-1/2 -translate-x-1/2
                items-center gap-3 px-4 py-1.5
                glass-card text-[0.65rem] font-medium text-[#AAAAAA]
                z-50 pointer-events-none opacity-60 backdrop-blur-md
                whitespace-nowrap
            ">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ping < 100 ? 'bg-green-500' : ping < 200 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        <span>Latency: <span className="text-white font-bold">{ping}ms</span></span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div>Connected to <span className="text-white">Togethere-internal-1</span></div>
                    <div className="hidden lg:flex items-center gap-1.5">
                        <div className="w-px h-3 bg-white/10 mx-1" />
                        <span>Region: <span className="text-white">TURKEY</span></span>
                    </div>
                </footer>
            </div>
        </div>
    );
}