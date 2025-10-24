// apps/server/src/services/socket.ts
import { Server as IOServer } from 'socket.io';
import http from 'http';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

/**
 * SocketService (dual-mode)
 * - USE_REDIS=true -> tries to use Redis + redis-adapter
 * - otherwise -> local-only broadcasting
 *
 * Important TS note:
 *  - pub and sub are declared as `Redis | undefined` so you may assign `undefined`
 *    without TypeScript complaining (exactOptionalPropertyTypes rules).
 */

const USE_REDIS = process.env.USE_REDIS === 'true';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_USERNAME = process.env.REDIS_USERNAME || undefined;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_TLS = process.env.REDIS_TLS === 'true' || false;

type MessageShape = {
  id: string;
  conversationId?: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: string;
};

class SocketService {
  private _io!: IOServer;
  // <-- explicit union allows assigning `undefined` later
  private pub: Redis | undefined;
  private sub: Redis | undefined;

  constructor(server: http.Server) {
    console.log(`Initializing Socket Service (USE_REDIS=${USE_REDIS})...`);

    this._io = new IOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    if (USE_REDIS) {
      const redisOpts: any = {
        host: REDIS_HOST,
        port: REDIS_PORT,
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
        tls: REDIS_TLS ? {} : undefined,
        retryStrategy(times: number) {
          return Math.min(2000 + times * 50, 20000);
        }
      };

      try {
        this.pub = new Redis(redisOpts);
        this.sub = this.pub.duplicate();

        this._io.adapter(createAdapter(this.pub, this.sub));

        this.pub.on('error', (e: Error) => console.error('[redis pub] error', e.message));
        this.sub.on('error', (e: Error) => console.error('[redis sub] error', e.message));

        this.sub
          .subscribe('Messages')
          .catch((err: Error) => console.warn('[redis sub] subscribe error', err.message));

        this.sub.on('message', (channel: string, message: string) => {
          if (channel === 'Messages') {
            try {
              const parsed = JSON.parse(message);
              this._io.emit('message', parsed);
            } catch (err) {
              console.warn('[redis sub] invalid JSON on Messages channel', err);
            }
          }
        });

        console.log('Redis adapter initialized (pub/sub configured).');
      } catch (err) {
        console.warn('Failed to initialize Redis adapter — falling back to local-only.', err);
        // now allowed because pub/sub typed as `Redis | undefined`
        this.pub = undefined;
        this.sub = undefined;
      }
    } else {
      console.log('Running in local-only socket mode (no Redis).');
      this.pub = undefined;
      this.sub = undefined;
    }
  }

  public initListeners() {
    const io = this._io;
    console.log('initializing Socket Listeners ...');

    io.on('connection', (socket) => {
      console.log(`New client connected: ${socket.id}`);

      socket.on('join_room', (p: { roomId: string }) => {
        if (p && p.roomId) {
          socket.join(p.roomId);
          socket.emit('joined_room', { roomId: p.roomId });
        }
      });

      socket.on('leave_room', (p: { roomId: string }) => {
        if (p && p.roomId) {
          socket.leave(p.roomId);
        }
      });

      socket.on('event:message', async (msg: any) => {
        try {
          const messageObject: MessageShape =
            typeof msg === 'string'
              ? {
                  id: 'tmp_' + Date.now().toString(36),
                  senderId: socket.id,
                  text: msg,
                  createdAt: new Date().toISOString()
                }
              : {
                  id: msg.id || 'tmp_' + Date.now().toString(36),
                  conversationId: msg.conversationId,
                  senderId: msg.senderId || socket.id,
                  senderName: msg.senderName,
                  text: msg.text ?? msg.message ?? '',
                  createdAt: msg.createdAt || new Date().toISOString()
                };

          console.log('Received event:message:', messageObject);

          if (messageObject.conversationId) {
            io.to(messageObject.conversationId).emit('message', messageObject);
          } else {
            io.emit('message', messageObject);
          }

          if (this.pub) {
            try {
              await this.pub.publish('Messages', JSON.stringify(messageObject));
            } catch (pubErr) {
              console.warn('[redis pub] publish failed', (pubErr as Error).message);
            }
          }
        } catch (err) {
          console.error('Error handling event:message', err);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected ${socket.id}:`, reason);
      });

      socket.on('error', (err) => {
        console.error('Socket error', err);
      });
    });
  }

  get io() {
    return this._io;
  }

  public async close() {
    try {
      this._io.close();
    } catch {}
    try {
      if (this.pub) await this.pub.disconnect();
      if (this.sub) await this.sub.disconnect();
    } catch {}
  }
}

export default SocketService;
