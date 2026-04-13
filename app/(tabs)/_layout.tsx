import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, Fonts } from '../../src/theme';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? Colors.gold : 'rgba(255,255,255,0.4)';

  if (name === 'discover') {
    return (
      <View style={styles.tabItem}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.5l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.6z"
            stroke={color}
            strokeWidth={1.5}
          />
        </Svg>
        <Text style={[styles.tabLabel, focused && { color: Colors.gold }]}>Kesfet</Text>
      </View>
    );
  }

  if (name === 'chatlist') {
    return (
      <View style={styles.tabItem}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={[styles.tabLabel, focused && { color: Colors.gold }]}>Sohbet</Text>
      </View>
    );
  }

  // profile
  return (
    <View style={styles.tabItem}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.5} />
        <Path
          d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.tabLabel, focused && { color: Colors.gold }]}>Profil</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="discover" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chatlist"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="chatlist" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(13,13,20,0.97)',
    borderTopWidth: 1,
    borderTopColor: Colors.white07,
    height: 85,
    paddingBottom: 28,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  tabLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.4,
  },
});
