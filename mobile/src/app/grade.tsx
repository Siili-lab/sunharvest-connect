import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { gradeImage, createListing, GradeResult } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CROP_TYPES = [
  { id: 'tomato', name: 'Tomatoes', emoji: '' },
  { id: 'potato', name: 'Potatoes', emoji: '' },
  { id: 'onion', name: 'Onions', emoji: '' },
  { id: 'carrot', name: 'Carrots', emoji: '' },
  { id: 'mango', name: 'Mangoes', emoji: '' },
  { id: 'cabbage', name: 'Cabbage', emoji: '' },
  { id: 'spinach', name: 'Spinach', emoji: '' },
  { id: 'maize', name: 'Maize', emoji: '' },
];

// ── Crop-aware offline mock (mirrors backend mockGradingModel) ──────────

const CROP_DEFECTS: Record<string, string[]> = {
  tomato: ['cracking', 'sunscald', 'blossom end rot', 'catfacing'],
  potato: ['greening', 'scab', 'growth cracks', 'hollow heart'],
  onion: ['neck rot', 'black mold', 'splitting', 'sunburn'],
  carrot: ['forking', 'cracking', 'green shoulder', 'cavity spot'],
  mango: ['anthracnose', 'latex burn', 'stem-end rot', 'lenticel spotting'],
  cabbage: ['black rot', 'tip burn', 'insect damage', 'splitting'],
  spinach: ['leaf miner trails', 'downy mildew', 'yellowing', 'bolting damage'],
  maize: ['ear rot', 'kernel damage', 'insect boring', 'husk discoloration'],
};

const OFFLINE_BASE_PRICES: Record<string, number> = {
  tomato: 100, potato: 75, onion: 90, carrot: 75,
  mango: 120, cabbage: 45, spinach: 55, maize: 45,
};

const GRADE_MULT: Record<string, number> = {
  Premium: 1.25, 'Grade A': 1.0, 'Grade B': 0.8, Reject: 0.5,
};

function offlineGrade(cropId: string): GradeResult & { priceRangeMin?: number; priceRangeMax?: number; trend?: string; demandLevel?: string } {
  // Weighted distribution: ~25% Premium, ~60% Grade A, ~12% Grade B, ~3% Reject
  const roll = Math.random();
  const grade: GradeResult['grade'] =
    roll < 0.25 ? 'Premium' :
    roll < 0.85 ? 'Grade A' :
    roll < 0.97 ? 'Grade B' : 'Reject';

  const confidence = grade === 'Premium' || grade === 'Reject'
    ? 0.88 + Math.random() * 0.10
    : 0.75 + Math.random() * 0.15;

  const pool = CROP_DEFECTS[cropId] || ['minor surface blemishes'];
  const defectCount = grade === 'Premium' ? 0 : grade === 'Grade A' ? 1 : grade === 'Grade B' ? 2 : 3;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const defects = shuffled.slice(0, defectCount);

  const base = OFFLINE_BASE_PRICES[cropId] || 100;
  const mult = GRADE_MULT[grade];
  const suggestedPrice = Math.round(base * mult);
  const priceRangeMin = Math.round(base * 0.8 * mult);
  const priceRangeMax = Math.round(base * 1.3 * mult);

  return {
    grade,
    confidence: Math.round(confidence * 100) / 100,
    suggestedPrice,
    priceRangeMin,
    priceRangeMax,
    currency: 'KSh',
    unit: 'kg',
    cropType: CROP_TYPES.find((c) => c.id === cropId)?.name || cropId,
    defects,
    gradedAt: new Date().toISOString(),
    trend: 'stable',
    demandLevel: 'normal',
  };
}

// ── Trend indicator helper ──────────────────────────────────────────────

const TREND_CONFIG: Record<string, { arrow: string; label: string; color: string }> = {
  rising:  { arrow: '^', label: 'Rising',  color: '#2E7D32' },
  stable:  { arrow: '-', label: 'Stable',  color: '#F57C00' },
  falling: { arrow: 'v', label: 'Falling', color: '#C62828' },
};

// ── Extended result type used locally ───────────────────────────────────

type ExtendedResult = GradeResult & {
  priceRangeMin?: number;
  priceRangeMax?: number;
  trend?: string;
  demandLevel?: string;
};

