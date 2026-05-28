import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { aiApi, AssetRecognitionResult } from '../../services/aiApi';

export default function ReviewScreen() {
  const router = useRouter();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiResult, setAiResult] = useState<AssetRecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (imageUri) {
      recognizeAsset();
    }
  }, [imageUri]);

  const recognizeAsset = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await aiApi.recognizeAsset(imageUri);

      setAiResult(result);
      setName(result.name.value || '');
      setBrand(result.brand.value || '');
      setModel(result.model.value || '');
      setCategory(result.category.value || '');

      if (result.fallbackSuggested) {
        setError('AI recognition has low confidence. Please verify the details.');
      }
    } catch (err: any) {
      console.error('AI recognition error:', err);
      setError(err.message || 'Failed to recognize asset');

      // Set default values on error
      setName('');
      setBrand('');
      setModel('');
      setCategory('');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !category.trim()) {
      Alert.alert('Validation Error', 'Name and category are required');
      return;
    }

    setSaving(true);

    try {
      // TODO: Save to inventory API
      // For now, just show success
      Alert.alert(
        'Success',
        'Asset saved to inventory!',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(app)'),
          },
        ]
      );
    } catch (err: any) {
      console.error('Save error:', err);
      Alert.alert('Error', 'Failed to save asset. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    router.back();
  };

  if (!imageUri) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No image selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Save</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>AI is analyzing your asset...</Text>
          <Text style={styles.loadingSubtext}>This should take less than 3 seconds</Text>
        </View>
      ) : (
        <View style={styles.form}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {error}</Text>
              <Text style={styles.errorBannerSubtext}>
                Please fill in the details manually
              </Text>
            </View>
          )}

          {aiResult && !error && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>
                ✓ AI detected your asset in {aiResult.latencyMs}ms
              </Text>
              <Text style={styles.successBannerSubtext}>
                Name: {Math.round(aiResult.name.confidence * 100)}% •
                Category: {Math.round(aiResult.category.confidence * 100)}%
              </Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Asset Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., iPhone 14 Pro"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g., Apple"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              value={model}
              onChangeText={setModel}
              placeholder="e.g., A2890"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category *</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g., Electronics"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetake}
              disabled={saving}
            >
              <Text style={styles.retakeButtonText}>Retake Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save to Inventory</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    fontSize: 24,
    color: '#000',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    padding: 24,
  },
  form: {
    padding: 24,
  },
  errorBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  errorBannerSubtext: {
    fontSize: 12,
    color: '#856404',
    marginTop: 4,
  },
  successBanner: {
    backgroundColor: '#D4EDDA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  successBannerText: {
    fontSize: 14,
    color: '#155724',
    fontWeight: '500',
  },
  successBannerSubtext: {
    fontSize: 12,
    color: '#155724',
    marginTop: 4,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  retakeButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
