import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, Fonts } from '../../src/theme';

function DiscoverIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.5l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.6z"
        stroke={color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function ChatIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.5} />
      <Path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Kesfet',
          tabBarIcon: ({ color }) => <DiscoverIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="chatlist"
        options={{
          title: 'Sohbet',
          tabBarIcon: ({ color }) => <ChatIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
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
    height: 88,
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
