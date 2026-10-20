// UI text and server messages in the user's language, from locales/<lang>.json
// at the repo root (the mobile app reads the same files)
import { createElement, Fragment, useSyncExternalStore } from 'react';
import en from '../../locales/en.json';
import vi from '../../locales/vi.json';

const DICTIONARIES = { vi, en };
const DEFAULT_LANGUAGE = 'vi';

// The Settings choices; each name is written in its own language
export const LANGUAGES = [
  { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
];

function savedLanguage() {
  try {
    const lang = localStorage.getItem('lang');
    return DICTIONARIES[lang] ? lang : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE; // storage blocked
  }
}

let language = savedLanguage();
document.documentElement.lang = language;

export const getLanguage = () => language;

// For toLocaleString on dates
export const dateLocale = () => (language === 'en' ? 'en-US' : 'vi-VN');

const listeners = new Set();

// Saves the choice in localStorage and redraws whatever calls useLanguage();
// pages opened later read the new language anyway
export function setLanguage(lang) {
  if (!DICTIONARIES[lang] || lang === language) return;
  try {
    localStorage.setItem('lang', lang);
  } catch {
    // storage blocked: the choice lasts until the page is reloaded
  }
  language = lang;
  document.documentElement.lang = lang;
  listeners.forEach((listener) => listener());
}

// The current language; the calling component redraws when it changes
export function useLanguage() {
  return useSyncExternalStore((onChange) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, getLanguage);
}

const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);

// t('auth.verifySubtitle', { email }) fills in {email}. Text values give back a
// string; a React element (e.g. <strong>) gives back parts to render as children.
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
