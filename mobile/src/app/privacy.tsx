import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { Text } from '../components/primitives/Text';
import { colors, spacing, radius, shadows } from '@/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t, isSwahili } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel={t('back')}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
        </TouchableOpacity>
        <Text variant="heading4" style={{ color: colors.primary[900] }}>
          {t('privacy_policy')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption" color="secondary" style={{ marginBottom: spacing[4] }}>
          {t('last_updated_date')}
        </Text>

        <View style={styles.intro}>
          <Text variant="body" style={{ lineHeight: 24 }}>
            {isSwahili
              ? 'SunHarvest Connect inajali faragha yako. Sera hii inaeleza jinsi tunavyokusanya, kutumia, na kulinda data yako chini ya Sheria ya Ulinzi wa Data ya Kenya 2019.'
              : 'SunHarvest Connect values your privacy. This policy explains how we collect, use, and protect your data under the Kenya Data Protection Act 2019.'}
          </Text>
        </View>

        {/* Section 1: Data Collection */}
        <View style={styles.section}>
          <Text variant="heading4" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
            {isSwahili ? '1. Data Tunayokusanya' : '1. Data We Collect'}
          </Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>
            {isSwahili
              ? '- Jina lako, nambari ya simu, na eneo\n- Picha za mazao unazopakia kwa upimaji ubora\n- Historia ya miamala na shughuli za soko\n- Maelezo ya kifaa na matumizi ya programu'
              : '- Your name, phone number, and location\n- Photos of produce you upload for quality grading\n- Transaction history and marketplace activity\n- Device information and app usage data'}
          </Text>
        </View>

        {/* Section 2: How We Use Data */}
        <View style={styles.section}>
          <Text variant="heading4" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
            {isSwahili ? '2. Jinsi Tunavyotumia Data' : '2. How We Use Your Data'}
          </Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>
            {isSwahili
              ? '- Kupima ubora wa mazao kwa AI\n- Kukuunganisha na wanunuzi na wasafirishaji\n- Kutoa bei za soko na mwelekeo\n- Kuboresha huduma zetu\n- Kutuma arifa muhimu za shughuli'
              : '- AI-powered quality grading of your produce\n- Connecting you with buyers and transporters\n- Providing market prices and trends\n- Improving our services\n- Sending important transaction notifications'}
          </Text>
        </View>

        {/* Section 3: Data Sharing */}
        <View style={styles.section}>
          <Text variant="heading4" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
            {isSwahili ? '3. Kushiriki Data' : '3. Data Sharing'}
          </Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>
            {isSwahili
              ? 'Tunashiriki data yako tu na:\n- Wanunuzi na wasafirishaji unapofanya biashara nao\n- Huduma za malipo kwa kumaliza miamala\n- Mamlaka za kisheria zinapohitajika kisheria\n\nHatauzi data yako kwa watu wengine.'
              : 'We share your data only with:\n- Buyers and transporters when you transact with them\n- Payment services to complete transactions\n- Legal authorities when required by law\n\nWe never sell your data to third parties.'}
          </Text>
        </View>

        {/* Section 4: Your Rights */}
        <View style={styles.section}>
          <Text variant="heading4" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
            {isSwahili ? '4. Haki Zako (DPA 2019)' : '4. Your Rights (DPA 2019)'}
          </Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>
            {isSwahili
              ? 'Chini ya Sheria ya Ulinzi wa Data ya Kenya, una haki ya:\n\n- Kufikia data yako tunayoshikilia\n- Kusahihisha taarifa zisizo sahihi\n- Kufuta akaunti yako na data\n- Kupinga uchakataji wa data yako\n- Kupokea nakala ya data yako'
              : 'Under the Kenya Data Protection Act, you have the right to:\n\n- Access your data we hold\n- Correct inaccurate information\n- Delete your account and data\n- Object to processing of your data\n- Receive a copy of your data'}
          </Text>
        </View>

        {/* Section 5: Data Security */}
        <View style={styles.section}>
          <Text variant="heading4" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
            {isSwahili ? '5. Usalama wa Data' : '5. Data Security'}
          </Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>
            {isSwahili
              ? 'Tunalinda data yako kwa:\n- Uandikishaji wa data wakati wa usafirishaji\n- Uhifadhi salama wa nywila (PIN)\n- Udhibiti wa upatikanaji kwa wafanyakazi\n- Ukaguzi wa mara kwa mara wa usalama'
              : 'We protect your data with:\n- Encryption of data in transit\n- Secure password (PIN) storage\n- Access controls for staff\n- Regular security audits'}
          </Text>
        </View>

        {/* Section 6: Data Retention */}
        <View style={styles.section}>
          <Text variant="heading4" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
            {isSwahili ? '6. Uhifadhi wa Data' : '6. Data Retention'}
          </Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>
            {isSwahili
              ? 'Tunashikilia data yako kwa muda unaohitajika kutoa huduma zetu. Historia ya miamala huhifadhiwa kwa miaka 7 kwa mahitaji ya kisheria. Ukifuta akaunti yako, tutafuta data yako ya kibinafsi ndani ya siku 30.'
              : 'We retain your data for as long as needed to provide our services. Transaction history is kept for 7 years for legal requirements. If you delete your account, we will erase your personal data within 30 days.'}
          </Text>
        </View>

        {/* Section 7: Contact */}
        <View style={styles.section}>
          <Text variant="heading4" style={{ color: colors.primary[900], marginBottom: spacing[2] }}>
            {isSwahili ? '7. Wasiliana Nasi' : '7. Contact Us'}
          </Text>
          <Text variant="bodySmall" style={{ lineHeight: 22 }}>
            {isSwahili
              ? 'Kwa maswali kuhusu data yako au sera hii:'
              : 'For questions about your data or this policy:'}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.primary[800], marginTop: spacing[1] }}>
            {isSwahili ? 'Barua pepe' : 'Email'}: privacy@sunharvest.co.ke
          </Text>
          <Text variant="bodySmall" style={{ color: colors.primary[800], marginTop: spacing[1] }}>
            {isSwahili ? 'Simu' : 'Phone'}: +254 700 123 456
          </Text>
          <Text variant="bodySmall" style={{ color: colors.primary[800], marginTop: spacing[1] }}>
            {isSwahili ? 'Ofisi ya Ulinzi wa Data Kenya' : 'Office of Data Protection Commissioner'}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text variant="caption" color="secondary" style={{ textAlign: 'center', fontStyle: 'italic' }}>
            {isSwahili
              ? 'Kwa kutumia SunHarvest Connect, unakubali sera hii.'
              : 'By using SunHarvest Connect, you agree to this policy.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing[5],
  },
  intro: {
    backgroundColor: colors.primary[50],
    padding: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[6],
  },
  footer: {
    backgroundColor: colors.neutral[100],
    padding: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[10],
  },
});
