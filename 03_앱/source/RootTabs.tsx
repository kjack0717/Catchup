// navigation/RootTabs.tsx — 하단 4탭(스와이프+터치 병행)
// material-top-tabs 를 tabBarPosition="bottom" 으로 두어 스와이프와 탭 터치를 동시 지원.

import React from 'react';
import { View, Text } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../theme/tokens';
import HomeDashboard from '../screens/HomeDashboard';
import { CommunityScreen, AdmissionScreen, ProfileScreen } from '../screens/Placeholders';

const Tab = createMaterialTopTabNavigator();

// 아이콘 + (커뮤니티 한정) 쪽지 뱃지
function TabIcon({ emoji, focused, badge }: { emoji: string; focused: boolean; badge?: number }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
      {!!badge && badge > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -12, minWidth: 16, height: 16, paddingHorizontal: 4,
          borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function RootTabs({ unreadDM = 0 }: { unreadDM?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', textTransform: 'none', marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line, borderTopWidth: 1,
          paddingBottom: insets.bottom, height: 56 + insets.bottom,
        },
        tabBarIndicatorStyle: { backgroundColor: colors.accent, height: 2, top: 0 }, // 상단 얇은 주홍선
        tabBarShowIcon: true,
      }}
    >
      <Tab.Screen name="나의 학교" component={HomeDashboard}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏫" focused={focused} /> }} />
      <Tab.Screen name="입시 정보" component={AdmissionScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🎓" focused={focused} /> }} />
      <Tab.Screen name="커뮤니티" component={CommunityScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} badge={unreadDM} /> }} />
      <Tab.Screen name="내 프로필" component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}
