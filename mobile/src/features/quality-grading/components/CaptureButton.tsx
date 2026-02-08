/**
 * Capture Button Component Stub
 *
 * Camera capture button for the grading flow.
 * TODO: Build out with animations when camera flow is implemented.
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';

interface CaptureButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function CaptureButton({ onPress, disabled }: CaptureButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.outer}>
      <View style={styles.inner} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
});
