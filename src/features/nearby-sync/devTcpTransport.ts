import type { Link, Msg } from './engine';
import {
  PeerRejectedError,
  type NearbyTransport,
  type Peer,
  type TransportEvent,
} from './session';

// DEV-ONLY stand-in for Nearby Connections, so the whole sync flow can be exercised between an emulator
// and a real phone (an emulator has no Bluetooth/BLE and its Wi-Fi is NAT-ed, so Nearby cannot cross).
// Both phones listen on a TCP port and also dial the candidate addresses; `adb forward` / `adb reverse`
// (scripts/dev-sync-link.sh) join the two. There is NO authentication here: the "verification code" is
// derived from the two ids, so it only exercises the UI. Never ship this as the real transport.

type Sock = {
  write(data: string): unknown;
  destroy(): void;
  setEncoding?(encoding: string): unknown;
  on(event: string, fn: (...args: any[]) => void): unknown;
};
type Srv = {
  listen(o: { port: number; host: string }, cb?: () => void): unknown;
  close(): unknown;
  on(event: string, fn: (...args: any[]) => void): unknown;
};

/** The subset shared by react-native-tcp-socket and Node's `net`. */
export type TcpLib = {
  createServer(listener: (s: Sock) => void): Srv;
  createConnection(o: { host: string; port: number }, cb: () => void): Sock;
};

export type DevTcpConfig = {
  tcp: TcpLib;
  name: string;
  listenPort: number;
  dial: { host: string; port: number }[];
  retryMs?: number;
};

type Frame =
  | { t: 'hi'; id: string; name: string }
  | { t: 'connect' }
  | { t: 'accept' }
  | { t: 'reject' }
  | { t: 'bye' }
  | { t: 'm'; m: Msg };

/** Same code on both phones. Dev only: it proves nothing about who is on the other end. */
/* eslint-disable no-bitwise */
export function deriveCode(a: string, b: string) {
  let h = 2166136261;
  for (const c of [a, b].sort().join('|'))
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return String((h >>> 0) % 1000000).padStart(6, '0');
}
/* eslint-enable no-bitwise */

/** Newline-delimited JSON frames over a byte stream that may split or merge writes. */
export function lineSplitter(onFrame: (f: Frame) => void) {
  let buf = '';
  return (chunk: string) => {
    buf += chunk;
    let i = buf.indexOf('\n');
    while (i >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      i = buf.indexOf('\n');
      if (!line) continue;
      try {
        onFrame(JSON.parse(line));
      } catch {
        // a corrupt line is dropped; the protocol above fails on the missing message
      }
    }
  };
}

