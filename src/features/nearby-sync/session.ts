import { useEffect, useRef, useState } from 'react';
import { getDb, type Sql } from '../care-cost/db';
import {
  DeviceLimitError,
  FamilyMismatchError,
  listConflicts,
  NoFamilyError,
  runSync,
  type Link,
  type Msg,
} from './engine';

// One manual sync session: idle -> searching -> verifying -> transferring -> done | error.
// Everything radio-related sits behind NearbyTransport so the flow is testable without hardware.
//
// Permissions (Bluetooth / Nearby / local network) are requested INSIDE transport.start(), i.e. only
// after the user pressed a button on SYNC_DEVICES, never at app launch. A denial surfaces as
// NearbyPermissionError. The native module is not built yet: see unavailableTransport.

export type Peer = { id: string; name: string };

export type TransportEvent =
  | { type: 'peers'; peers: Peer[] }
  // Both phones get this once a connection is initiated, whichever side called connect().
  | { type: 'code'; peer: Peer; code: string }
  | { type: 'lost' };

export interface NearbyTransport {
  /** Set by the development TCP transport so the screen can say it is not Nearby. */
  dev?: true;
  /** Advertise + discover. Resolves once the radio is up. Throws NearbyUnavailableError / NearbyPermissionError. */
  start(on: (e: TransportEvent) => void): Promise<void>;
  /** Asks `peerId` to connect; the verification code then arrives as a 'code' event. */
  connect(peerId: string): Promise<void>;
  /**
   * The user confirmed the code on this phone. Resolves with the link once the OTHER phone confirmed too;
   * rejects with PeerRejectedError if it did not. After disconnect(), a pending link.receive() must reject.
   */
  accept(): Promise<Link>;
  disconnect(): Promise<void>;
}

export class NearbyUnavailableError extends Error {}
export class NearbyPermissionError extends Error {}
export class PeerRejectedError extends Error {}
/** A transport failure while the link was in use: nothing was applied yet (apply runs after the last receive). */
class LinkError extends Error {}

export const unavailableTransport: NearbyTransport = {
  start: () => Promise.reject(new NearbyUnavailableError()),
  connect: () => Promise.reject(new NearbyUnavailableError()),
  accept: () => Promise.reject(new NearbyUnavailableError()),
  disconnect: () => Promise.resolve(),
};

/** Swap this for the native module's transport once it exists. */
export const defaultTransport: NearbyTransport = unavailableTransport;

export type FailReason =
  | 'unavailable'
  | 'permission'
  | 'mismatch' // this user said the codes differ
  | 'rejected' // the other user said so
  | 'dropped'
  | 'family' // two different families
  | 'limit' // a third phone
  | 'no-family' // neither phone has a family yet
  | 'unknown';

/** hello out, hello in, changes out, changes in: the four messages runSync exchanges. */
export const PROTOCOL_STEPS = 4;

export type Progress = {
  step: number; // messages completed, 0..PROTOCOL_STEPS
  sent: number | null; // changes sent, known once the changes message went out
  received: number | null;
};

export type SyncState =
  | { step: 'idle' }
  | { step: 'searching'; peers: Peer[]; connecting: boolean }
  | { step: 'verifying'; peer: Peer; code: string; waiting: boolean }
  | { step: 'transferring'; progress: Progress }
  | {
      step: 'done';
      applied: number;
      conflictsLeft: number;
      firstPairing: boolean;
    }
  // detail is the raw error message and only set in dev builds, to debug the dev transport on a device.
  | { step: 'error'; reason: FailReason; detail?: string };

const failReason = (e: unknown): FailReason =>
  e instanceof NearbyUnavailableError
    ? 'unavailable'
    : e instanceof NearbyPermissionError
    ? 'permission'
    : e instanceof PeerRejectedError
    ? 'rejected'
    : e instanceof FamilyMismatchError
    ? 'family'
    : e instanceof DeviceLimitError
    ? 'limit'
    : e instanceof NoFamilyError
    ? 'no-family'
    : e instanceof LinkError
    ? 'dropped'
    : 'unknown';

export type Session = {
  start(): Promise<void>;
  connect(peerId: string): Promise<void>;
  /** The user's verdict on the code. false disconnects without moving any data. */
  confirm(match: boolean): Promise<void>;
  /** Searching / verifying -> idle. While transferring it disconnects, so the session fails as 'dropped'. */
  cancel(): Promise<void>;
  /** The screen is gone: stop the radio and stop reporting. */
  dispose(): void;
};

