const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add TFLite model files as assets so they can be bundled with the app
config.resolver.assetExts.push('tflite');

module.exports = config;
