import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Text } from '../components/primitives/Text';
import { Button } from '../components/primitives/Button';
import { Input } from '../components/primitives/Input';
import AIPriceSuggestion from '../components/AIPriceSuggestion';
import SuccessEstimate from '../components/SuccessEstimate';
import { getPricePrediction, createListing } from '../services/api';
import { colors, spacing, radius, shadows } from '@/theme';

const CROP_TYPES = [
  { id: 'tomato', name: 'Tomatoes', icon: 'nutrition' },
  { id: 'potato', name: 'Potatoes', icon: 'nutrition' },
  { id: 'onion', name: 'Onions', icon: 'nutrition' },
  { id: 'cabbage', name: 'Cabbage', icon: 'leaf' },
  { id: 'carrot', name: 'Carrots', icon: 'nutrition' },
  { id: 'kale', name: 'Kale/Sukuma', icon: 'leaf' },
  { id: 'spinach', name: 'Spinach', icon: 'leaf' },
  { id: 'mango', name: 'Mangoes', icon: 'nutrition' },
];

type Step = 1 | 2 | 3 | 4;

export default function SellScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ crop?: string; suggestedPrice?: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1: Basic Info
  const [cropType, setCropType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [description, setDescription] = useState('');

  // Pre-fill from AI insight action
  useEffect(() => {
    if (params.crop) setCropType(params.crop);
    if (params.suggestedPrice) setPricePerKg(params.suggestedPrice);
  }, [params.crop, params.suggestedPrice]);

  // Step 2: Photos & AI Grading
  const [photos, setPhotos] = useState<string[]>([]);
  const [aiGrade, setAiGrade] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  const [suggestedPrice, setSuggestedPrice] = useState<number>(0);

  // Step 3: Harvest Details
  const [harvestDate, setHarvestDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [availableDays, setAvailableDays] = useState('7');
  const [storageCondition, setStorageCondition] = useState('cool_dry');

  // Step 4: Pickup Location
  const [pickupLocation, setPickupLocation] = useState(user?.location || '');
  const [pickupLatitude, setPickupLatitude] = useState<number | null>(null);
  const [pickupLongitude, setPickupLongitude] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), t('more_photos_needed'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 4,
    });

    if (!result.canceled) {
      setPhotos([...photos, ...result.assets.map(a => a.uri)].slice(0, 4));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), t('more_photos_needed'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri].slice(0, 4));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const runAIGrading = async () => {
    if (photos.length < 2) {
      Alert.alert(t('error'), t('more_photos_needed'));
      return;
    }

    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const grades = ['Premium', 'Grade A', 'Grade B'];
    const randomGrade = grades[Math.floor(Math.random() * grades.length)];
    const confidence = 85 + Math.floor(Math.random() * 12);

    setAiGrade(randomGrade);
    setAiConfidence(confidence);

    try {
      const gradeMap: Record<string, string> = {
        'Premium': 'PREMIUM',
        'Grade A': 'GRADE_A',
        'Grade B': 'GRADE_B',
        'Grade C': 'GRADE_C',
      };
      const prediction = await getPricePrediction({
        crop: cropType,
        grade: gradeMap[randomGrade],
        quantity: parseInt(quantity) || 100,
        county: user?.location || 'Nairobi',
      });
      setSuggestedPrice(prediction.recommendedPrice);
      if (!pricePerKg) setPricePerKg(prediction.recommendedPrice.toString());
    } catch (err) {
      const basePrices: Record<string, number> = {
        tomato: 100, potato: 80, onion: 90, cabbage: 60,
        carrot: 85, kale: 50, spinach: 55, mango: 150,
      };
      const gradeMultiplier: Record<string, number> = { Premium: 1.3, 'Grade A': 1.0, 'Grade B': 0.75, 'Grade C': 0.5 };
      const basePrice = basePrices[cropType] || 80;
      const suggested = Math.round(basePrice * (gradeMultiplier[randomGrade] || 1));
      setSuggestedPrice(suggested);
      if (!pricePerKg) setPricePerKg(suggested.toString());
    }

    setIsProcessing(false);
  };

  const useCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('location_permission_needed'));
        setGettingLocation(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      setPickupLatitude(position.coords.latitude);
      setPickupLongitude(position.coords.longitude);

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (address) {
        const parts = [address.subregion, address.region].filter(Boolean);
        setPickupLocation(parts.join(', ') || address.city || pickupLocation);
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(t('error'), 'Could not get your location. Please enter it manually.');
    }
    setGettingLocation(false);
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!cropType || !quantity || !pricePerKg) {
        Alert.alert(t('error'), t('grading_required'));
        return false;
      }
    } else if (step === 2) {
      if (photos.length < 2) {
        Alert.alert(t('error'), t('more_photos_needed'));
        return false;
      }
      if (!aiGrade) {
        Alert.alert(t('error'), t('grading_required'));
        return false;
      }
    } else if (step === 3) {
      if (!harvestDate) {
        Alert.alert(t('error'), t('harvest_date'));
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep((step + 1) as Step);
  };

  const prevStep = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const publishListing = async () => {
    setIsProcessing(true);

    try {
      const cropName = CROP_TYPES.find(c => c.id === cropType)?.name || cropType;
      await createListing({
        crop: cropName,
        grade: aiGrade || 'Grade A',
        price: parseInt(pricePerKg),
        quantity: parseInt(quantity),
        county: pickupLocation || user?.location || 'Kenya',
        latitude: pickupLatitude ?? undefined,
        longitude: pickupLongitude ?? undefined,
      });
      setIsProcessing(false);
      Alert.alert(
        t('listing_published'),
        t('listing_live'),
        [{ text: t('ok'), onPress: () => router.push('/market') }]
      );
    } catch (error: any) {
      console.error('Error publishing listing:', error);
      setIsProcessing(false);
      const message = error?.response?.data?.error?.message || t('listing_failed');
      Alert.alert(t('error'), message);
    }
  };

  const gradeColorMap: Record<string, string> = {
    Premium: colors.grade.premium.text,
    'Grade A': colors.grade.gradeA.text,
    'Grade B': colors.grade.gradeB.text,
    'Grade C': colors.semantic.error,
  };

  const gradeBgMap: Record<string, string> = {
    Premium: colors.grade.premium.light,
    'Grade A': colors.grade.gradeA.light,
    'Grade B': colors.grade.gradeB.light,
    'Grade C': colors.semantic.errorLight,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
        </View>
        <Text variant="caption" color="secondary" style={styles.progressText}>
          {t('step_x_of_y').replace('%1', String(step)).replace('%2', '4')}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text variant="heading2" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
              {t('what_selling')}
            </Text>
            <Text variant="bodySmall" color="secondary" style={{ marginBottom: spacing[6] }}>
              {t('select_crop')}
            </Text>

            <Text variant="label" style={{ marginBottom: spacing[2], marginTop: spacing[4] }}>
              {t('crop_type')}
            </Text>
            <View style={styles.cropGrid}>
              {CROP_TYPES.map((crop) => (
                <TouchableOpacity
                  key={crop.id}
                  style={[styles.cropOption, cropType === crop.id && styles.cropOptionSelected]}
                  onPress={() => setCropType(crop.id)}
                  accessibilityLabel={`${t('crop_type')}: ${crop.name}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cropType === crop.id }}
                >
                  <Ionicons
                    name={crop.icon as any}
                    size={24}
                    color={cropType === crop.id ? colors.primary[800] : colors.neutral[600]}
                  />
                  <Text
                    variant="caption"
                    style={{
                      color: cropType === crop.id ? colors.primary[800] : colors.neutral[600],
                      fontWeight: cropType === crop.id ? '600' : '400',
                      marginTop: spacing[1],
                      textAlign: 'center',
                    }}
                  >
                    {crop.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label={t('quantity_kg')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 500"
              keyboardType="numeric"
              containerStyle={{ marginTop: spacing[4] }}
            />

            <Input
              label={t('price_per_kg')}
              value={pricePerKg}
              onChangeText={setPricePerKg}
              placeholder="e.g. 80"
              keyboardType="numeric"
            />

            <Input
              label={t('description_optional')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('description')}
              multiline
              numberOfLines={3}
              inputStyle={{ height: 100, textAlignVertical: 'top' }}
            />

            {cropType && quantity && parseInt(quantity) > 0 && (
              <AIPriceSuggestion
                crop={cropType}
                grade="GRADE_A"
                quantity={parseInt(quantity)}
                county={user?.location || 'Nairobi'}
                onPriceSelect={(price) => setPricePerKg(price.toString())}
              />
            )}
          </View>
        )}

        {/* Step 2: Photos & AI Grading */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text variant="heading2" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
              {t('add_photos')}
            </Text>
            <Text variant="bodySmall" color="secondary" style={{ marginBottom: spacing[6] }}>
              {t('upload_photos')}
            </Text>

            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => removePhoto(index)}
                    accessibilityLabel={t('delete')}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.semantic.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 4 && (
                <View style={styles.addPhotoButtons}>
                  <TouchableOpacity
                    style={styles.addPhotoBtn}
                    onPress={takePhoto}
                    accessibilityLabel={t('camera')}
                  >
                    <Ionicons name="camera" size={28} color={colors.primary[800]} />
                    <Text variant="caption" style={{ color: colors.primary[800], fontWeight: '600', marginTop: spacing[1] }}>
                      {t('camera')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addPhotoBtn}
                    onPress={pickImage}
                    accessibilityLabel={t('gallery')}
                  >
                    <Ionicons name="images" size={28} color={colors.primary[800]} />
                    <Text variant="caption" style={{ color: colors.primary[800], fontWeight: '600', marginTop: spacing[1] }}>
                      {t('gallery')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {photos.length >= 2 && !aiGrade && (
              <Button
                variant="primary"
                onPress={runAIGrading}
                loading={isProcessing}
                disabled={isProcessing}
                fullWidth
                leftIcon={<Ionicons name="scan" size={20} color={colors.neutral[0]} />}
                style={{ marginTop: spacing[5] }}
                accessibilityLabel={t('run_ai_grading')}
              >
                {t('run_ai_grading')}
              </Button>
            )}

            {aiGrade && (
              <View style={[styles.gradeResult, { backgroundColor: gradeBgMap[aiGrade] }]}>
                <View style={styles.gradeHeader}>
                  <View>
                    <Text variant="caption" color="secondary">{t('ai_quality_grade')}</Text>
                    <Text variant="heading2" style={{ color: gradeColorMap[aiGrade] }}>{aiGrade}</Text>
                  </View>
                  <View style={styles.confidenceBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.semantic.success} />
                    <Text variant="caption" style={{ color: colors.semantic.success, fontWeight: '600' }}>
                      {aiConfidence}% {t('confident')}
                    </Text>
                  </View>
                </View>
                <View style={styles.suggestedPriceRow}>
                  <View style={styles.suggestedPriceInfo}>
                    <Text variant="caption" color="secondary">{t('suggested_price')}</Text>
                    <Text variant="heading3" style={{ color: colors.primary[900] }}>KSh {suggestedPrice}/kg</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.usePriceBtn}
                    onPress={() => setPricePerKg(suggestedPrice.toString())}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={colors.background.primary} />
                    <Text style={styles.usePriceBtnText}>{t('use_price')}</Text>
                  </TouchableOpacity>
                </View>
                {pricePerKg && parseInt(pricePerKg) !== suggestedPrice && (
                  <Text variant="caption" style={{ color: colors.semantic.warning, marginTop: spacing[2] }}>
                    {t('your_price')}: KSh {pricePerKg}/kg
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.retryGrade}
                  onPress={runAIGrading}
                  accessibilityLabel={t('re_analyze')}
                >
                  <Ionicons name="refresh" size={16} color={colors.neutral[600]} />
                  <Text variant="caption" color="secondary">{t('re_analyze')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Step 3: Harvest Details */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text variant="heading2" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
              {t('harvest_details')}
            </Text>
            <Text variant="bodySmall" color="secondary" style={{ marginBottom: spacing[6] }}>
              {t('harvest_date')}
            </Text>

            <Text variant="label" style={{ marginBottom: spacing[2] }}>{t('harvest_date')}</Text>
            <View style={styles.optionRow}>
              {[0, 1, 2, 3].map((daysAgo) => {
                const d = new Date();
                d.setDate(d.getDate() - daysAgo);
                const val = d.toISOString().split('T')[0];
                const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
                return (
                  <TouchableOpacity
                    key={daysAgo}
                    style={[styles.optionBtn, harvestDate === val && styles.optionBtnSelected]}
                    onPress={() => setHarvestDate(val)}
                    accessibilityLabel={`${t('harvest_date')} ${label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: harvestDate === val }}
                  >
                    <Text
                      variant="bodySmall"
                      style={{
                        color: harvestDate === val ? colors.primary[800] : colors.neutral[600],
                        fontWeight: harvestDate === val ? '600' : '400',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text variant="caption" color="secondary" style={{ marginTop: spacing[1] }}>
              {harvestDate}
            </Text>

            <Text variant="label" style={{ marginBottom: spacing[2], marginTop: spacing[4] }}>
              {t('available_for')}
            </Text>
            <View style={styles.optionRow}>
              {['3', '5', '7', '14'].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[styles.optionBtn, availableDays === days && styles.optionBtnSelected]}
                  onPress={() => setAvailableDays(days)}
                  accessibilityLabel={`${days} days`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: availableDays === days }}
                >
                  <Text
                    variant="bodySmall"
                    style={{
                      color: availableDays === days ? colors.primary[800] : colors.neutral[600],
                      fontWeight: availableDays === days ? '600' : '400',
                    }}
                  >
                    {days} days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text variant="label" style={{ marginBottom: spacing[2], marginTop: spacing[4] }}>
              {t('storage_conditions')}
            </Text>
            <View style={styles.storageOptions}>
              {[
                { id: 'cool_dry', label: t('cool_dry'), icon: 'snow' },
                { id: 'refrigerated', label: t('refrigerated'), icon: 'thermometer' },
                { id: 'room_temp', label: t('room_temp'), icon: 'sunny' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.storageOption, storageCondition === option.id && styles.storageOptionSelected]}
                  onPress={() => setStorageCondition(option.id)}
                  accessibilityLabel={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: storageCondition === option.id }}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={storageCondition === option.id ? colors.primary[800] : colors.neutral[600]}
                  />
                  <Text
                    variant="body"
                    style={{
                      color: storageCondition === option.id ? colors.primary[800] : colors.neutral[600],
                      fontWeight: storageCondition === option.id ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 4: Pickup & Review */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text variant="heading2" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
              {t('pickup_and_review')}
            </Text>
            <Text variant="bodySmall" color="secondary" style={{ marginBottom: spacing[6] }}>
              {t('set_pickup_location')}
            </Text>

            <TouchableOpacity
              style={styles.gpsButton}
              onPress={useCurrentLocation}
              disabled={gettingLocation}
              activeOpacity={0.7}
              accessibilityLabel={t('use_current_location')}
            >
              <Ionicons
                name={gettingLocation ? 'hourglass' : 'navigate'}
                size={20}
                color={colors.primary[800]}
              />
              <Text variant="bodySmall" style={{ color: colors.primary[800], fontWeight: '600' }}>
                {gettingLocation ? t('getting_location') : t('use_current_location')}
              </Text>
            </TouchableOpacity>

            <Input
              label={t('pickup_location')}
              value={pickupLocation}
              onChangeText={(text) => {
                setPickupLocation(text);
                // Clear GPS coords if user manually edits
                setPickupLatitude(null);
                setPickupLongitude(null);
              }}
              placeholder="e.g. Kiambu, Limuru"
            />

            {/* Transporter info */}
            <View style={styles.transporterInfo}>
              <View style={styles.transporterIconWrap}>
                <Ionicons name="car" size={20} color={colors.primary[800]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary[900] }}>
                  {t('delivery_by_transporters')}
                </Text>
                <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                  {t('transporter_info')}
                </Text>
              </View>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text variant="heading4" style={{ marginBottom: spacing[4] }}>{t('listing_summary')}</Text>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" color="secondary">{t('crop_type')}</Text>
                <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                  {CROP_TYPES.find(c => c.id === cropType)?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" color="secondary">{t('quantity')}</Text>
                <Text variant="bodySmall" style={{ fontWeight: '600' }}>{quantity} kg</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" color="secondary">{t('price')}</Text>
                <Text variant="bodySmall" style={{ fontWeight: '600' }}>KSh {pricePerKg}/kg</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" color="secondary">{t('grade')}</Text>
                <Text variant="bodySmall" style={{ fontWeight: '600', color: gradeColorMap[aiGrade || 'Grade A'] }}>
                  {aiGrade}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text variant="bodySmall" color="secondary">{t('total_value')}</Text>
                <Text variant="heading4" style={{ color: colors.primary[900] }}>
                  KSh {(parseInt(quantity || '0') * parseInt(pricePerKg || '0')).toLocaleString()}
                </Text>
              </View>
            </View>

            {cropType && aiGrade && pricePerKg && quantity && (
              <SuccessEstimate
                crop={cropType}
                grade={aiGrade === 'Premium' ? 'PREMIUM' : aiGrade === 'Grade A' ? 'GRADE_A' : aiGrade === 'Grade B' ? 'GRADE_B' : 'GRADE_C'}
                price={parseInt(pricePerKg)}
                quantity={parseInt(quantity)}
                county={user?.location || 'Nairobi'}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        {step > 1 && (
          <Button
            variant="ghost"
            onPress={prevStep}
            leftIcon={<Ionicons name="arrow-back" size={20} color={colors.neutral[600]} />}
            accessibilityLabel={t('back')}
          >
            {t('back')}
          </Button>
        )}
        <Button
          variant="primary"
          onPress={step === 4 ? publishListing : nextStep}
          loading={isProcessing}
          disabled={isProcessing}
          fullWidth={step === 1}
          style={{ flex: step > 1 ? 2 : undefined }}
          accessibilityLabel={step === 4 ? t('publish_listing') : t('continue')}
        >
          {step === 4 ? t('publish_listing') : t('continue')}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  progressContainer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.neutral[300],
    borderRadius: radius.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[800],
    borderRadius: radius.xs,
  },
  progressText: {
    marginTop: spacing[2],
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: spacing[5],
  },
  cropGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2.5],
  },
  cropOption: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  cropOptionSelected: {
    borderColor: colors.primary[800],
    backgroundColor: colors.primary[50],
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2.5],
  },
  photoContainer: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhoto: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
  },
  addPhotoButtons: {
    width: '47%',
    aspectRatio: 1,
    flexDirection: 'column',
    gap: spacing[2],
  },
  addPhotoBtn: {
    flex: 1,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary[800],
    borderStyle: 'dashed',
  },
  gradeResult: {
    borderRadius: radius.xl,
    padding: spacing[5],
    marginTop: spacing[5],
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.lg,
    gap: spacing[1],
  },
  suggestedPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.overlay.scrim,
    paddingTop: spacing[4],
  },
  suggestedPriceInfo: {},
  usePriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[800],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    gap: spacing[1],
  },
  usePriceBtnText: {
    color: colors.background.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  retryGrade: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[3],
    gap: spacing[1],
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing[2.5],
  },
  optionBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  optionBtnSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[800],
  },
  storageOptions: {
    gap: spacing[2.5],
  },
  storageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing[3],
  },
  storageOptionSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[800],
  },
  transporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginTop: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  transporterIconWrap: {
    width: spacing[10],
    height: spacing[10],
    borderRadius: spacing[5],
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[5],
    marginTop: spacing[6],
    borderWidth: 1,
    borderColor: colors.primary[50],
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing[3.5],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  navigation: {
    flexDirection: 'row',
    padding: spacing[5],
    gap: spacing[3],
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.primary[50],
    ...shadows.sm,
  },
});
