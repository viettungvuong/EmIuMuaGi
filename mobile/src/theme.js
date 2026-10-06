// The web frontend's CSS variables (frontend/src/index.css), so both apps look alike
export const colors = {
  bg: '#fff1f2', // soft pink page background
  surface: '#ffffff',
  surface2: '#ffe4e6',
  border: 'rgba(236, 72, 153, 0.15)',
  accent: '#ec4899',
  accent2: '#f472b6',
  danger: '#ff4d6d',
  text: '#331c26',
  textMuted: '#886e7a',
  success: '#10b981',
  // The Add / Question pages: a dark card on a plain pink page
  pinkPage: '#ffc0cb',
  darkCard: 'rgba(21, 25, 41, 0.85)',
  // The session check screen
  splash: '#0d0f1a',
};

export const radius = { lg: 16, sm: 10 };

// Inter, loaded in app/_layout.js. React Native picks a weight by font file, not fontWeight.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

// Same wording and time zone as the web app's dates
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  try {
    return date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toLocaleString(); // an Intl build without time zone data
  }
}