export function createSession(deps: {
  transport: NearbyTransport;
  db: Sql;
  onState: (s: SyncState) => void;
}): Session {
  const { transport, db } = deps;
  let state: SyncState = { step: 'idle' };
  let disposed = false;

  const set = (s: SyncState) => {
    state = s;
    if (!disposed) deps.onState(s);
  };
  const fail = (e: unknown) => {
    transport.disconnect().catch(() => {});
    set({
      step: 'error',
      reason: failReason(e),
      ...(transport.dev ? { detail: String(e) } : {}),
    });
  };

  const onEvent = (e: TransportEvent) => {
    if (e.type === 'peers' && state.step === 'searching')
      set({ ...state, peers: e.peers });
    else if (e.type === 'code' && state.step === 'searching')
      set({ step: 'verifying', peer: e.peer, code: e.code, waiting: false });
    // While transferring, the link's own rejection reports the loss; failing here would race the apply.
    else if (
      e.type === 'lost' &&
      (state.step === 'searching' || state.step === 'verifying')
    )
      fail(new LinkError());
  };

  // Counts what really crossed the link; progress is never estimated.
  function counting(inner: Link): Link {
    const p: Progress = { step: 0, sent: null, received: null };
    const tick = (m: Msg, dir: 'sent' | 'received') => {
      p.step++;
      if (m.t === 'changes') p[dir] = m.changes.length;
      set({ step: 'transferring', progress: { ...p } });
    };
    const wrap = async <T>(f: () => Promise<T>) => {
      try {
        return await f();
      } catch (e) {
        throw new LinkError(String(e));
      }
    };
    return {
      send: async m => {
        await wrap(() => inner.send(m));
        tick(m, 'sent');
      },
      receive: async () => {
        const m = await wrap(() => inner.receive());
        tick(m, 'received');
        return m;
      },
    };
  }

  async function ownName() {
    const r = await db.execute(
      `SELECT display_name AS n FROM device
       WHERE id = (SELECT value FROM meta WHERE key = 'device_id')`,
    );
    return r.rows[0] ? String(r.rows[0].n) : 'Điện thoại thứ hai';
  }

  return {
    async start() {
      if (
        state.step !== 'idle' &&
        state.step !== 'error' &&
        state.step !== 'done'
      )
        return;
      set({ step: 'searching', peers: [], connecting: false });
      try {
        await transport.start(onEvent);
      } catch (e) {
        fail(e);
      }
    },

    async connect(peerId) {
      if (state.step !== 'searching' || state.connecting) return;
      set({ ...state, connecting: true });
      try {
        await transport.connect(peerId);
      } catch (e) {
        fail(e);
      }
    },

    async confirm(match) {
      if (state.step !== 'verifying' || state.waiting) return;
      if (!match) {
        transport.disconnect().catch(() => {}); // nothing was exchanged
        set({ step: 'error', reason: 'mismatch' });
        return;
      }
      set({ ...state, waiting: true });
      try {
        const link = await transport.accept().catch(e => {
          throw e instanceof PeerRejectedError ||
            e instanceof NearbyUnavailableError
            ? e
            : new LinkError();
        });
        const firstPairing =
          (await db.execute('SELECT 1 FROM family LIMIT 1')).rows.length === 0;
        set({
          step: 'transferring',
          progress: { step: 0, sent: null, received: null },
        });
        const { applied } = await runSync(db, counting(link), {
          deviceName: await ownName(),
        });
        await transport.disconnect().catch(() => {});
        set({
          step: 'done',
          applied,
          conflictsLeft: (await listConflicts(db)).length,
          firstPairing,
        });
      } catch (e) {
        fail(e);
      }
    },

    async cancel() {
      if (
        state.step === 'idle' ||
        state.step === 'done' ||
        state.step === 'error'
      )
        return;
      const wasTransferring = state.step === 'transferring';
      await transport.disconnect().catch(() => {});
      if (!wasTransferring) set({ step: 'idle' });
    },

    dispose() {
      disposed = true;
      if (
        state.step !== 'idle' &&
        state.step !== 'done' &&
        state.step !== 'error'
      )
        transport.disconnect().catch(() => {});
    },
  };
}

export function useSyncSession(transport: NearbyTransport = defaultTransport) {
  const [state, setState] = useState<SyncState>({ step: 'idle' });
  const session = useRef<Session | null>(null);
  session.current ??= createSession({
    transport,
    db: getDb(),
    onState: setState,
  });
  useEffect(() => () => session.current?.dispose(), []);
  return { state, session: session.current };
}

export type SyncInfo = {
  hasFamily: boolean;
  /** The other paired phone, or null while this is the only one. */
  peer: { name: string; lastSyncAt: number | null } | null;
  openConflicts: number;
};

/** What the idle screen shows. Last sync time comes from the `device` table, written by runSync. */
export async function readSyncInfo(db: Sql): Promise<SyncInfo> {
  const hasFamily =
    (await db.execute('SELECT 1 FROM family LIMIT 1')).rows.length > 0;
  const peer = (
    await db.execute(
      `SELECT display_name, last_sync_at FROM device
       WHERE id != (SELECT value FROM meta WHERE key = 'device_id') LIMIT 1`,
    )
  ).rows[0];
  return {
    hasFamily,
    peer: peer
      ? {
          name: String(peer.display_name),
          lastSyncAt:
            peer.last_sync_at == null ? null : Number(peer.last_sync_at),
        }
      : null,
    openConflicts: (await listConflicts(db)).length,
  };
}
