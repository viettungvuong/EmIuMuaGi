// Expo's default Metro setup, plus ../locales (the UI text, shared with the web
// app), which sits outside this folder
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../locales')];

module.exports = config;
