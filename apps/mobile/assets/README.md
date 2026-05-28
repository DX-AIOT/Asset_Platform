# Assets

This directory contains app assets like icons and splash screens.

## Required Assets

The following assets need to be created by a designer:

- `icon.png` - 1024x1024px - App icon
- `splash.png` - 1284x2778px - Splash screen
- `adaptive-icon.png` - 1024x1024px - Android adaptive icon
- `favicon.png` - 48x48px - Web favicon

## Placeholder Assets

Currently using placeholder assets. Replace with actual designs before production.

To generate proper app icons and splash screens, you can use:
- [Expo Assets](https://docs.expo.dev/develop/user-interface/assets/)
- [App Icon Generator](https://www.appicon.co/)

## Usage

Assets are referenced in `app.json`:
- Main icon: Used for iOS and Android app icon
- Splash screen: Shown while app is loading
- Adaptive icon: Android-specific (foreground + background)
- Favicon: Used for web builds
