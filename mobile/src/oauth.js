// Signing in with Google, Apple or Facebook: the provider's own sign-in on the
// phone gives a token, which the server checks and answers like a normal login
// (backend user-service, /api/auth/oauth). Google and Facebook only show once
// their ids are set (mobile/.env, see app.config.js); Apple only on iPhones.
// None of them are in Expo Go, so they're loaded only when used.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import client from './api/client';

// GOOGLE_OAUTH_CLIENT_ID in mobile/.env (the Web client's id), passed in by app.config.js
const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

const nativeBuild = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// Which buttons the login screen shows
export const providers = {
  google: nativeBuild && !!GOOGLE_WEB_CLIENT_ID && (Platform.OS !== 'ios' || !!GOOGLE_IOS_CLIENT_ID),
  facebook: nativeBuild && !!FACEBOOK_APP_ID,
  apple: Platform.OS === 'ios',
};

function googleSignin() {
  const google = require('@react-native-google-signin/google-signin');
  // The web client's id makes Google include an ID token, issued for it
  google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
  return google;
}

// Each resolves to { token, name? }, or null when the person backs out
async function googleToken() {
  const { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } = googleSignin();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    return { token: response.data.idToken };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw err;
  }
}

async function appleToken() {
  const AppleAuthentication = require('expo-apple-authentication');
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    // Apple gives the name to the app only, and only the first time: it goes along
    // so the new account's username can come from it
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    return { token: credential.identityToken, name };
  } catch (err) {
    if (err.code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
}

async function facebookToken() {
  const { AccessToken, AuthenticationToken, LoginManager, Settings } = require('react-native-fbsdk-next');
  Settings.initializeSDK();
  const permissions = ['public_profile', 'email'];

  // On iOS, Limited Login: no tracking, and an OpenID token instead of an access token
  if (Platform.OS === 'ios') {
    const result = await LoginManager.logInWithPermissions(permissions, 'limited', Crypto.randomUUID());
    if (result.isCancelled) return null;
    const token = await AuthenticationToken.getAuthenticationTokenIOS();
    return { token: token?.authenticationToken };
  }

  const result = await LoginManager.logInWithPermissions(permissions);
  if (result.isCancelled) return null;
  const token = await AccessToken.getCurrentAccessToken();
  return { token: token?.accessToken };
}

const providerTokens = { google: googleToken, apple: appleToken, facebook: facebookToken };

// Signs in with `provider`: the server's login answer ({ username, created }),
// or null if the person cancelled. Someone without an account yet gets
// { needsUsername, email, suggestion, finish }: finish(username) makes theirs
// with the same sign-in and answers like a login. Throws when something went wrong.
export async function signInWith(provider) {
  const got = await providerTokens[provider]();
  if (!got?.token) return null;
  const body = { provider, token: got.token, name: got.name };
  const { data } = await client.post('/api/auth/oauth', body);
  if (!data.needsUsername) return data;
  return { ...data, finish: async (username) => (await client.post('/api/auth/oauth', { ...body, username })).data };
}

// On logging out, so the next sign-in can pick another Google or Facebook account
export async function signOutProviders() {
  try {
    if (providers.google) await googleSignin().GoogleSignin.signOut();
    if (providers.facebook) require('react-native-fbsdk-next').LoginManager.logOut();
  } catch (err) {
    console.warn('Provider sign-out failed:', err);
  }
}
