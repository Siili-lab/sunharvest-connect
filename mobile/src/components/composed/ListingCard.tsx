/**
 * Listing Card Component
 *
 * Displays a produce listing in the marketplace.
 * Shows image, grade, price, location.
 *
 * Usage:
 *   <ListingCard listing={listing} onPress={() => navigate(listing.id)} />
 */

import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Caption } from '../primitives/Text';
import { Box } from '../primitives/Box';
import { Card } from './Card';
import { GradeBadge, GradeIndicator } from './GradeBadge';
import { colors, spacing, radius } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';

// ===== Types =====

interface Listing {
  id: string;
  cropType: string;
  variety?: string;
  quantity: number;
  unit: string;
  qualityGrade: 'PREMIUM' | 'GRADE_A' | 'GRADE_B' | 'REJECT';
  price: {
    amount: number;
    currency: string;
    unit: string;
  };
  images: string[];
  location: {
    county: string;
    subCounty?: string;
  };
  farmer?: {
    name: string;
    rating?: number;
  };
  createdAt: Date;
}

interface ListingCardProps {
  listing: Listing;
  onPress?: () => void;
  variant?: 'full' | 'compact';
}

// ===== Component =====

export function ListingCard({
  listing,
  onPress,
  variant = 'full',
}: ListingCardProps): JSX.Element {
  const { t } = useTranslation();

  // Format price
  const formatPrice = (price: Listing['price']): string => {
    return `${price.currency} ${price.amount.toLocaleString()}/${price.unit}`;
  };

  // Format location
  const formatLocation = (location: Listing['location']): string => {
    return location.subCounty
      ? `${location.subCounty}, ${location.county}`
      : location.county;
  };

  // Capitalize crop name
  const formatCropName = (crop: string): string => {
    return crop.charAt(0).toUpperCase() + crop.slice(1);
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Card variant="outlined" padding={3}>
          <Box flexDirection="row" alignItems="center" gap={3}>
            {/* Thumbnail */}
            <Image
              source={{ uri: listing.images[0] }}
              style={styles.thumbnailSmall}
            />

            {/* Info */}
            <Box flex={1}>
              <Box flexDirection="row" alignItems="center" gap={2}>
                <GradeIndicator grade={listing.qualityGrade} />
                <Text variant="label">{formatCropName(listing.cropType)}</Text>
              </Box>
              <Caption>{listing.quantity} {listing.unit}</Caption>
            </Box>

            {/* Price */}
            <Text variant="label" style={{ color: colors.secondary[600] }}>
              {formatPrice(listing.price)}
            </Text>
          </Box>
        </Card>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="elevated">
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: listing.images[0] }}
            style={styles.image}
            resizeMode="cover"
          />
          {/* Grade overlay */}
          <View style={styles.gradeBadgeOverlay}>
            <GradeBadge grade={listing.qualityGrade} size="small" />
          </View>
        </View>

        {/* Content */}
        <Box padding={3} gap={2}>
          {/* Title row */}
          <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Text variant="heading4">
                {formatCropName(listing.cropType)}
                {listing.variety && ` - ${listing.variety}`}
              </Text>
              <Caption>
                {listing.quantity} {listing.unit} available
              </Caption>
            </Box>
          </Box>

          {/* Price */}
          <Text variant="price" style={{ color: colors.secondary[600] }}>
            {formatPrice(listing.price)}
          </Text>

          {/* Location */}
          <Box flexDirection="row" alignItems="center" gap={1}>
            <Text style={styles.locationIcon}>📍</Text>
            <Caption>{formatLocation(listing.location)}</Caption>
          </Box>

          {/* Farmer info */}
          {listing.farmer && (
            <Box
              flexDirection="row"
              alignItems="center"
              gap={2}
              marginTop={2}
              paddingTop={2}
              style={styles.farmerSection}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {listing.farmer.name.charAt(0)}
                </Text>
              </View>
              <Box flex={1}>
                <Text variant="label">{listing.farmer.name}</Text>
                {listing.farmer.rating && (
                  <Caption>⭐ {listing.farmer.rating.toFixed(1)}</Caption>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Card>
    </TouchableOpacity>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  imageContainer: {
    position: 'relative',
    height: 160,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  gradeBadgeOverlay: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
  },

  thumbnailSmall: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
  },

  locationIcon: {
    fontSize: 14,
  },

  farmerSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[700],
  },
});