export function createDevTcpTransport(
  cfg: DevTcpConfig,
): NearbyTransport & { dev: true } {
  const retryMs = cfg.retryMs ?? 1500;
  let myId = '';
  let server: Srv | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let conn: Sock | null = null;
  let peer: Peer | null = null;
  let emit: (e: TransportEvent) => void = () => {};
  let peerAccepted = false;
  let closed = true;
  const dialing = new Set<string>();

  const inbox: Msg[] = [];
  let waiter: { ok: (m: Msg) => void; fail: (e: Error) => void } | null = null;
  let linkError: Error | null = null;
  let acceptWaiter: { ok: () => void; fail: (e: Error) => void } | null = null;

  const send = (f: Frame) => {
    conn?.write(JSON.stringify(f) + '\n');
  };

  const failLink = (e: Error) => {
    linkError ??= e;
    waiter?.fail(e);
    waiter = null;
    acceptWaiter?.fail(e);
    acceptWaiter = null;
  };

  // Both phones may dial each other at once. Each side keeps the socket opened by the phone with the
  // smaller id, so they always end up on the same one. A socket in the other direction is only adopted
  // after a grace period without a preferred one (the adb setup opens a single direction, either way).
  const GRACE_MS = 500;
  const deferred = new Set<ReturnType<typeof setTimeout>>();

  function pair(sock: Sock, p: Peer) {
    conn = sock;
    peer = p;
    if (timer) clearInterval(timer);
    timer = null;
    emit({ type: 'peers', peers: [p] });
  }

  function onFrame(sock: Sock, f: Frame, outgoing: boolean) {
    if (f.t === 'hi') {
      if (f.id === myId) {
        sock.destroy(); // dialled ourselves
        return;
      }
      const p = { id: f.id, name: f.name };
      const preferred = (outgoing ? myId : f.id) === [myId, f.id].sort()[0];
      if (preferred) {
        if (conn) sock.destroy(); // already paired on a preferred socket
        else pair(sock, p);
      } else if (!conn) {
        const t = setTimeout(() => {
          deferred.delete(t);
          if (!closed && !conn) pair(sock, p);
          else if (sock !== conn) sock.destroy();
        }, GRACE_MS);
        deferred.add(t);
      } else {
        sock.destroy();
      }
      return;
    }
    if (sock !== conn) return;
    if (f.t === 'connect' && peer) {
      emit({ type: 'code', peer, code: deriveCode(myId, peer.id) });
    } else if (f.t === 'accept') {
      peerAccepted = true;
      acceptWaiter?.ok();
      acceptWaiter = null;
    } else if (f.t === 'reject') {
      failLink(new PeerRejectedError());
    } else if (f.t === 'bye') {
      failLink(new Error('Peer left'));
    } else if (f.t === 'm') {
      if (waiter) {
        waiter.ok(f.m);
        waiter = null;
      } else inbox.push(f.m);
    }
  }

  function adopt(sock: Sock, outgoing: boolean) {
    sock.setEncoding?.('utf8');
    const feed = lineSplitter(f => onFrame(sock, f, outgoing));
    sock.on('data', (d: unknown) => feed(String(d)));
    const gone = () => {
      if (sock !== conn || closed) return;
      failLink(new Error('Connection lost'));
      emit({ type: 'lost' });
    };
    sock.on('error', gone);
    sock.on('close', gone);
    sock.write(JSON.stringify({ t: 'hi', id: myId, name: cfg.name }) + '\n');
  }

  function dialAll() {
    if (conn || closed) return;
    for (const { host, port } of cfg.dial) {
      const key = `${host}:${port}`;
      if (dialing.has(key)) continue;
      dialing.add(key);
      const s: Sock = cfg.tcp.createConnection({ host, port }, () =>
        adopt(s, true),
      );
      const done = () => dialing.delete(key);
      s.on('error', done);
      s.on('close', done);
    }
  }

  /** `lingerMs` lets frames already written (our last changes message) leave before the socket dies. */
  function reset(lingerMs = 0) {
    closed = true;
    if (timer) clearInterval(timer);
    timer = null;
    const old = conn;
    conn = null;
    if (old) {
      if (lingerMs) setTimeout(() => old.destroy(), lingerMs);
      else old.destroy();
    }
    peer = null;
    peerAccepted = false;
    deferred.forEach(clearTimeout);
    deferred.clear();
    inbox.length = 0;
    waiter = null;
    acceptWaiter = null;
    linkError = null;
    dialing.clear();
    server?.close();
    server = null;
  }

  return {
    dev: true,

    start(on) {
      reset();
      closed = false;
      emit = on;
      myId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      return new Promise<void>((resolve, reject) => {
        const srv = cfg.tcp.createServer(s => adopt(s, false));
        srv.on('error', (e: Error) => {
          console.warn('[dev-tcp] listen failed:', e?.message ?? e); // dev-only transport, no user data
          reject(e);
        });
        srv.listen({ port: cfg.listenPort, host: '0.0.0.0' }, () => {
          server = srv;
          timer = setInterval(dialAll, retryMs);
          dialAll();
          resolve();
        });
      });
    },

    async connect(peerId) {
      if (!conn || !peer || peer.id !== peerId) throw new Error('No such peer');
      send({ t: 'connect' });
      emit({ type: 'code', peer, code: deriveCode(myId, peer.id) });
    },

    accept() {
      send({ t: 'accept' });
      const link: Link = {
        send: async m => {
          if (linkError) throw linkError;
          send({ t: 'm', m });
        },
        receive: () => {
          const m = inbox.shift();
          if (m) return Promise.resolve(m);
          if (linkError) return Promise.reject(linkError);
          return new Promise<Msg>((ok, fail) => {
            waiter = { ok, fail };
          });
        },
      };
      if (peerAccepted) return Promise.resolve(link);
      if (linkError) return Promise.reject(linkError);
      return new Promise<Link>((ok, fail) => {
        acceptWaiter = { ok: () => ok(link), fail };
      });
    },

    async disconnect() {
      if (conn) send({ t: peerAccepted ? 'bye' : 'reject' });
      reset(peerAccepted ? 400 : 0);
    },
  };
}
