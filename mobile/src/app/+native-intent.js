// Expo Router passes every link that opens the app through here first. A share
// from another app's Share menu arrives as emiumuagi://expo-sharing and opens the
// Add screen with the shared link filled in.
import { receiveSharedLink } from '../share';

export function redirectSystemPath({ path }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      const link = receiveSharedLink();
      return link ? `/add?url=${encodeURIComponent(link)}` : '/add';
    }
  } catch {
    // Not a full URL: nothing of ours, leave it as it came
  }
  return path;
}
