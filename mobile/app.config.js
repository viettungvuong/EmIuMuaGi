// app.json, plus the native setup for signing in with Google, Apple and
// Facebook. Google and Facebook need their ids (mobile/.env, see .env.example);
// without them that provider gets no setup and no button (see src/oauth.js).
/* global __dirname */
const fs = require('fs');
const path = require('path');

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
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (easProjectId) extra.eas = { ...extra.eas, projectId: easProjectId };
  const android = { ...config.android };
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) android.googleServicesFile = './google-services.json';

  return { ...config, extra, android, ios: { ...config.ios, usesAppleSignIn: true }, plugins };
};
