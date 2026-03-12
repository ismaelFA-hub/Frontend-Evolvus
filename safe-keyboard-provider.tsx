/**
 * Safe wrapper for react-native-keyboard-controller.
 * Falls back to a passthrough component in Expo Go (where the native module
 * is not bundled), preventing a crash on app startup.
 */
import React from "react";

// Lazily require so that a missing native module doesn't crash at import time.
let _KeyboardProvider: React.ComponentType<{ children: React.ReactNode }> | null;
try {
  _KeyboardProvider =
    require("react-native-keyboard-controller").KeyboardProvider;
} catch {
  _KeyboardProvider = null;
}

export const SafeKeyboardProvider: React.ComponentType<{
  children: React.ReactNode;
}> =
  _KeyboardProvider ??
  function KeyboardProviderFallback({ children }) {
    return <>{children}</>;
  };
