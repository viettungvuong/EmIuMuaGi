# EmIuMuaGi mobile

The web frontend (`../frontend`) as an Expo / React Native app: same screens, same look, same API calls.

## Run it

```sh
npm install
npx expo start
```

Scan the QR code with Expo Go (or press `i` / `a` for a simulator). Start the backend first (`cd ../backend && bash start.sh`, which also starts the AI service on port 8004).

### On the iOS simulator

```sh
./simulator-test.sh              # the booted simulator, else the first iPhone
./simulator-test.sh "iPhone 15"  # a specific one
# or: npm run simulator-test
```

It boots the simulator if needed, warns if the backend isn't up, starts Metro on the first free port from 8081 and opens the app in Expo Go (installing Expo Go the first time).

## Which server it talks to

Set by `EXPO_PUBLIC_API_URL` in `.env`, which git ignores: start from `cp .env.example .env`, which points the app at the VPS (`http://103.126.162.123`); partner invite links use the same address. With the value empty, the app uses the gateway on port 8000 of the computer running `npx expo start`, so a phone on the same Wi-Fi reaches it. After changing it, restart with `npx expo start --clear` (the simulator script does this).

Login works through the same `access_token` / `refresh_token` cookies as the web app; React Native stores and resends them itself.

## Layout

| Web (`frontend/src`) | Mobile (`src`) |
| --- | --- |
| `App.jsx` (routes, session check) | `app/_layout.js`, `auth.js` |
| `pages/AuthPage.jsx` | `app/login.js` |
| `pages/MainPage.jsx` | `app/index.js` |
| `pages/AddPage.jsx` | `app/add.js` |
| `pages/HistoryPage.jsx` | `app/history.js` |
| `pages/PartnerPage.jsx` | `app/partner/[inviteID].js` (also opens from `emiumuagi://partner/<id>`) |
| `pages/QuestionPage.jsx` | `app/question.js` |
| `api/client.js` | `api/client.js`, `api/config.js` |
| `index.css` variables | `theme.js` |
