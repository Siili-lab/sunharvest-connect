/**
 * Grade Result Component Stub
 *
 * Displays the grading result overlay on the camera screen.
 * TODO: Build out full UI when camera flow is implemented.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { QualityGrade } from '../types';

interface GradeResultProps {
  grade: QualityGrade;
  confidence: number;
}

export function GradeResult({ grade, confidence }: GradeResultProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.grade}>{grade}</Text>
      <Text style={styles.confidence}>{Math.round(confidence * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    alignItems: 'center',
  },
  grade: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  confidence: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
});
