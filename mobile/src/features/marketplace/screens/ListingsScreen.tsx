import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Listing = {
  id: string;
  crop: string;
  grade: string;
  price: number;
  quantity: number;
  farmer: string;
  location: string;
};

const mockListings: Listing[] = [
  {
    id: '1',
    crop: 'Tomatoes',
    grade: 'Grade A',
    price: 100,
    quantity: 50,
    farmer: 'John M.',
    location: 'Kiambu',
  },
  {
    id: '2',
    crop: 'Potatoes',
    grade: 'Premium',
    price: 80,
    quantity: 100,
    farmer: 'Mary W.',
    location: 'Nakuru',
  },
  {
    id: '3',
    crop: 'Onions',
    grade: 'Grade B',
    price: 60,
    quantity: 30,
    farmer: 'Peter K.',
    location: 'Nairobi',
  },
];

function ListingCard({ item }: { item: Listing }) {
  const gradeColors: Record<string, string> = {
    Premium: '#2E7D32',
    'Grade A': '#558B2F',
    'Grade B': '#F9A825',
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.crop}>{item.crop}</Text>
        <Text style={[styles.grade, { color: gradeColors[item.grade] || '#666' }]}>
          {item.grade}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.price}>KSh {item.price}/kg</Text>
        <Text style={styles.quantity}>{item.quantity} kg available</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.farmer}>{item.farmer}</Text>
        <Text style={styles.location}>{item.location}</Text>
      </View>
    </View>
  );
}

export function ListingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Market Listings</Text>
      <FlatList
        data={mockListings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ListingCard item={item} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
    padding: 16,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crop: {
    fontSize: 18,
    fontWeight: '600',
  },
  grade: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardBody: {
    marginTop: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
  },
  quantity: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  farmer: {
    fontSize: 14,
    color: '#333',
  },
  location: {
    fontSize: 14,
    color: '#888',
  },
});
