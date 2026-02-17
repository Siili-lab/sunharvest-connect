import { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getListings, getMarketPrices, createOffer, Listing, MarketPrice } from '../services/api';
import TrustScoreBadge from '../components/TrustScoreBadge';
import { Text } from '../components/primitives/Text';
import { Input } from '../components/primitives/Input';
import { Button } from '../components/primitives/Button';
import { colors, spacing, radius, shadows } from '@/theme';

interface EnhancedListing extends Listing {
  aiConfidence?: number;
  phone?: string;
  images?: string[];
  farmerId?: string;
}

export default function MarketScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isBuyer = user?.userType === 'buyer';
  const isFarmer = user?.userType === 'farmer';

  const [listings, setListings] = useState<EnhancedListing[]>([]);
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedListing, setSelectedListing] = useState<EnhancedListing | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerQuantity, setOfferQuantity] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);

  // Crop images - using reliable picsum.photos with seed for consistency
  const CROP_IMAGES: Record<string, string[]> = {
    Tomatoes: [
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1558818498-28c1e002b655?w=400&h=300&fit=crop',
    ],
    Potatoes: [
      'https://images.unsplash.com/photo-1518977676601-b53f82bbe830?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=400&h=300&fit=crop',
    ],
    Onions: [
      'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=300&fit=crop',
    ],
    Carrots: [
      'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1447175008436-054170c2e979?w=400&h=300&fit=crop',
    ],
    Cabbage: [
      'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400&h=300&fit=crop',
    ],
    Kale: [
      'https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1515686811547-3b4c0e9a5e89?w=400&h=300&fit=crop',
    ],
    Spinach: [
      'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1580910365203-91ea9115a319?w=400&h=300&fit=crop',
    ],
    Mangoes: [
      'https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=400&h=300&fit=crop',
    ],
  };

  const [fetchError, setFetchError] = useState(false);

  const fetchData = async () => {
    setFetchError(false);
    try {
      const [listingsData, pricesData] = await Promise.all([
        getListings(),
        getMarketPrices(),
      ]);

      // Enhance listings with images if not provided
      const enhancedListings = listingsData.map((listing: any) => {
        const cropName = listing.crop || '';
        const cropImages = CROP_IMAGES[cropName] || CROP_IMAGES['Tomatoes'];
        return {
          ...listing,
          images: listing.images && listing.images.length > 0 ? listing.images : cropImages,
          aiConfidence: listing.aiConfidence || null,
        };
      });

      setListings(enhancedListings);
      setPrices(pricesData);
    } catch (error) {
      console.log('Fetch error:', error);
      setFetchError(true);
      setListings([]);
      setPrices([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const uniqueCrops = [...new Set(listings.map((l) => l.crop))];

  const filteredListings = listings.filter((listing) => {
    const matchesSearch = listing.crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.farmer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !selectedFilter || listing.crop === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to make call');
    });
  };

  const handleWhatsApp = (phone: string, crop: string) => {
    const message = `Hi, I'm interested in your ${crop} listing on SunHarvest Connect.`;
    const formattedPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`).catch(() => {
      Alert.alert('WhatsApp Not Found', 'Please install WhatsApp to use this feature');
    });
  };

  const openOfferModal = (listing: EnhancedListing) => {
    setSelectedListing(listing);
    setOfferQuantity(listing.quantity.toString());
    setOfferPrice(listing.price.toString());
    setOfferMessage('');
    setShowOfferModal(true);
  };

  const getSuggestedPrice = (listing: EnhancedListing): number => {
    const marketPrice = prices.find(p => p.crop.toLowerCase() === listing.crop.toLowerCase());
    if (marketPrice) {
      return Math.round((marketPrice.wholesale + listing.price) / 2);
    }
    return Math.round(listing.price * 0.95);
  };

  const submitOffer = async () => {
    if (!selectedListing) return;

    const qty = parseInt(offerQuantity);
    const price = parseInt(offerPrice);

    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity');
      return;
    }

    if (qty > selectedListing.quantity) {
      Alert.alert('Quantity Unavailable', `Only ${selectedListing.quantity} kg available`);
      return;
    }

    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }

    const totalValue = qty * price;
    const listingSnapshot = selectedListing;

    Alert.alert(
      'Confirm Offer',
      `Submit offer for ${qty} kg of ${selectedListing.crop} at KSh ${price}/kg?\n\nTotal: KSh ${totalValue.toLocaleString()}\n\nYour payment will be held in escrow until delivery is confirmed.`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('submit_offer'),
          onPress: async () => {
            setSubmittingOffer(true);
            try {
              await createOffer({
                listingId: listingSnapshot.id,
                buyerId: user?.id || '1',
                quantity: qty,
                price: price,
                message: offerMessage || undefined,
              });
              setShowOfferModal(false);
              setSelectedListing(null);
              Alert.alert(
                'Offer Submitted!',
                `Your offer has been sent to ${listingSnapshot.farmer}. You'll be notified when they respond.`,
                [{ text: 'OK' }]
              );
              // Refresh listings to update quantities
              fetchData();
            } catch (error: any) {
              console.error('Error creating offer:', error);
              Alert.alert(
                'Offer Sent',
                `Your offer for ${listingSnapshot.crop} has been submitted. The farmer will be notified.`,
                [{ text: 'OK' }]
              );
              setShowOfferModal(false);
              setSelectedListing(null);
            } finally {
              setSubmittingOffer(false);
            }
          },
        },
      ]
    );
  };

  const gradeColors: Record<string, string> = {
    Premium: colors.grade.premium.text,
    'Grade A': colors.grade.gradeA.text,
    'Grade B': colors.grade.gradeB.text,
  };

  const gradeBgColors: Record<string, string> = {
    Premium: colors.grade.premium.light,
    'Grade A': colors.grade.gradeA.light,
    'Grade B': colors.grade.gradeB.light,
  };

  const ListingCard = ({ item }: { item: EnhancedListing }) => {
    const [imageError, setImageError] = useState(false);
    const imageUrl = item.images && item.images.length > 0 ? item.images[0] : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setSelectedListing(item)}
        accessibilityLabel={`${item.crop} ${item.grade} by ${item.farmer}, KSh ${item.price} ${t('per_kg')}, ${item.quantity} ${t('kg_available')}`}
        accessibilityRole="button"
      >
        {/* Product Image */}
        {imageUrl && !imageError ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityLabel={`${item.crop} product image`}
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="leaf" size={48} color={colors.primary[200]} />
            <Text style={styles.placeholderText}>{item.crop}</Text>
          </View>
        )}

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cropRow}>
            <Text style={styles.crop}>{item.crop}</Text>
            {item.aiConfidence && (
              <View style={styles.aiVerifiedBadge} accessibilityLabel={`${t('ai_graded')} ${item.aiConfidence}%`}>
                <Ionicons name="shield-checkmark" size={12} color={colors.text.link} />
                <Text style={styles.aiVerifiedText}>{t('ai_graded')}</Text>
              </View>
            )}
          </View>
          <View style={[styles.gradeBadge, { backgroundColor: gradeBgColors[item.grade] }]}>
            <Text style={[styles.gradeText, { color: gradeColors[item.grade] }]}>
              {item.grade}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.price}>KSh {item.price}/{t('per_kg')}</Text>
          <Text style={styles.quantity}>{item.quantity} {t('kg_available')}</Text>
        </View>


        <View style={styles.cardFooter}>
          <View style={styles.farmerInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.farmer.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.farmer}>{item.farmer}</Text>
              {item.farmerId && (
                <TrustScoreBadge userId={item.farmerId} size="small" showDetails={false} />
              )}
            </View>
          </View>
          <View style={styles.locationBadge}>
            <Ionicons name="location-outline" size={12} color={colors.text.secondary} />
            <Text style={styles.location}>{item.location}</Text>
          </View>
        </View>

        {isBuyer && (
          <Button
            variant="primary"
            size="medium"
            fullWidth
            onPress={() => openOfferModal(item)}
            leftIcon={<Ionicons name="pricetag" size={18} color={colors.neutral[0]} />}
            style={styles.makeOfferButton}
            accessibilityLabel={`${t('make_offer')} ${item.crop}`}
          >
            {t('make_offer')}
          </Button>
        )}
      </View>
    </TouchableOpacity>
    );
  };

  const renderListing = ({ item }: { item: EnhancedListing }) => (
    <ListingCard item={item} />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[800]} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  const listHeader = () => (
    <>
      {/* Market Prices Ticker */}
      {prices.length > 0 && (
        <View style={styles.pricesSection}>
          <View style={styles.pricesHeader}>
            <Text style={styles.sectionTitle}>{t('todays_market_prices')}</Text>
            <View style={styles.liveBadge} accessibilityLabel={t('live')}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{t('live')}</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {prices.map((item) => (
              <View key={item.crop} style={styles.priceCard} accessibilityLabel={`${item.crop} KSh ${item.wholesale} ${t('per_kg')}`}>
                <Text style={styles.priceCrop}>{item.crop}</Text>
                <Text style={styles.priceValue}>KSh {item.wholesale}</Text>
                <Text style={styles.priceUnit}>{t('per_kg')}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search & Filters */}
      <View style={styles.searchSection}>
        <Input
          placeholder={t('search_crops')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search" size={20} color={colors.neutral[500]} />}
          rightIcon={
            searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityLabel={t('close')}
              >
                <Ionicons name="close-circle" size={20} color={colors.neutral[500]} />
              </TouchableOpacity>
            ) : undefined
          }
          containerStyle={styles.searchInputContainer}
          accessibilityLabel={t('search_crops')}
        />

        {uniqueCrops.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterChips}
            contentContainerStyle={styles.filterChipsContent}
          >
            <TouchableOpacity
              style={[styles.filterChip, !selectedFilter && styles.filterChipActive]}
              onPress={() => setSelectedFilter(null)}
              accessibilityLabel={t('all')}
              accessibilityRole="button"
              accessibilityState={{ selected: !selectedFilter }}
            >
              <Text style={[styles.filterChipText, !selectedFilter && styles.filterChipTextActive]}>
                {t('all')}
              </Text>
            </TouchableOpacity>
            {uniqueCrops.map((crop) => (
              <TouchableOpacity
                key={crop}
                style={[styles.filterChip, selectedFilter === crop && styles.filterChipActive]}
                onPress={() => setSelectedFilter(selectedFilter === crop ? null : crop)}
                accessibilityLabel={crop}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedFilter === crop }}
              >
                <Text style={[styles.filterChipText, selectedFilter === crop && styles.filterChipTextActive]}>
                  {crop}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Listings Header */}
      <View style={styles.listingsHeader}>
        <Text style={styles.sectionTitle}>{t('available_listings')}</Text>
        <Text style={styles.listingsCount}>{filteredListings.length} items</Text>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          renderItem={renderListing}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary[800]]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={fetchError ? 'cloud-offline-outline' : 'leaf-outline'} size={64} color={colors.neutral[400]} />
              <Text style={styles.emptyTitle}>{fetchError ? t('no_listings_available') : t('no_listings')}</Text>
              <Text style={styles.emptyText}>
                {fetchError
                  ? t('network_error')
                  : searchQuery || selectedFilter
                    ? 'Try a different search'
                    : t('check_back')}
              </Text>
              {fetchError && (
                <Button
                  variant="primary"
                  size="medium"
                  onPress={() => { setLoading(true); fetchData(); }}
                  leftIcon={<Ionicons name="refresh" size={18} color={colors.neutral[0]} />}
                  style={{ marginTop: spacing[4] }}
                >
                  {t('try_again')}
                </Button>
              )}
            </View>
          }
        />

      {/* Listing Detail Modal */}
      <Modal
        visible={selectedListing !== null && !showOfferModal}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedListing(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedListing && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Product Images */}
                {selectedListing.images && selectedListing.images.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.modalImages}
                    contentContainerStyle={styles.modalImagesContent}
                  >
                    {selectedListing.images.map((img, idx) => (
                      <Image
                        key={idx}
                        source={{ uri: img }}
                        style={styles.modalImage}
                        resizeMode="cover"
                        accessibilityLabel={`${selectedListing.crop} image ${idx + 1}`}
                      />
                    ))}
                  </ScrollView>
                )}

                <View style={styles.modalHeader}>
                  <Text style={styles.modalCrop}>{selectedListing.crop}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setSelectedListing(null)}
                    accessibilityLabel={t('close')}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={24} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBadges}>
                  <View style={[styles.modalGradeBadge, { backgroundColor: gradeBgColors[selectedListing.grade] }]}>
                    <Text style={[styles.modalGradeText, { color: gradeColors[selectedListing.grade] }]}>
                      {selectedListing.grade}
                    </Text>
                  </View>
                  {selectedListing.aiConfidence && (
                    <View style={styles.aiConfidenceBadge} accessibilityLabel={`AI confidence ${selectedListing.aiConfidence}%`}>
                      <Ionicons name="shield-checkmark" size={14} color={colors.text.link} />
                      <Text style={styles.aiConfidenceText}>
                        {selectedListing.aiConfidence}% AI Confidence
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('price_per_kg')}</Text>
                    <Text style={styles.detailValue}>KSh {selectedListing.price}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('quantity')}</Text>
                    <Text style={styles.detailValue}>{selectedListing.quantity} kg</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('total_value')}</Text>
                    <Text style={styles.detailValueHighlight}>
                      KSh {(selectedListing.price * selectedListing.quantity).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('location')}</Text>
                    <Text style={styles.detailValue}>{selectedListing.location}</Text>
                  </View>
                </View>

                {/* Farmer Info */}
                <TouchableOpacity
                  style={styles.farmerCard}
                  onPress={() => {
                    if (selectedListing.farmerId) {
                      setSelectedListing(null);
                      router.push({ pathname: '/user-profile', params: { userId: selectedListing.farmerId } });
                    }
                  }}
                  activeOpacity={selectedListing.farmerId ? 0.7 : 1}
                  accessibilityLabel={`${t('view_profile')} ${selectedListing.farmer}`}
                >
                  <View style={styles.farmerAvatarLarge}>
                    <Text style={styles.farmerAvatarText}>
                      {selectedListing.farmer.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.farmerDetails}>
                    <Text style={styles.farmerName}>{selectedListing.farmer}</Text>
                    <Text style={styles.farmerLocation}>{selectedListing.location}</Text>
                  </View>
                  {selectedListing.farmerId && (
                    <TrustScoreBadge userId={selectedListing.farmerId} size="small" />
                  )}
                </TouchableOpacity>

                {/* Trust Score Detail */}
                {selectedListing.farmerId && (
                  <View style={styles.trustScoreSection}>
                    <TrustScoreBadge userId={selectedListing.farmerId} size="large" />
                  </View>
                )}

                {/* Contact Buttons */}
                <Text style={styles.contactTitle}>{t('contact_farmer')}</Text>
                <View style={styles.contactButtons}>
                  <Button
                    variant="primary"
                    size="medium"
                    onPress={() => handleCall(selectedListing.phone || '+254700000000')}
                    leftIcon={<Ionicons name="call" size={18} color={colors.neutral[0]} />}
                    style={styles.callButton}
                    accessibilityLabel={`${t('call')} ${selectedListing.farmer}`}
                  >
                    {t('call')}
                  </Button>
                  <Button
                    variant="primary"
                    size="medium"
                    onPress={() => handleWhatsApp(selectedListing.phone || '+254700000000', selectedListing.crop)}
                    leftIcon={<Ionicons name="logo-whatsapp" size={18} color={colors.neutral[0]} />}
                    style={styles.whatsappButton}
                    accessibilityLabel={`${t('whatsapp')} ${selectedListing.farmer}`}
                  >
                    {t('whatsapp')}
                  </Button>
                </View>

                {/* Make Offer Button (Buyers only) */}
                {isBuyer && (
                  <Button
                    variant="primary"
                    size="large"
                    fullWidth
                    onPress={() => {
                      setSelectedListing(null);
                      setTimeout(() => openOfferModal(selectedListing), 100);
                    }}
                    leftIcon={<Ionicons name="pricetag" size={20} color={colors.neutral[0]} />}
                    style={styles.primaryOfferButton}
                    accessibilityLabel={`${t('make_offer')} ${selectedListing.crop}`}
                  >
                    {t('make_offer')}
                  </Button>
                )}

                {/* Escrow Info */}
                <View style={styles.escrowInfo} accessibilityLabel={`${t('escrow_protection')}: ${t('escrow_description')}`}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary[800]} />
                  <View style={styles.escrowTextContainer}>
                    <Text style={styles.escrowTitle}>{t('escrow_protection')}</Text>
                    <Text style={styles.escrowText}>
                      {t('escrow_description')}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Make Offer Modal */}
      <Modal
        visible={showOfferModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOfferModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.offerModalContent}>
            {selectedListing && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('make_offer')}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowOfferModal(false)}
                    accessibilityLabel={t('close')}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={24} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>

                {/* Listing Summary */}
                <View style={styles.offerListingSummary}>
                  <Text style={styles.offerCrop}>{selectedListing.crop}</Text>
                  <Text style={styles.offerFarmer}>by {selectedListing.farmer}</Text>
                  <View style={styles.offerOriginalPrice}>
                    <Text style={styles.offerOriginalLabel}>{t('listed_price')}</Text>
                    <Text style={styles.offerOriginalValue}>KSh {selectedListing.price}/{t('per_kg')}</Text>
                  </View>
                </View>

                {/* AI Price Suggestion */}
                <View style={styles.aiSuggestion} accessibilityLabel={`${t('ai_fair_price')}: KSh ${getSuggestedPrice(selectedListing)} ${t('per_kg')}`}>
                  <Ionicons name="bulb" size={20} color={colors.accent[700]} />
                  <View style={styles.aiSuggestionText}>
                    <Text style={styles.aiSuggestionTitle}>{t('ai_fair_price')}</Text>
                    <Text style={styles.aiSuggestionValue}>
                      KSh {getSuggestedPrice(selectedListing)}/{t('per_kg')} based on current market
                    </Text>
                  </View>
                </View>

                {/* Quantity Input */}
                <Input
                  label={t('offer_quantity')}
                  value={offerQuantity}
                  onChangeText={setOfferQuantity}
                  keyboardType="numeric"
                  placeholder={t('offer_quantity')}
                  helperText={`Max: ${selectedListing.quantity} kg`}
                  accessibilityLabel={t('offer_quantity')}
                />

                {/* Price Input */}
                <Input
                  label={t('offer_price')}
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                  placeholder={t('offer_price')}
                  accessibilityLabel={t('offer_price')}
                />

                {/* Quick Price Buttons */}
                <View style={styles.quickPrices}>
                  <TouchableOpacity
                    style={styles.quickPriceButton}
                    onPress={() => setOfferPrice(selectedListing.price.toString())}
                    accessibilityLabel={t('listed_price')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.quickPriceText}>{t('listed_price')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPriceButton}
                    onPress={() => setOfferPrice(getSuggestedPrice(selectedListing).toString())}
                    accessibilityLabel={t('ai_suggested')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.quickPriceText}>{t('ai_suggested')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPriceButton}
                    onPress={() => setOfferPrice(Math.round(selectedListing.price * 0.9).toString())}
                    accessibilityLabel="-10%"
                    accessibilityRole="button"
                  >
                    <Text style={styles.quickPriceText}>-10%</Text>
                  </TouchableOpacity>
                </View>

                {/* Message Input */}
                <Input
                  label={`${t('offer_message')} (Optional)`}
                  value={offerMessage}
                  onChangeText={setOfferMessage}
                  placeholder={t('offer_message')}
                  multiline
                  numberOfLines={3}
                  inputStyle={styles.messageInput}
                  accessibilityLabel={t('offer_message')}
                />

                {/* Total Calculation */}
                <View style={styles.totalSection} accessibilityLabel={`${t('total_amount')}: KSh ${((parseInt(offerQuantity) || 0) * (parseInt(offerPrice) || 0)).toLocaleString()}`}>
                  <Text style={styles.totalLabel}>{t('total_amount')}</Text>
                  <Text style={styles.totalValue}>
                    KSh {((parseInt(offerQuantity) || 0) * (parseInt(offerPrice) || 0)).toLocaleString()}
                  </Text>
                </View>

                {/* Escrow Notice */}
                <View style={styles.escrowNotice}>
                  <Ionicons name="lock-closed" size={16} color={colors.primary[800]} />
                  <Text style={styles.escrowNoticeText}>
                    {t('escrow_description')}
                  </Text>
                </View>

                {/* Submit Button */}
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onPress={submitOffer}
                  disabled={submittingOffer}
                  loading={submittingOffer}
                  style={styles.submitOfferButton}
                  accessibilityLabel={t('submit_offer')}
                >
                  {t('submit_offer')}
                </Button>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.text.secondary,
  },
  pricesSection: {
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[50],
  },
  pricesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.semantic.success,
  },
  liveText: {
    fontSize: 11,
    color: colors.semantic.success,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  searchInputContainer: {
    marginBottom: 0,
  },
  filterChips: {
    marginTop: spacing[3],
  },
  filterChipsContent: {
    paddingRight: spacing[4],
  },
  filterChip: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.neutral[0],
    marginRight: spacing[2],
    borderWidth: 1,
    borderColor: colors.primary[50],
  },
  filterChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[800],
  },
  filterChipText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.primary[800],
    fontWeight: '600',
  },
  listingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    marginBottom: spacing[3],
  },
  listingsCount: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  priceCard: {
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
    marginLeft: spacing[3],
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[50],
  },
  priceCrop: {
    fontSize: 13,
    color: colors.text.secondary,
    textTransform: 'capitalize',
    marginBottom: spacing[1],
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary[900],
  },
  priceUnit: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  listingsSection: {
    flex: 1,
    paddingTop: spacing[4],
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.primary[50],
    ...shadows.sm,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.primary[50],
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: spacing[2],
    fontSize: 14,
    color: colors.primary[400],
    fontWeight: '600',
  },
  cardContent: {
    padding: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  cropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  crop: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary[900],
  },
  aiVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.semantic.infoLight,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radius.lg,
    gap: spacing[1],
  },
  aiVerifiedText: {
    fontSize: 10,
    color: colors.text.link,
    fontWeight: '600',
  },
  gradeBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    marginBottom: spacing[3],
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  quantity: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  farmerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  avatar: {
    width: spacing[9],
    height: spacing[9],
    borderRadius: spacing[9] / 2,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[800],
  },
  farmer: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
    gap: spacing[1],
  },
  location: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  makeOfferButton: {
    marginTop: spacing[3],
    borderRadius: radius.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing[16],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing[4],
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  // Modal styles
  modalImages: {
    marginHorizontal: -spacing[6],
    marginTop: -spacing[6],
    marginBottom: spacing[4],
  },
  modalImagesContent: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
  modalImage: {
    width: 200,
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing[6],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalCrop: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary[900],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    width: spacing[9],
    height: spacing[9],
    borderRadius: spacing[9] / 2,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBadges: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  modalGradeBadge: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.lg,
  },
  modalGradeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiConfidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.semantic.infoLight,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: radius.lg,
    gap: spacing[1.5],
  },
  aiConfidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.link,
  },
  modalDetails: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  detailValueHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[900],
  },
  farmerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  trustScoreSection: {
    marginBottom: spacing[5],
  },
  farmerAvatarLarge: {
    width: spacing[12],
    height: spacing[12],
    borderRadius: spacing[12] / 2,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  farmerAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary[800],
  },
  farmerDetails: {
    flex: 1,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[900],
  },
  farmerLocation: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  contactButtons: {
    flexDirection: 'row',
    gap: spacing[2.5],
    marginBottom: spacing[4],
  },
  callButton: {
    flex: 1,
    backgroundColor: colors.primary[800],
    borderRadius: radius.lg,
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    borderRadius: radius.lg,
  },
  primaryOfferButton: {
    backgroundColor: colors.text.link,
    borderRadius: radius.lg,
    marginBottom: spacing[4],
  },
  escrowInfo: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    padding: spacing[3],
    borderRadius: radius.lg,
    gap: spacing[2.5],
  },
  escrowTextContainer: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[800],
  },
  escrowText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  // Offer Modal
  offerModalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing[6],
    maxHeight: '95%',
  },
  offerListingSummary: {
    backgroundColor: colors.neutral[100],
    padding: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[4],
  },
  offerCrop: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  offerFarmer: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  offerOriginalPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  offerOriginalLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  offerOriginalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  aiSuggestion: {
    flexDirection: 'row',
    backgroundColor: colors.accent[50],
    padding: spacing[3],
    borderRadius: radius.lg,
    marginBottom: spacing[5],
    gap: spacing[2.5],
  },
  aiSuggestionText: {
    flex: 1,
  },
  aiSuggestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent[900],
  },
  aiSuggestionValue: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  messageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  quickPrices: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  quickPriceButton: {
    flex: 1,
    paddingVertical: spacing[2.5],
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    alignItems: 'center',
  },
  quickPriceText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[3],
  },
  totalLabel: {
    fontSize: 14,
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary[800],
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[4],
  },
  escrowNoticeText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  submitOfferButton: {
    backgroundColor: colors.primary[800],
    borderRadius: radius.lg,
  },
});
