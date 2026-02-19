import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { gradeImage, createListing, GradeResult } from '../services/api';
import { gradeWithFallback, loadGradingModel, isModelReady } from '../services/onDeviceGrading';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Text } from '../components/primitives/Text';
import { Input } from '../components/primitives/Input';
import { Button } from '../components/primitives/Button';
import { colors, spacing, fontSize, radius } from '@/theme';

const CROP_TYPES = [
  { id: 'tomato', name: 'Tomatoes', emoji: '\u{1F345}' },
  { id: 'potato', name: 'Potatoes', emoji: '\u{1F954}' },
  { id: 'onion', name: 'Onions', emoji: '\u{1F9C5}' },
  { id: 'carrot', name: 'Carrots', emoji: '\u{1F955}' },
  { id: 'mango', name: 'Mangoes', emoji: '\u{1F96D}' },
  { id: 'cabbage', name: 'Cabbage', emoji: '\u{1F96C}' },
  { id: 'spinach', name: 'Spinach', emoji: '\u{1F33F}' },
  { id: 'maize', name: 'Maize', emoji: '\u{1F33D}' },
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

const TREND_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  rising:  { icon: 'trending-up',   label: 'Rising',  color: colors.primary[800] },
  stable:  { icon: 'remove',        label: 'Stable',  color: colors.semantic.warning },
  falling: { icon: 'trending-down', label: 'Falling', color: colors.grade.reject.text },
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
  const { t } = useLanguage();
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

  // Pre-load TFLite model for on-device inference
  useEffect(() => {
    loadGradingModel().then((loaded) => {
      if (loaded) console.log('[Grade] On-device model ready');
    });
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permission_needed'), t('camera_roll_required'));
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
      Alert.alert(t('permission_needed'), t('camera_required'));
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
      // Grading chain: 1) Backend API → 2) On-device TFLite → 3) Offline fallback
      const gradeResult = await gradeWithFallback(image, selectedCrop, gradeImage);
      setResult({
        grade: gradeResult.grade as GradeResult['grade'],
        confidence: gradeResult.confidence,
        suggestedPrice: 0,
        currency: 'KSh',
        unit: 'kg',
        cropType: selectedCrop,
        defects: gradeResult.defects,
        gradedAt: new Date().toISOString(),
      } as ExtendedResult);

      if (gradeResult.source === 'on-device') {
        console.log(`[Grade] On-device inference in ${gradeResult.inferenceTimeMs}ms`);
      } else if (gradeResult.source === 'offline') {
        console.log('[Grade] Used offline fallback');
      }
    } catch (error) {
      console.log('Grading error (using offline fallback):', error);
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
      Alert.alert(t('missing_info'), t('missing_info_message'));
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
        t('listing_created'),
        `${result.cropType} - ${result.currency} ${price}/${result.unit}`,
        [{ text: t('view_market'), onPress: () => router.push('/market') }]
      );
      setShowListingModal(false);
      reset();
    } catch (error) {
      console.log('Listing error:', error);
      Alert.alert(
        t('listing_created'),
        `${result.cropType} (Demo Mode)`,
        [{ text: t('view_market'), onPress: () => router.push('/market') }]
      );
      setShowListingModal(false);
      reset();
    }
    setIsListing(false);
  };

  const gradeColors: Record<string, string> = {
    Premium: colors.primary[900],
    'Grade A': colors.primary[700],
    'Grade B': colors.semantic.warning,
    Reject: colors.grade.reject.text,
  };

  const gradeBgColors: Record<string, string> = {
    Premium: colors.primary[50],
    'Grade A': colors.grade.gradeA.light,
    'Grade B': colors.grade.gradeB.light,
    Reject: colors.semantic.errorLight,
  };

  const trendInfo = result?.trend ? TREND_CONFIG[result.trend] || TREND_CONFIG.stable : null;

  return (
    <View style={styles.container}>
      {!image ? (
        <View style={styles.pickSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{'\u{1F4F7}'}</Text>
          </View>
          <Text style={styles.instruction}>{t('take_photo')}</Text>
          <Text style={styles.subInstruction}>{t('instant_grading_subtitle')}</Text>

          <View style={styles.buttonGroup}>
            <Button variant="primary" onPress={takePhoto} accessibilityLabel={t('open_camera')}>
              {t('open_camera')}
            </Button>
            <Button variant="outline" onPress={pickImage} accessibilityLabel={t('choose_gallery')}>
              {t('choose_gallery')}
            </Button>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.resultSection} showsVerticalScrollIndicator={false}>
          <Image source={{ uri: image }} style={styles.preview} />

          {!result && !isGrading && (
            <View style={styles.cropSelector}>
              <Text style={styles.cropLabel}>{t('what_grading')}</Text>
              <TouchableOpacity
                style={styles.cropDropdown}
                onPress={() => setShowCropPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.cropDropdownText}>{getCropName(selectedCrop)}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.primary[800]} />
              </TouchableOpacity>
            </View>
          )}

          {isGrading && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary[800]} />
              <Text style={styles.loadingText}>{t('analyzing')} {getCropName(selectedCrop)}...</Text>
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
                <Text style={styles.priceLabel}>{t('suggested_price')}</Text>
                <Text style={styles.price}>
                  {result.currency} {result.suggestedPrice}/{result.unit}
                </Text>
              </View>

              {/* Price range */}
              {result.priceRangeMin != null && result.priceRangeMax != null && (
                <View style={styles.priceRangeRow}>
                  <Text style={styles.priceRangeLabel}>{t('price_range')}</Text>
                  <Text style={styles.priceRangeValue}>
                    {result.currency} {result.priceRangeMin} – {result.priceRangeMax}/{result.unit}
                  </Text>
                </View>
              )}

              {/* Market trend */}
              {trendInfo && (
                <View style={styles.trendRow}>
                  <Text style={styles.trendLabel}>{t('market_trend')}</Text>
                  <View style={[styles.trendBadge, { backgroundColor: trendInfo.color + '18' }]}>
                    <Ionicons name={trendInfo.icon as any} size={14} color={trendInfo.color} />
                    <Text style={[styles.trendText, { color: trendInfo.color }]}>{trendInfo.label}</Text>
                  </View>
                </View>
              )}

              {result.defects.length > 0 && (
                <View style={styles.defectsSection}>
                  <Text style={styles.defectsLabel}>{t('notes')}</Text>
                  <Text style={styles.defects}>{result.defects.join(', ')}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.actions}>
            {!result && !isGrading && (
              <Button variant="primary" onPress={handleGrade} accessibilityLabel={t('analyze_quality')}>
                {t('analyze_quality')}
              </Button>
            )}
            {result && (
              <Button variant="primary" onPress={() => setShowListingModal(true)} accessibilityLabel={t('list_for_sale')}>
                {t('list_for_sale')}
              </Button>
            )}
            <Button variant="outline" onPress={reset} accessibilityLabel={result ? t('grade_another') : t('retake_photo')}>
              {result ? t('grade_another') : t('retake_photo')}
            </Button>
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
              <Text style={styles.modalTitle}>{t('list_your_produce')}</Text>

              {result && (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{t('quality_grade')}</Text>
                  <Text style={[styles.summaryGrade, { color: gradeColors[result.grade] }]}>
                    {result.grade}
                  </Text>
                  <Text style={styles.summaryLabel}>{t('suggested_price')}</Text>
                  <Text style={styles.summaryPrice}>
                    {result.currency} {result.suggestedPrice}/{result.unit}
                  </Text>
                </View>
              )}

              <Input
                label={t('quantity_kg')}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="e.g. 50"
                keyboardType="numeric"
                accessibilityLabel={t('quantity_kg')}
              />

              <Input
                label={t('your_price_optional')}
                value={customPrice}
                onChangeText={setCustomPrice}
                placeholder={result ? `${t('suggested_price')}: ${result.suggestedPrice}` : t('price')}
                keyboardType="numeric"
                accessibilityLabel={t('your_price_optional')}
              />

              <Input
                label={t('location')}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Kiambu, Nairobi"
                accessibilityLabel={t('location')}
              />

              <Button
                variant="primary"
                onPress={handleCreateListing}
                loading={isListing}
                disabled={isListing}
                accessibilityLabel={t('create_listing')}
                style={{ marginTop: spacing[2] }}
              >
                {isListing ? t('creating') : t('create_listing')}
              </Button>

              <Button
                variant="ghost"
                onPress={() => setShowListingModal(false)}
                accessibilityLabel={t('cancel')}
              >
                {t('cancel')}
              </Button>
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
            <Text style={styles.cropPickerTitle}>{t('select_crop_type')}</Text>
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
                    <Ionicons name="checkmark" size={20} color={colors.primary[800]} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button variant="ghost" onPress={() => setShowCropPicker(false)} accessibilityLabel={t('cancel')}>
              {t('cancel')}
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
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
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
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
    color: colors.primary[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  subInstruction: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  cameraButton: {
    backgroundColor: colors.primary[800],
    paddingVertical: 18,
    borderRadius: radius.xl,
    alignItems: 'center',
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  galleryButton: {
    backgroundColor: colors.background.primary,
    paddingVertical: 18,
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary[800],
  },
  galleryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary[800],
  },
  resultSection: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: 280,
    borderRadius: radius.xl,
    backgroundColor: colors.border.light,
  },
  loading: {
    alignItems: 'center',
    marginTop: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text.secondary,
  },
  gradeCard: {
    padding: 20,
    borderRadius: radius.xl,
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
    backgroundColor: colors.overlay.scrim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xl,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.overlay.scrim,
  },
  priceLabel: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary[900],
  },
  priceRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  priceRangeLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  priceRangeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  trendLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
    gap: 4,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  defectsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.overlay.scrim,
  },
  defectsLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  defects: {
    fontSize: 14,
    color: colors.text.primary,
  },
  actions: {
    marginTop: 20,
    gap: 12,
    paddingBottom: 20,
  },
  gradeButton: {
    backgroundColor: colors.primary[800],
    paddingVertical: 18,
    borderRadius: radius.xl,
    alignItems: 'center',
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gradeButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  retakeButton: {
    backgroundColor: colors.background.primary,
    paddingVertical: 18,
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  listButton: {
    backgroundColor: colors.primary[900],
    paddingVertical: 18,
    borderRadius: radius.xl,
    alignItems: 'center',
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary[900],
    marginBottom: 20,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
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
    color: colors.text.primary,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  submitListingButton: {
    backgroundColor: colors.primary[800],
    paddingVertical: 18,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary[900],
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
    color: colors.text.inverse,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  cropSelector: {
    marginTop: 16,
    marginBottom: 8,
  },
  cropLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  cropDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1.5,
    borderColor: colors.primary[800],
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cropDropdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[800],
  },
  cropPickerOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  cropPickerContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: 24,
    maxHeight: '70%',
  },
  cropPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary[900],
    marginBottom: 16,
    textAlign: 'center',
  },
  cropOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    marginBottom: 8,
    backgroundColor: colors.background.secondary,
  },
  cropOptionSelected: {
    backgroundColor: colors.primary[50],
    borderWidth: 1.5,
    borderColor: colors.primary[800],
  },
  cropOptionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  cropOptionText: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  cropOptionTextSelected: {
    fontWeight: '600',
    color: colors.primary[900],
  },
  cropPickerClose: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cropPickerCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
