'use client';

import React, { useCallback, useEffect, useContext, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

export type Message = {
  id: string;
  conversationId?: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: string;
};

interface SocketProviderProps {
  children?: React.ReactNode;
}

interface ISocketContext {
  sendMessage: (text: string) => void;
  messages: Message[];
  currentUserId: string;
  connected: boolean;
  setTyping: (isTyping: boolean) => void;
  typingUsers: string[];
  onlineUsers: Set<string>;
}

const SocketContext = React.createContext<ISocketContext | null>(null);

export const useSocket = () => {
  const state = useContext(SocketContext);
  if (!state) throw new Error('useSocket must be used within a SocketProvider');
  return state;
};

function generateClientId() {
  return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // currentUserId persisted in localStorage so refresh keeps identity
  const [currentUserId] = useState<string>(() => {
    try {
      const existing = typeof window !== 'undefined' ? localStorage.getItem('chat_user_id') : null;
      if (existing) return existing;
      const id = generateClientId();
      if (typeof window !== 'undefined') localStorage.setItem('chat_user_id', id);
      return id;
    } catch {
      return generateClientId();
    }
  });

  const [currentUserName, setCurrentUserName] = useState(() => {
    if (typeof window === 'undefined') return currentUserId.slice(0, 6);
    const savedName = localStorage.getItem('chat_user_name');
    return savedName || currentUserId.slice(0, 6);
  });

  // Update username when localStorage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chat_user_name' && e.newValue) {
        setCurrentUserName(e.newValue);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Typing indicator function
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !socket.connected) return;

      if (isTyping) {
        socket.emit('user:typing', { userId: currentUserId, username: currentUserName });
      } else {
        socket.emit('user:stop-typing', { userId: currentUserId, username: currentUserName });
      }
    },
    [socket, currentUserId, currentUserName]
  );

  // sendMessage builds a Message object and emits it
  const sendMessage = useCallback(
    (text: string) => {
      if (!socket || !socket.connected) {
        console.warn('Socket not connected, cannot send message');
        return;
      }
      const tempId = 'tmp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5);
      const msg: Message = {
        id: tempId,
        senderId: currentUserId,
        senderName: currentUserName,
        text,
        createdAt: new Date().toISOString()
      };
      // emit the message object; server should persist & rebroadcast canonical message
      socket.emit('event:message', msg);
      // optimistic UI: show immediately with temp id (server will send canonical message later)
      setMessages((prev) => [...prev, msg]);
    },
    [socket, currentUserId, currentUserName]
  );

  // handle incoming messages from server (expects JSON object already)
  const onMessageReceived = useCallback((payload: any) => {
    // server emits parsed message object, not a JSON string
    try {
      const msg = payload as Message;
      // avoid duplicating our optimistic message — replace if id matches temp
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        if (exists) {
          // replace the optimistic message with canonical one
          return prev.map((m) => (m.id === msg.id ? msg : m));
        }
        return [...prev, msg];
      });
    } catch (err) {
      console.error('Failed parsing incoming message', err);
    }
  }, []);

  useEffect(() => {
    // change the URL to your server address + port
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
    const s = io(url, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      auth: {
        userId: currentUserId,
        username: currentUserName
      }
    });

    s.on('connect', () => {
      console.log('[socket] connected', s.id);
      setConnected(true);
      // Announce user joining
      s.emit('user:join', { userId: currentUserId, username: currentUserName });
    });
    s.on('connect_error', (err) => {
      console.error('[socket] connect_error', err);
      setConnected(false);
    });
    s.on('disconnect', (reason) => {
      console.log('[socket] disconnected', reason);
      setConnected(false);
    });

    s.on('message', onMessageReceived);

    s.on('error', (e) => {
      console.error('[socket] error', e);
    });

    // Handle user join events
    s.on('user:joined', ({ userId, username }) => {
      const joinMsg: Message = {
        id: 'system_' + Date.now(),
        senderId: 'system',
        text: `${username || 'A new user'} joined the chat`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, joinMsg]);
    });

    // Handle user leave events
    s.on('user:left', ({ userId, username }) => {
      const leaveMsg: Message = {
        id: 'system_' + Date.now(),
        senderId: 'system',
        text: `${username || 'Someone'} left the chat`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, leaveMsg]);
    });

    // Handle typing events
    s.on('user:typing', ({ userId, username }) => {
      setTypingUsers(prev => {
        if (prev.includes(username)) return prev;
        return [...prev, username];
      });
    });

    s.on('user:stop-typing', ({ userId, username }) => {
      setTypingUsers(prev => prev.filter(name => name !== username));
    });

    // Typing indicators
    s.on('user:typing', ({ userId, username }: { userId: string; username: string }) => {
      setTypingUsers(prev => {
        if (prev.includes(username)) return prev;
        return [...prev, username];
      });
    });

    s.on('user:stop-typing', ({ userId, username }: { userId: string; username: string }) => {
      setTypingUsers(prev => prev.filter(u => u !== username));
    });

    // User presence
    s.on('users:online', (users: string[]) => {
      setOnlineUsers(new Set(users));
    });

    s.on('user:joined', (userId: string) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
      const joinMsg: Message = {
        id: 'system_' + Date.now(),
        senderId: 'system',
        text: `${userId} joined the chat`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, joinMsg]);
    });

    s.on('user:left', (userId: string) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      const leftMsg: Message = {
        id: 'system_' + Date.now(),
        senderId: 'system',
        text: `${userId} left the chat`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, leftMsg]);
    });

    setSocket(s);

    return () => {
      s.off('message', onMessageReceived);
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [onMessageReceived]);

  return (
    <SocketContext.Provider 
      value={{ 
        sendMessage, 
        messages, 
        currentUserId, 
        connected,
        setTyping,
        typingUsers,
        onlineUsers
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};