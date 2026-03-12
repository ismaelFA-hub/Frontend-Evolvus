// template
import React from "react";
import { Platform, ScrollView, ScrollViewProps } from "react-native";

// Lazily require so that a missing native module doesn't crash at import time
// (e.g. when running in Expo Go, which doesn't bundle react-native-keyboard-controller).
let _KeyboardAwareScrollView: React.ComponentType<ScrollViewProps> | null = null;
try {
  _KeyboardAwareScrollView =
    require("react-native-keyboard-controller").KeyboardAwareScrollView;
} catch {
  _KeyboardAwareScrollView = null;
}

type Props = ScrollViewProps & {
  keyboardShouldPersistTaps?: "handled" | "always" | "never";
};

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web" || _KeyboardAwareScrollView === null) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  const KeyboardAwareScrollView = _KeyboardAwareScrollView;
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
