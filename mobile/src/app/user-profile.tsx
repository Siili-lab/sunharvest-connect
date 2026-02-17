import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/primitives/Text';
import { Button } from '../components/primitives/Button';
import TrustScoreBadge from '../components/TrustScoreBadge';
import { useLanguage } from '../context/LanguageContext';
import { getPublicProfile, getListings, PublicProfile, Listing } from '../services/api';
import { colors, spacing, radius, shadows } from '@/theme';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadProfile();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      const [profileData, listingsData] = await Promise.all([
        getPublicProfile(userId!),
        getListings().catch(() => []),
      ]);
      setProfile(profileData);
      // Filter listings to only show this farmer's
      if (profileData.role === 'FARMER') {
        const farmerListings = listingsData.filter(
          (l: any) => l.farmerId === userId
        );
        setListings(farmerListings);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('Contact', 'Phone number not available');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'Unable to make call');
    });
  };

  const handleWhatsApp = (phone?: string) => {
    if (!phone) {
      Alert.alert('Contact', 'Phone number not available');
      return;
    }
    const formatted = phone.replace(/[^0-9]/g, '');
    const msg = `Hi, I found your profile on SunHarvest Connect.`;
    Linking.openURL(`whatsapp://send?phone=${formatted}&text=${encodeURIComponent(msg)}`).catch(() => {
      Alert.alert('WhatsApp Not Found', 'Please install WhatsApp');
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[800]} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-outline" size={64} color={colors.neutral[400]} />
        <Text style={styles.emptyText}>User not found</Text>
      </View>
    );
  }

  const roleLabel = profile.role === 'FARMER' ? t('farmer') : profile.role === 'BUYER' ? t('buyer') : t('transporter');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
        {profile.county && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.locationText}>{profile.county}</Text>
          </View>
        )}
        <Text style={styles.memberSince}>
          {t('member_since')} {formatDate(profile.createdAt)}
        </Text>
        {profile.isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.semantic.success} />
            <Text style={styles.verifiedText}>{t('verified')}</Text>
          </View>
        )}
      </View>

      {/* Trust Score */}
      <View style={styles.section}>
        <TrustScoreBadge userId={profile.id} size="large" />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.activeListings}</Text>
          <Text style={styles.statLabel}>{t('active_listings')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{profile.completedDeals}</Text>
          <Text style={styles.statLabel}>{t('completed_deals')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {profile.rating ? profile.rating.toFixed(1) : '-'}
          </Text>
          <Text style={styles.statLabel}>
            {t('rating')} {profile.totalRatings > 0 ? `(${profile.totalRatings})` : ''}
          </Text>
        </View>
      </View>

      {/* Farmer's Active Listings */}
      {profile.role === 'FARMER' && listings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('active_listings')}</Text>
          {listings.map((listing) => (
            <TouchableOpacity
              key={listing.id}
              style={styles.listingCard}
              onPress={() => router.push('/market')}
            >
              <View>
                <Text style={styles.listingCrop}>{listing.crop}</Text>
                <Text style={styles.listingDetail}>
                  {listing.quantity} kg @ KSh {listing.price}/{t('per_kg')}
                </Text>
              </View>
              <Text style={styles.listingGrade}>{listing.grade}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Contact Buttons */}
      <View style={styles.contactSection}>
        <Text style={styles.sectionTitle}>
          {profile.role === 'FARMER' ? t('contact_farmer') : t('contact_buyer')}
        </Text>
        <View style={styles.contactButtons}>
          <Button
            variant="primary"
            size="medium"
            onPress={() => handleCall()}
            leftIcon={<Ionicons name="call" size={18} color={colors.neutral[0]} />}
            style={styles.callBtn}
          >
            {t('call')}
          </Button>
          <Button
            variant="primary"
            size="medium"
            onPress={() => handleWhatsApp()}
            leftIcon={<Ionicons name="logo-whatsapp" size={18} color={colors.neutral[0]} />}
            style={styles.whatsappBtn}
          >
            {t('whatsapp')}
          </Button>
        </View>
      </View>

      <View style={{ height: spacing[8] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[500],
    marginTop: spacing[4],
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary[800],
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary[900],
  },
  roleBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginTop: spacing[2],
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[800],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  locationText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  memberSince: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
    backgroundColor: colors.semantic.successLight || '#E8F5E9',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.semantic.success,
  },
  section: {
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
    gap: spacing[2.5],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[3.5],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[50],
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary[900],
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
    textAlign: 'center',
  },
  listingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.primary[50],
  },
  listingCrop: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[900],
  },
  listingDetail: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  listingGrade: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[800],
  },
  contactSection: {
    paddingHorizontal: spacing[5],
    marginTop: spacing[5],
  },
  contactButtons: {
    flexDirection: 'row',
    gap: spacing[2.5],
  },
  callBtn: {
    flex: 1,
    backgroundColor: colors.primary[800],
    borderRadius: radius.lg,
  },
  whatsappBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    borderRadius: radius.lg,
  },
});
