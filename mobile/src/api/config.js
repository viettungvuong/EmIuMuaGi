import Constants from 'expo-constants';

// The web app calls a relative /api behind its own server; a phone needs the
// gateway's full address. Release builds always use the production server.
// In development, set EXPO_PUBLIC_API_URL (see .env.example) for a real server;
// without it, the app uses the gateway (port 8000) on the computer running
// `npx expo start`, so a phone on the same Wi-Fi reaches it.
const PROD_URL = 'https://emiumuagi.online';

function devGateway() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:8000`;
}

const trimSlash = (url) => url.replace(/\/+$/, '');

export const API_URL = __DEV__
  ? trimSlash(process.env.EXPO_PUBLIC_API_URL || devGateway())
  : PROD_URL;

// The link parser's WebSocket lives behind the same gateway
export const WS_URL = API_URL.replace(/^http/, 'ws');

// Invite links are opened by the partner in a browser, so they point at the web
// app. In production it's served from the same origin as the API.
export const WEB_URL = __DEV__
  ? trimSlash(process.env.EXPO_PUBLIC_WEB_URL || API_URL)
  : PROD_URL;
