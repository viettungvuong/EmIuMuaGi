// app.json, plus the native setup for signing in with Google, Apple and
// Facebook. Google and Facebook need their ids (mobile/.env, see .env.example);
// without them that provider gets no setup and no button (see src/oauth.js).
/* global __dirname */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = ({ config }) => {
  const plugins = [...config.plugins, 'expo-apple-authentication'];

  // The iOS client id backwards is the URL scheme Google returns to the app with
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (googleIosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (facebookAppId) {
    plugins.push([
      'react-native-fbsdk-next',
      {
        appID: facebookAppId,
        clientToken: process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN,
        displayName: config.name,
        scheme: `fb${facebookAppId}`,
        // Login only: no ad tracking, so no App Tracking Transparency prompt
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
        iosUserTrackingPermission: false,
      },
    ]);
  }

  // Push notifications (src/notifications.js) go through Expo's push service,
  // which needs the EAS project's id; on Android they also need Firebase's
  // google-services.json, put next to this file
  const extra = { ...config.extra };
  // Google sign-in (src/oauth.js): the Web client's id, which the ID token is
  // issued for. Only the id goes into the app: GOOGLE_OAUTH_CLIENT_SECRET stays
  // out, as anything in the app can be read out of it.
  if (process.env.GOOGLE_OAUTH_CLIENT_ID) extra.googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (easProjectId) extra.eas = { ...extra.eas, projectId: easProjectId };
  const android = { ...config.android };
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) android.googleServicesFile = './google-services.json';

  // Facebook's SDK is built in whether or not Facebook sign-in is set up
  // (autolinking), and its manifest asks for the advertising ID and Android's ad
  // services. The app shows no ads and has Facebook's ad tracking off (above), so
  // they're taken out; left in, Play would want an advertising ID declaration.
  android.blockedPermissions = [
    ...(config.android?.blockedPermissions ?? []),
    'com.google.android.gms.permission.AD_ID',
    'android.permission.ACCESS_ADSERVICES_AD_ID',
    'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
    'android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE',
    'android.permission.ACCESS_ADSERVICES_TOPICS',
  ];

  // "orientation": "portrait" makes Android assume the device needs a portrait
  // screen, so Play hides the app from devices without one (Chromebooks, some
  // tablets and TVs). Declaring it optional keeps them in.
  plugins.push((cfg) =>
    withAndroidManifest(cfg, (mod) => {
      const manifest = mod.modResults.manifest;
      const features = (manifest['uses-feature'] ??= []);
      if (!features.some((f) => f.$['android:name'] === 'android.hardware.screen.portrait')) {
        features.push({ $: { 'android:name': 'android.hardware.screen.portrait', 'android:required': 'false' } });
      }
      return mod;
    }),
  );

  return { ...config, extra, android, ios: { ...config.ios, usesAppleSignIn: true }, plugins };
};
