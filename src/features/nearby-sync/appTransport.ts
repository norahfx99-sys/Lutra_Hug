import { NativeModules, Platform } from 'react-native';
import { createDevTcpTransport, type TcpLib } from './devTcpTransport';
import { unavailableTransport, type NearbyTransport } from './session';

// Which transport the app uses. The real Nearby module is not built yet, so a release build reports
// "unavailable". A debug build whose native TCP module is linked uses the dev TCP transport, which
// scripts/dev-sync-link.sh joins to a second device over adb.

const LISTEN_PORT = 7766;
// 7767 = device side of `adb reverse` (7766 itself is taken by our own listener);
// 10.0.2.2 = the host as seen from an emulator.
const DIAL = [
  { host: '127.0.0.1', port: 7767 },
  { host: '10.0.2.2', port: LISTEN_PORT },
];

function build(): NearbyTransport {
  if (__DEV__ && NativeModules.TcpSockets) {
    // Required lazily: the module must not load in builds or tests where it is not linked.
    const mod = require('react-native-tcp-socket');
    const tcp = (mod.default ?? mod) as TcpLib; // CJS or ESM shape, depending on the bundler
    return createDevTcpTransport({
      tcp,
      name: String(
        (Platform.constants as { Model?: string }).Model ?? Platform.OS,
      ),
      listenPort: LISTEN_PORT,
      dial: DIAL,
    });
  }
  return unavailableTransport;
}

export const appTransport = build();
