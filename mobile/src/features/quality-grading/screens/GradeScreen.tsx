import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

type GradeResult = {
  grade: 'Premium' | 'Grade A' | 'Grade B' | 'Reject';
  confidence: number;
  suggestedPrice: number;
  defects: string[];
};

export function GradeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera roll permission needed');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!picked.canceled && picked.assets[0]) {
      setImage(picked.assets[0].uri);
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Camera permission needed');
      return;
    }

    const photo = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!photo.canceled && photo.assets[0]) {
      setImage(photo.assets[0].uri);
      setResult(null);
    }
  };

  const gradeImage = async () => {
    if (!image) return;

    setIsGrading(true);

    // Mock grading - will be replaced with TFLite model
    await new Promise((r) => setTimeout(r, 1500));

    const grades: GradeResult['grade'][] = ['Premium', 'Grade A', 'Grade B', 'Reject'];
    const randomGrade = grades[Math.floor(Math.random() * 3)]; // Bias away from reject

    const prices: Record<string, number> = {
      Premium: 120,
      'Grade A': 100,
      'Grade B': 70,
      Reject: 30,
    };

    setResult({
      grade: randomGrade,
      confidence: 0.75 + Math.random() * 0.2,
      suggestedPrice: prices[randomGrade],
      defects: randomGrade === 'Premium' ? [] : ['Minor blemishes'],
    });

    setIsGrading(false);
  };

  const reset = () => {
    setImage(null);
    setResult(null);
  };

  const gradeColors: Record<string, string> = {
    Premium: '#2E7D32',
    'Grade A': '#558B2F',
    'Grade B': '#F9A825',
    Reject: '#C62828',
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Quality Grading</Text>

      {!image ? (
        <View style={styles.pickSection}>
          <Text style={styles.instruction}>Take a photo of your produce</Text>
          <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
            <Text style={styles.cameraButtonText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
            <Text style={styles.galleryButtonText}>🖼️ Gallery</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultSection}>
          <Image source={{ uri: image }} style={styles.preview} />

          {isGrading && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#FFC107" />
              <Text style={styles.loadingText}>Analyzing...</Text>
            </View>
          )}

          {result && (
            <View style={styles.gradeCard}>
              <Text
                style={[styles.gradeText, { color: gradeColors[result.grade] }]}
              >
                {result.grade}
              </Text>
              <Text style={styles.confidence}>
                {Math.round(result.confidence * 100)}% confidence
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Suggested Price</Text>
                <Text style={styles.price}>KSh {result.suggestedPrice}/kg</Text>
              </View>
              {result.defects.length > 0 && (
                <Text style={styles.defects}>
                  Defects: {result.defects.join(', ')}
                </Text>
              )}
            </View>
          )}

          <View style={styles.actions}>
            {!result && !isGrading && (
              <TouchableOpacity style={styles.gradeButton} onPress={gradeImage}>
                <Text style={styles.gradeButtonText}>Grade This</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.retakeButton} onPress={reset}>
              <Text style={styles.retakeButtonText}>
                {result ? 'Grade Another' : 'Retake'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 24,
  },
  pickSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  instruction: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  cameraButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  cameraButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  galleryButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  galleryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  resultSection: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  loading: {
    alignItems: 'center',
    marginTop: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
  gradeCard: {
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
  },
  gradeText: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  confidence: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
  },
  defects: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  gradeButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  gradeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  retakeButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});
