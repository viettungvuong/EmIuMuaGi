// UI text and server messages in the user's language, from locales/<lang>.json
// at the repo root (the web app reads the same files). The web's
// frontend/src/i18n.js, with the choice kept in AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, Fragment, useContext } from 'react';
import en from '../../locales/en.json';
import vi from '../../locales/vi.json';

const DICTIONARIES = { vi, en };
const DEFAULT_LANGUAGE = 'vi';

// The Settings choices; each name is written in its own language
export const LANGUAGES = [
  { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
];

// The language the screens draw in. app/_layout.js holds it and Settings changes
// it; a screen that calls useLanguage() redraws when it changes.
export const LanguageContext = createContext({ language: DEFAULT_LANGUAGE, changeLanguage: async () => {} });
export const useLanguage = () => useContext(LanguageContext);

let language = DEFAULT_LANGUAGE;

// Called once on launch (app/_layout.js) before any screen draws
export async function loadLanguage() {
  try {
    const saved = await AsyncStorage.getItem('lang');
    if (DICTIONARIES[saved]) language = saved;
  } catch {
    // keep the default
  }
}

export const getLanguage = () => language;

// For toLocaleString on dates
export const dateLocale = () => (language === 'en' ? 'en-US' : 'vi-VN');

// Screens show the new language the next time they draw
export async function setLanguage(lang) {
  if (!DICTIONARIES[lang]) return;
  language = lang;
  await AsyncStorage.setItem('lang', lang);
}

const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);

// t('auth.verifySubtitle', { email }) fills in {email}. Text values give back a
// string; a React element (e.g. a bold <Text>) gives back parts to render inside <Text>.
export function t(key, vars) {
  const template = lookup(DICTIONARIES[language], key) ?? lookup(DICTIONARIES[DEFAULT_LANGUAGE], key) ?? key;
  if (!vars) return template;
  const parts = template.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? (vars[part] ?? `{${part}}`) : part));
  if (parts.every((p) => typeof p === 'string' || typeof p === 'number')) return parts.join('');
  return parts.map((p, i) => createElement(Fragment, { key: i }, p));
}

// A message from the server, e.g. "Invalid or expired OTP", in the user's
// language. "Could not send OTP: <detail>" keeps its detail after the colon.
// Anything not in locales/*.json "server" is shown as the server sent it.
export function serverText(message) {
  if (typeof message !== 'string') return message;
  const messages = DICTIONARIES[language].server;
  if (messages[message]) return messages[message];
  const colon = message.indexOf(': ');
  const head = colon > 0 ? message.slice(0, colon) : null;
  return head && messages[head] ? `${messages[head]}: ${message.slice(colon + 2)}` : message;
}
