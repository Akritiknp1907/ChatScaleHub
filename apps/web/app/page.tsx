'use client';
import React, { useEffect, useRef, useState } from 'react';
import classes from './page.module.css';
import { useSocket, Message } from '../context/SocketProvider';

// Generate a consistent color from a string (username/id)
function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 45%)`; // Consistent color with good contrast
}

export default function Page() {
  const { sendMessage, messages = [], currentUserId, connected, setTyping, typingUsers, onlineUsers } = useSocket();
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(true);

  // Check for username on mount
  useEffect(() => {
    const savedName = localStorage.getItem('chat_user_name');
    if (savedName) {
      setUsername(savedName);
      setShowNamePrompt(false);
    } else {
      setShowNamePrompt(true);
    }
  }, []);
  const listRef = useRef<HTMLUListElement | null>(null);
  const lastMessageRef = useRef<HTMLLIElement | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (typeof window !== 'undefined' && (localStorage.getItem('theme') as any)) || 'light');

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    if (!connected) {
      console.warn('Cannot send message: socket is not connected');
      return;
    }
    if (!username && !localStorage.getItem('chat_user_name')) {
      setShowNamePrompt(true);
      return;
    }
    sendMessage(message.trim());
    setMessage('');
  };

  const formatTime = (iso?: string) => {
    if (!iso) return 'Now';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Now';
    }
  };

  useEffect(() => {
    console.log('currentUserId:', currentUserId);
  }, [currentUserId]);

  // Handle username submission
  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = username.trim();
    if (trimmedName) {
      localStorage.setItem('chat_user_name', trimmedName);
      setUsername(trimmedName);
      setShowNamePrompt(false);
      
      // Force socket to reconnect with new username
      window.location.reload();
    }
  };

  return (
    <div className={classes.chatWrapper}>
      {showNamePrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <form
            onSubmit={handleSetUsername}
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 style={{ margin: 0, color: '#0b1220' }}>Welcome to ChatScaleHub!</h2>
            <p style={{ margin: 0, color: '#6b7280' }}>Choose a display name to start chatting</p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '16px',
              }}
              autoFocus
            />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(180deg, #4b9cff, #2e6fd6)',
                color: 'white',
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Join Chat
            </button>
          </form>
        </div>
      )}

      <header className={classes.header}>
        <div className={classes.headerLeft}>
          <div className={classes.logo}>ChatScaleHub</div>
          <div className={classes.subtitle}>Group Chat</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* show user name when available */}
          <div
            style={{
              fontSize: 13,
              padding: '6px 12px',
              borderRadius: 999,
              background: stringToColor(username || currentUserId),
              color: '#ffffff',
              fontWeight: 500
            }}
          >
            {username || 'Anonymous'}
          </div>

          {/* connection status badge */}
          <div
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: connected ? 'linear-gradient(90deg,#dff7e1,#bff0c0)' : 'linear-gradient(90deg,#ffe6e6,#ffd6d6)',
              color: connected ? '#044d18' : '#5b1212',
              border: '1px solid rgba(0,0,0,0.04)'
            }}
            title={connected ? 'Connected to server' : 'Disconnected'}
            aria-live="polite"
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: connected ? '#16a34a' : '#ef4444',
                display: 'inline-block',
              }}
            />
            {connected ? 'Connected' : 'Offline'}
          </div>

          <div className={classes.headerRight}>
            <button
              className={classes.themeBtn}
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      <main className={classes.chatMain}>
        <ul ref={listRef} className={classes.messagesList} aria-live="polite">
          {messages.length === 0 && <li className={classes.empty}>No messages yet — say hi 👋</li>}

          {messages.map((m: Message, i: number) => {
            const isSent = m.senderId === currentUserId;
            const isSystem = m.senderId === 'system';
            const showName = !isSent && !isSystem && (i === 0 || messages[i - 1]?.senderId !== m.senderId);
            const isLast = i === messages.length - 1;

            return (
              <li
                key={m.id}
                ref={isLast ? lastMessageRef : undefined}
                className={`${classes.messageItem} ${isSystem ? classes.system : isSent ? classes.sent : classes.recv}`}
                data-type={isSystem ? 'system' : 'message'}
              >
                {!isSent && (
                  <div 
                    className={classes.avatar}
                    style={{ 
                      background: stringToColor(m.senderId),
                      color: '#fff',
                      fontWeight: 'bold'
                    }}
                  >
                    {m.senderName ? m.senderName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}

                <div className={classes.msgBubble} style={!isSent ? {
                  borderLeft: `3px solid ${stringToColor(m.senderId)}`
                } : undefined}>
                  {showName && !isSent && (
                    <div className={classes.senderName} style={{ color: stringToColor(m.senderId) }}>
                      {m.senderName || 'Unknown User'}
                    </div>
                  )}
                  <div className={classes.msgText}>{m.text}</div>
                  <div className={classes.msgMeta}>
                    <span className={classes.msgTime}>{formatTime(m.createdAt)}</span>
                    {isSent && <span className={classes.msgStatus}>✔✔</span>}
                  </div>
                </div>

                {isSent && (
                  <div 
                    className={classes.avatarRight}
                    style={{ 
                      background: 'linear-gradient(180deg,var(--accent-from), var(--accent-to))',
                      color: '#fff',
                      fontWeight: 'bold'
                    }}
                  >
                    You
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className={classes.typingIndicator}>
          {typingUsers.length > 0 && (
            <div className={classes.typingText}>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
        </div>

        <div className={classes.onlineUsers}>
          {onlineUsers.size > 0 && (
            <div className={classes.onlineCount}>
              {onlineUsers.size} user{onlineUsers.size !== 1 ? 's' : ''} online
            </div>
          )}
        </div>

        <div className={classes.inputBar}>
          <input
            autoFocus
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setTyping(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSend();
                setTyping(false);
              }
            }}
            onBlur={() => setTyping(false)}
            className={classes.chatInput}
            placeholder={connected ? 'Type your message here...' : 'Disconnected — reconnecting...'}
            aria-label="Message"
            disabled={!connected}
          />
          <button 
            onClick={() => {
              handleSend();
              setTyping(false);
            }} 
            className={classes.sendBtn} 
            aria-label="Send" 
            disabled={!connected} 
            aria-disabled={!connected}
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}