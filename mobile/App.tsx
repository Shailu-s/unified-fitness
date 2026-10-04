import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { MainScreen } from './src/screens/MainScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { colors } from './src/theme';

function Root() {
  const { profile, ready, storageError, retryStorage } = useApp();
  if (storageError || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center', padding: 32, gap: 20 }}>
        {storageError ? (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.ink }}>{storageError}</Text>
            <Pressable onPress={retryStorage} accessibilityRole="button" style={{ padding: 16 }}>
              <Text style={{ color: colors.protein }}>Retry local storage</Text>
            </Pressable>
          </>
        ) : <ActivityIndicator accessibilityLabel="Opening saved logs" color={colors.ink} />}
      </View>
    );
  }
  return profile ? <MainScreen /> : <OnboardingScreen />;
}

export default function App() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  // Paper-coloured hold so there is no white flash while fonts load.
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