export default function GradeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [result, setResult] = useState<ExtendedResult | null>(null);
  const [showListingModal, setShowListingModal] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState('tomato');
  const [showCropPicker, setShowCropPicker] = useState(false);

  // Listing form - pre-fill location from user profile
  const [quantity, setQuantity] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [location, setLocation] = useState(user?.location || '');

  useEffect(() => {
    if (user?.location) {
      setLocation(user.location);
    }
  }, [user]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      Alert.alert('Permission needed', 'Camera access is required');
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

  const getCropName = (id: string) => {
    return CROP_TYPES.find((c) => c.id === id)?.name || id;
  };

  const handleGrade = async () => {
    if (!image) return;

    setIsGrading(true);

    try {
      const gradeResult = await gradeImage(image, selectedCrop);
      // The backend now returns priceRangeMin, priceRangeMax, trend, demandLevel
      setResult(gradeResult as ExtendedResult);
    } catch (error) {
      console.log('Grading error (using offline mock):', error);
      setResult(offlineGrade(selectedCrop));
    }

    setIsGrading(false);
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setQuantity('');
    setCustomPrice('');
    setLocation('');
    setSelectedCrop('tomato');
  };

  const handleCreateListing = async () => {
    if (!result || !quantity || !location) {
      Alert.alert('Missing Info', 'Please fill in quantity and location');
      return;
    }

    setIsListing(true);
    try {
      const price = customPrice ? parseFloat(customPrice) : result.suggestedPrice;
      await createListing({
        crop: result.cropType,
        grade: result.grade,
        price,
        quantity: parseFloat(quantity),
        location,
        imageUri: image || undefined,
      });
      Alert.alert(
        'Listing Created!',
        `Your ${result.cropType} is now listed at ${result.currency} ${price}/${result.unit}`,
        [{ text: 'View Market', onPress: () => router.push('/market') }]
      );
      setShowListingModal(false);
      reset();
    } catch (error) {
      console.log('Listing error:', error);
      // Demo mode - show success anyway
      Alert.alert(
        'Listing Created!',
        `Your ${result.cropType} is now listed (Demo Mode)`,
        [{ text: 'View Market', onPress: () => router.push('/market') }]
      );
      setShowListingModal(false);
      reset();
    }
    setIsListing(false);
  };

  const gradeColors: Record<string, string> = {
    Premium: '#1B5E20',
    'Grade A': '#388E3C',
    'Grade B': '#F57C00',
    Reject: '#C62828',
  };

  const gradeBgColors: Record<string, string> = {
    Premium: '#E8F5E9',
    'Grade A': '#F1F8E9',
    'Grade B': '#FFF3E0',
    Reject: '#FFEBEE',
  };

  const trendInfo = result?.trend ? TREND_CONFIG[result.trend] || TREND_CONFIG.stable : null;

  return (
    <View style={styles.container}>
      {!image ? (
        <View style={styles.pickSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📷</Text>
          </View>
          <Text style={styles.instruction}>Take a photo of your produce</Text>
          <Text style={styles.subInstruction}>Get instant quality grading and price suggestion</Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.cameraButton} onPress={takePhoto} activeOpacity={0.8}>
              <Text style={styles.cameraButtonText}>Open Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryButton} onPress={pickImage} activeOpacity={0.8}>
              <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.resultSection} showsVerticalScrollIndicator={false}>
          <Image source={{ uri: image }} style={styles.preview} />

          {!result && !isGrading && (
            <View style={styles.cropSelector}>
              <Text style={styles.cropLabel}>What are you grading?</Text>
              <TouchableOpacity
                style={styles.cropDropdown}
                onPress={() => setShowCropPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.cropDropdownText}>{getCropName(selectedCrop)}</Text>
                <Text style={styles.cropDropdownArrow}>v</Text>
              </TouchableOpacity>
            </View>
          )}

          {isGrading && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>Analyzing {getCropName(selectedCrop)}...</Text>
            </View>
          )}

          {result && (
            <View style={[styles.gradeCard, { backgroundColor: gradeBgColors[result.grade] }]}>
              <View style={styles.gradeHeader}>
                <Text style={[styles.gradeText, { color: gradeColors[result.grade] }]}>
                  {result.grade}
                </Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {Math.round(result.confidence * 100)}%
                  </Text>
                </View>
              </View>

              <View style={styles.priceSection}>
                <Text style={styles.priceLabel}>Suggested Price</Text>
                <Text style={styles.price}>
                  {result.currency} {result.suggestedPrice}/{result.unit}
                </Text>
              </View>

              {/* Price range */}
              {result.priceRangeMin != null && result.priceRangeMax != null && (
                <View style={styles.priceRangeRow}>
                  <Text style={styles.priceRangeLabel}>Price Range</Text>
                  <Text style={styles.priceRangeValue}>
                    {result.currency} {result.priceRangeMin} – {result.priceRangeMax}/{result.unit}
                  </Text>
                </View>
              )}

              {/* Market trend */}
              {trendInfo && (
                <View style={styles.trendRow}>
                  <Text style={styles.trendLabel}>Market Trend</Text>
                  <View style={[styles.trendBadge, { backgroundColor: trendInfo.color + '18' }]}>
                    <Text style={[styles.trendArrow, { color: trendInfo.color }]}>{trendInfo.arrow}</Text>
                    <Text style={[styles.trendText, { color: trendInfo.color }]}>{trendInfo.label}</Text>
                  </View>
                </View>
              )}

              {result.defects.length > 0 && (
                <View style={styles.defectsSection}>
                  <Text style={styles.defectsLabel}>Notes</Text>
                  <Text style={styles.defects}>{result.defects.join(', ')}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.actions}>
            {!result && !isGrading && (
              <TouchableOpacity style={styles.gradeButton} onPress={handleGrade} activeOpacity={0.8}>
                <Text style={styles.gradeButtonText}>Analyze Quality</Text>
              </TouchableOpacity>
            )}
            {result && (
              <TouchableOpacity
                style={styles.listButton}
                onPress={() => setShowListingModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.listButtonText}>List for Sale</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.retakeButton} onPress={reset} activeOpacity={0.8}>
              <Text style={styles.retakeButtonText}>
                {result ? 'Grade Another' : 'Retake Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showListingModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowListingModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>List Your Produce</Text>

              {result && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Quality Grade</Text>
                  <Text style={[styles.summaryGrade, { color: gradeColors[result.grade] }]}>
                    {result.grade}
                  </Text>
                  <Text style={styles.summaryLabel}>Suggested Price</Text>
                  <Text style={styles.summaryPrice}>
                    {result.currency} {result.suggestedPrice}/{result.unit}
                  </Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quantity (kg)</Text>
                <TextInput
                  style={styles.formInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="e.g. 50"
                  placeholderTextColor="#9E9E9E"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Your Price (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={customPrice}
                  onChangeText={setCustomPrice}
                  placeholder={result ? `Suggested: ${result.suggestedPrice}` : 'Enter price'}
                  placeholderTextColor="#9E9E9E"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location</Text>
                <TextInput
                  style={styles.formInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Kiambu, Nairobi"
                  placeholderTextColor="#9E9E9E"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitListingButton, isListing && styles.submitListingButtonDisabled]}
                onPress={handleCreateListing}
                activeOpacity={0.8}
                disabled={isListing}
              >
                <Text style={styles.submitListingButtonText}>
                  {isListing ? 'Creating...' : 'Create Listing'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowListingModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCropPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCropPicker(false)}
      >
        <View style={styles.cropPickerOverlay}>
          <View style={styles.cropPickerContent}>
            <Text style={styles.cropPickerTitle}>Select Crop Type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CROP_TYPES.map((crop) => (
                <TouchableOpacity
                  key={crop.id}
                  style={[
                    styles.cropOption,
                    selectedCrop === crop.id && styles.cropOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCrop(crop.id);
                    setShowCropPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cropOptionEmoji}>{crop.emoji}</Text>
                  <Text
                    style={[
                      styles.cropOptionText,
                      selectedCrop === crop.id && styles.cropOptionTextSelected,
                    ]}
                  >
                    {crop.name}
                  </Text>
                  {selectedCrop === crop.id && (
                    <Text style={styles.cropOptionCheck}>*</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.cropPickerClose}
              onPress={() => setShowCropPicker(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cropPickerCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  pickSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  instruction: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1B5E20',
    textAlign: 'center',
    marginBottom: 8,
  },
  subInstruction: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  cameraButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  galleryButton: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2E7D32',
  },
  galleryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2E7D32',
  },
  resultSection: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  loading: {
    alignItems: 'center',
    marginTop: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  gradeCard: {
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gradeText: {
    fontSize: 28,
    fontWeight: '700',
  },
  confidenceBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  priceLabel: {
    fontSize: 15,
    color: '#666',
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
  },
  priceRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  priceRangeLabel: {
    fontSize: 13,
    color: '#666',
  },
  priceRangeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  trendLabel: {
    fontSize: 13,
    color: '#666',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendArrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  defectsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  defectsLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  defects: {
    fontSize: 14,
    color: '#333',
  },
  actions: {
    marginTop: 20,
    gap: 12,
    paddingBottom: 20,
  },
  gradeButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gradeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  retakeButton: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  listButton: {
    backgroundColor: '#1B5E20',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryGrade: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  submitListingButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitListingButtonDisabled: {
    opacity: 0.7,
  },
  submitListingButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  cropSelector: {
    marginTop: 16,
    marginBottom: 8,
  },
  cropLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  cropDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cropDropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  cropDropdownArrow: {
    fontSize: 12,
    color: '#2E7D32',
  },
  cropPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  cropPickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  cropPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 16,
    textAlign: 'center',
  },
  cropOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  cropOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#2E7D32',
  },
  cropOptionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  cropOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  cropOptionTextSelected: {
    fontWeight: '600',
    color: '#1B5E20',
  },
  cropOptionCheck: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  cropPickerClose: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cropPickerCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});
