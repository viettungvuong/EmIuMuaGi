// Signing in with Google or Facebook on the web: their own scripts give a token,
// which the server checks (/api/auth/oauth) like the app's mobile/src/oauth.js
// does. Each shows once its id is in frontend/.env (see .env.example).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;
const FACEBOOK_API_VERSION = "v23.0";

export const providers = { google: !!GOOGLE_CLIENT_ID, facebook: !!FACEBOOK_APP_ID };

const scripts = {};
function loadScript(src) {
  scripts[src] ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      delete scripts[src];
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
  return scripts[src];
}

// Google draws its own button into `el` (its branding rules); a sign-in on it
// calls onToken with the ID token
export async function renderGoogleButton(el, { language, width, onToken }) {
  await loadScript("https://accounts.google.com/gsi/client");
  window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (response) => onToken(response.credential) });
  window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width, locale: language });
}

// Loaded with the login page, so that the click itself opens Facebook's popup:
// a popup opened after waiting on a download gets blocked
export function prepareFacebook() {
  return loadScript("https://connect.facebook.net/en_US/sdk.js").then(() => {
    if (!window.FB.__emiumuagi) {
      window.FB.init({ appId: FACEBOOK_APP_ID, version: FACEBOOK_API_VERSION, xfbml: false });
      window.FB.__emiumuagi = true;
    }
  });
}

// The access token, or null if the person closed the popup
export async function facebookToken() {
  await prepareFacebook();
  return new Promise((resolve) => {
    window.FB.login((response) => resolve(response.authResponse?.accessToken ?? null), { scope: "public_profile,email" });
  });
}
