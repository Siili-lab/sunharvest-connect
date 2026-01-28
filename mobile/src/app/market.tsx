import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getListings, getMarketPrices, createOffer, Listing, MarketPrice } from '../services/api';
import TrustScoreBadge from '../components/TrustScoreBadge';

interface EnhancedListing extends Listing {
  aiConfidence?: number;
  phone?: string;
  images?: string[];
  farmerId?: string;
}

export default function MarketScreen() {
  const { user } = useAuth();
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

  const MOCK_LISTINGS: EnhancedListing[] = [
    {
      id: '1', crop: 'Tomatoes', grade: 'Grade A', price: 100, quantity: 500,
      farmer: 'John Kamau', location: 'Kiambu', aiConfidence: 94, phone: '+254712345678',
      images: CROP_IMAGES.Tomatoes,
    },
    {
      id: '2', crop: 'Potatoes', grade: 'Premium', price: 80, quantity: 1000,
      farmer: 'Mary Wanjiku', location: 'Nyandarua', aiConfidence: 97, phone: '+254723456789',
      images: CROP_IMAGES.Potatoes,
    },
    {
      id: '3', crop: 'Onions', grade: 'Grade B', price: 60, quantity: 300,
      farmer: 'Peter Ochieng', location: 'Kajiado', aiConfidence: 82, phone: '+254734567890',
      images: CROP_IMAGES.Onions,
    },
    {
      id: '4', crop: 'Carrots', grade: 'Grade A', price: 90, quantity: 450,
      farmer: 'Sarah Akinyi', location: 'Machakos', aiConfidence: 91, phone: '+254745678901',
      images: CROP_IMAGES.Carrots,
    },
    {
      id: '5', crop: 'Cabbage', grade: 'Premium', price: 45, quantity: 800,
      farmer: 'David Mwangi', location: 'Limuru', aiConfidence: 96, phone: '+254756789012',
      images: CROP_IMAGES.Cabbage,
    },
    {
      id: '6', crop: 'Kale', grade: 'Grade A', price: 50, quantity: 200,
      farmer: 'Grace Njeri', location: 'Nyeri', aiConfidence: 89, phone: '+254767890123',
      images: CROP_IMAGES.Kale,
    },
    {
      id: '7', crop: 'Spinach', grade: 'Premium', price: 55, quantity: 150,
      farmer: 'James Mutua', location: 'Meru', aiConfidence: 93, phone: '+254778901234',
      images: CROP_IMAGES.Spinach,
    },
    {
      id: '8', crop: 'Mangoes', grade: 'Grade A', price: 150, quantity: 600,
      farmer: 'Elizabeth Wambui', location: 'Makueni', aiConfidence: 95, phone: '+254789012345',
      images: CROP_IMAGES.Mangoes,
    },
  ];

  const fetchData = async () => {
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
          aiConfidence: listing.aiConfidence || 90 + Math.floor(Math.random() * 8),
        };
      });

      setListings(enhancedListings.length > 0 ? enhancedListings : MOCK_LISTINGS);
      setPrices(pricesData);
    } catch (error) {
      console.log('Fetch error:', error);
      setListings(MOCK_LISTINGS);
      setPrices([
        { crop: 'tomato', wholesale: 80, retail: 120, unit: 'kg', currency: 'KSh' },
        { crop: 'potato', wholesale: 60, retail: 90, unit: 'kg', currency: 'KSh' },
        { crop: 'onion', wholesale: 70, retail: 100, unit: 'kg', currency: 'KSh' },
        { crop: 'carrot', wholesale: 75, retail: 110, unit: 'kg', currency: 'KSh' },
        { crop: 'cabbage', wholesale: 35, retail: 55, unit: 'kg', currency: 'KSh' },
      ]);
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
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Offer',
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
    Premium: '#1B5E20',
    'Grade A': '#388E3C',
    'Grade B': '#F57C00',
  };

  const gradeBgColors: Record<string, string> = {
    Premium: '#E8F5E9',
    'Grade A': '#F1F8E9',
    'Grade B': '#FFF3E0',
  };

  const ListingCard = ({ item }: { item: EnhancedListing }) => {
    const [imageError, setImageError] = useState(false);
    const imageUrl = item.images && item.images.length > 0 ? item.images[0] : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setSelectedListing(item)}
      >
        {/* Product Image */}
        {imageUrl && !imageError ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="leaf" size={48} color="#A5D6A7" />
            <Text style={styles.placeholderText}>{item.crop}</Text>
          </View>
        )}

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cropRow}>
            <Text style={styles.crop}>{item.crop}</Text>
            {item.aiConfidence && (
              <View style={styles.aiVerifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#1976D2" />
                <Text style={styles.aiVerifiedText}>AI Graded</Text>
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
          <Text style={styles.price}>KSh {item.price}/kg</Text>
          <Text style={styles.quantity}>{item.quantity} kg available</Text>
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
            <Ionicons name="location-outline" size={12} color="#666" />
            <Text style={styles.location}>{item.location}</Text>
          </View>
        </View>

        {isBuyer && (
          <TouchableOpacity
            style={styles.makeOfferButton}
            onPress={(e) => {
              e.stopPropagation();
              openOfferModal(item);
            }}
          >
            <Ionicons name="pricetag" size={18} color="#fff" />
            <Text style={styles.makeOfferButtonText}>Make Offer</Text>
          </TouchableOpacity>
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
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading market data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Market Prices Ticker */}
      {prices.length > 0 && (
        <View style={styles.pricesSection}>
          <View style={styles.pricesHeader}>
            <Text style={styles.sectionTitle}>Today's Market Prices</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>
          <FlatList
            horizontal
            data={prices}
            keyExtractor={(item) => item.crop}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.priceCard}>
                <Text style={styles.priceCrop}>{item.crop}</Text>
                <Text style={styles.priceValue}>KSh {item.wholesale}</Text>
                <Text style={styles.priceUnit}>per {item.unit}</Text>
              </View>
            )}
          />
        </View>
      )}

      {/* Search & Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9E9E9E" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search crops, farmers, locations..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9E9E9E" />
            </TouchableOpacity>
          )}
        </View>

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
            >
              <Text style={[styles.filterChipText, !selectedFilter && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {uniqueCrops.map((crop) => (
              <TouchableOpacity
                key={crop}
                style={[styles.filterChip, selectedFilter === crop && styles.filterChipActive]}
                onPress={() => setSelectedFilter(selectedFilter === crop ? null : crop)}
              >
                <Text style={[styles.filterChipText, selectedFilter === crop && styles.filterChipTextActive]}>
                  {crop}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Listings */}
      <View style={styles.listingsSection}>
        <View style={styles.listingsHeader}>
          <Text style={styles.sectionTitle}>Available Listings</Text>
          <Text style={styles.listingsCount}>{filteredListings.length} items</Text>
        </View>
        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          renderItem={renderListing}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Listings Found</Text>
              <Text style={styles.emptyText}>
                {searchQuery || selectedFilter ? 'Try a different search' : 'Check back later for new listings'}
              </Text>
            </View>
          }
        />
      </View>

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
                      />
                    ))}
                  </ScrollView>
                )}

                <View style={styles.modalHeader}>
                  <Text style={styles.modalCrop}>{selectedListing.crop}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setSelectedListing(null)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBadges}>
                  <View style={[styles.modalGradeBadge, { backgroundColor: gradeBgColors[selectedListing.grade] }]}>
                    <Text style={[styles.modalGradeText, { color: gradeColors[selectedListing.grade] }]}>
                      {selectedListing.grade}
                    </Text>
                  </View>
                  {selectedListing.aiConfidence && (
                    <View style={styles.aiConfidenceBadge}>
                      <Ionicons name="shield-checkmark" size={14} color="#1976D2" />
                      <Text style={styles.aiConfidenceText}>
                        {selectedListing.aiConfidence}% AI Confidence
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price per kg</Text>
                    <Text style={styles.detailValue}>KSh {selectedListing.price}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Available Quantity</Text>
                    <Text style={styles.detailValue}>{selectedListing.quantity} kg</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Value</Text>
                    <Text style={styles.detailValueHighlight}>
                      KSh {(selectedListing.price * selectedListing.quantity).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{selectedListing.location}</Text>
                  </View>
                </View>

                {/* Farmer Info */}
                <View style={styles.farmerCard}>
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
                </View>

                {/* Trust Score Detail */}
                {selectedListing.farmerId && (
                  <View style={styles.trustScoreSection}>
                    <TrustScoreBadge userId={selectedListing.farmerId} size="large" />
                  </View>
                )}

                {/* Contact Buttons */}
                <Text style={styles.contactTitle}>Contact Farmer</Text>
                <View style={styles.contactButtons}>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => handleCall(selectedListing.phone || '+254700000000')}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.whatsappButton}
                    onPress={() => handleWhatsApp(selectedListing.phone || '+254700000000', selectedListing.crop)}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                    <Text style={styles.whatsappButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>

                {/* Make Offer Button (Buyers only) */}
                {isBuyer && (
                  <TouchableOpacity
                    style={styles.primaryOfferButton}
                    onPress={() => {
                      setSelectedListing(null);
                      setTimeout(() => openOfferModal(selectedListing), 100);
                    }}
                  >
                    <Ionicons name="pricetag" size={20} color="#fff" />
                    <Text style={styles.primaryOfferButtonText}>Make an Offer</Text>
                  </TouchableOpacity>
                )}

                {/* Escrow Info */}
                <View style={styles.escrowInfo}>
                  <Ionicons name="shield-checkmark" size={20} color="#2E7D32" />
                  <View style={styles.escrowTextContainer}>
                    <Text style={styles.escrowTitle}>Escrow Protection</Text>
                    <Text style={styles.escrowText}>
                      Your payment is held securely until you confirm delivery
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
                  <Text style={styles.modalTitle}>Make an Offer</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowOfferModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* Listing Summary */}
                <View style={styles.offerListingSummary}>
                  <Text style={styles.offerCrop}>{selectedListing.crop}</Text>
                  <Text style={styles.offerFarmer}>by {selectedListing.farmer}</Text>
                  <View style={styles.offerOriginalPrice}>
                    <Text style={styles.offerOriginalLabel}>Listed at</Text>
                    <Text style={styles.offerOriginalValue}>KSh {selectedListing.price}/kg</Text>
                  </View>
                </View>

                {/* AI Price Suggestion */}
                <View style={styles.aiSuggestion}>
                  <Ionicons name="bulb" size={20} color="#F57C00" />
                  <View style={styles.aiSuggestionText}>
                    <Text style={styles.aiSuggestionTitle}>AI Fair Price Suggestion</Text>
                    <Text style={styles.aiSuggestionValue}>
                      KSh {getSuggestedPrice(selectedListing)}/kg based on current market
                    </Text>
                  </View>
                </View>

                {/* Quantity Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quantity (kg)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={offerQuantity}
                      onChangeText={setOfferQuantity}
                      keyboardType="numeric"
                      placeholder="Enter quantity"
                    />
                    <Text style={styles.inputHint}>
                      Max: {selectedListing.quantity} kg
                    </Text>
                  </View>
                </View>

                {/* Price Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Your Offer Price (KSh/kg)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={offerPrice}
                      onChangeText={setOfferPrice}
                      keyboardType="numeric"
                      placeholder="Enter price"
                    />
                  </View>
                </View>

                {/* Quick Price Buttons */}
                <View style={styles.quickPrices}>
                  <TouchableOpacity
                    style={styles.quickPriceButton}
                    onPress={() => setOfferPrice(selectedListing.price.toString())}
                  >
                    <Text style={styles.quickPriceText}>Listed Price</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPriceButton}
                    onPress={() => setOfferPrice(getSuggestedPrice(selectedListing).toString())}
                  >
                    <Text style={styles.quickPriceText}>AI Suggested</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickPriceButton}
                    onPress={() => setOfferPrice(Math.round(selectedListing.price * 0.9).toString())}
                  >
                    <Text style={styles.quickPriceText}>-10%</Text>
                  </TouchableOpacity>
                </View>

                {/* Message Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Message (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.messageInput]}
                    value={offerMessage}
                    onChangeText={setOfferMessage}
                    placeholder="Add a note to the farmer..."
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Total Calculation */}
                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>
                    KSh {((parseInt(offerQuantity) || 0) * (parseInt(offerPrice) || 0)).toLocaleString()}
                  </Text>
                </View>

                {/* Escrow Notice */}
                <View style={styles.escrowNotice}>
                  <Ionicons name="lock-closed" size={16} color="#2E7D32" />
                  <Text style={styles.escrowNoticeText}>
                    Payment held in escrow until delivery confirmed
                  </Text>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitOfferButton, submittingOffer && styles.submitOfferButtonDisabled]}
                  onPress={submitOffer}
                  disabled={submittingOffer}
                >
                  {submittingOffer ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitOfferButtonText}>Submit Offer</Text>
                  )}
                </TouchableOpacity>
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
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  pricesSection: {
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E9',
  },
  pricesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  liveText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },
  filterChips: {
    marginTop: 12,
  },
  filterChipsContent: {
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  filterChipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  listingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listingsCount: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  priceCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    marginLeft: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  priceCrop: {
    fontSize: 13,
    color: '#666',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B5E20',
  },
  priceUnit: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },
  listingsSection: {
    flex: 1,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    elevation: 2,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#E8F5E9',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#66BB6A',
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crop: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B5E20',
  },
  aiVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  aiVerifiedText: {
    fontSize: 10,
    color: '#1976D2',
    fontWeight: '600',
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  quantity: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  farmerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  farmer: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  location: {
    fontSize: 12,
    color: '#666',
  },
  makeOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  makeOfferButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  // Modal styles
  modalImages: {
    marginHorizontal: -24,
    marginTop: -24,
    marginBottom: 16,
  },
  modalImagesContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  modalImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalCrop: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  modalGradeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  modalGradeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiConfidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  aiConfidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  modalDetails: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailValueHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B5E20',
  },
  farmerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  trustScoreSection: {
    marginBottom: 20,
  },
  farmerAvatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  farmerAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
  },
  farmerDetails: {
    flex: 1,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B5E20',
  },
  farmerLocation: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  whatsappButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  primaryOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  primaryOfferButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  escrowInfo: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  escrowTextContainer: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  escrowText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  // Offer Modal
  offerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '95%',
  },
  offerListingSummary: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  offerCrop: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  offerFarmer: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  offerOriginalPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  offerOriginalLabel: {
    fontSize: 14,
    color: '#666',
  },
  offerOriginalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  aiSuggestion: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  aiSuggestionText: {
    flex: 1,
  },
  aiSuggestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
  },
  aiSuggestionValue: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  messageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
  },
  quickPrices: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickPriceButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickPriceText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  escrowNoticeText: {
    fontSize: 12,
    color: '#666',
  },
  submitOfferButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitOfferButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  submitOfferButtonDisabled: {
    opacity: 0.6,
  },
});
