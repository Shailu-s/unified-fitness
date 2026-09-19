import { useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { HomeScreen } from './HomeScreen';
import { LogScreen } from './LogScreen';

// Home and Log side by side. Swipe left from Home to reach Log.
export function MainScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pager = useRef<ScrollView>(null);
  const [pageHeight, setPageHeight] = useState(0);

  const page = { width, height: pageHeight, paddingTop: insets.top + 14 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
      >
        {pageHeight > 0 && (
          <>
            <View style={page}>
              <HomeScreen onOpenLog={() => pager.current?.scrollTo({ x: width, animated: true })} />
            </View>
            <View style={page}>
              <LogScreen />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
