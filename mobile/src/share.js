// Links shared into the app from another app's Share menu (expo-sharing, set up
// in app.json). app/+native-intent.js reads one as the app opens and sends it to
// the Add screen; if nobody is logged in yet it waits here, and the list screen
// passes it on once they are.
import { clearSharedPayloads, getSharedPayloads } from 'expo-sharing';

// Apps often share a sentence around the link: "Xem nè https://vt.tiktok.com/…"
const LINK_RE = /https?:\/\/[^\s<>"']+/i;

let pendingLink = null;

// The first link in what was just shared, kept for the Add screen. The share
// itself is cleared, so opening the app normally later doesn't bring it back.
export function receiveSharedLink() {
  let link = null;
  for (const payload of getSharedPayloads()) {
    const match = payload.value?.match(LINK_RE);
    if (match) {
      link = match[0].replace(/[.,;:!?]+$/, ''); // a sentence's full stop isn't part of it
      break;
    }
  }
  clearSharedPayloads();
  pendingLink = link;
  return link;
}

// The link still waiting for the Add screen, if any; taking it clears it
export function takeSharedLink() {
  const link = pendingLink;
  pendingLink = null;
  return link;
}
