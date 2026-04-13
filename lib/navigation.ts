import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: undefined;
  Welcome: undefined;
  Onboarding: undefined;
  Main: undefined;
  Discover: undefined;
  Explore: undefined;
  AgentMatches: undefined;
  Home: undefined;
  HumanChat: { matchId: string; otherUser: any };
  AgentLog: { conversationId: string; otherUser: any };
  Profile: undefined;
  ProfileDetail: { userId: string };
  MatchReveal: { matchId: string; otherUser: any };
  AgentMatchDetail: { matchId: string; otherUserId: string; otherUser?: any };
  Filter: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type AppRouteProp<T extends keyof RootStackParamList> = RouteProp<RootStackParamList, T>;

export function useAppNavigation() {
  return useNavigation<AppNavigationProp>();
}

export function useAppRoute<T extends keyof RootStackParamList>() {
  return useRoute<AppRouteProp<T>>();
}
