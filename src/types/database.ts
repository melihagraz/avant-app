export interface UserProfile {
  id: string;
  email: string;
  name: string;
  age: number;
  gender: string;
  city: string;
  photos: string[];
  seeking: string;
  relationship_type: string;
  age_min: number;
  age_max: number;
  dating_intention?: string;
  family_plans?: string;
  religion?: string;
  education?: string;
  alcohol?: string;
  smoking?: string;
  job?: string;
  prompts?: UserPromptAnswer[];
  is_premium: boolean;
  is_discoverable: boolean;
  last_active_at: string;
  push_token?: string;
  notifications_enabled: boolean;
  created_at: string;
}

export interface UserPromptAnswer {
  key: string;
  answer: string;
}

export interface Agent {
  id: string;
  user_id: string;
  personality: string;
  looking_for: string;
  dealbreakers: string;
  communication_style?: string;
  system_prompt: string;
  created_at: string;
}

export interface AgentConversation {
  id: string;
  agent_a_id: string;
  agent_b_id: string;
  messages: AgentMessage[];
  agent_a_score: number;
  agent_b_score: number;
  compatibility_breakdown: CompatibilityBreakdown;
  verdict: 'match' | 'no_match' | 'uncertain';
  created_at: string;
}

export interface AgentMessage {
  role: 'agent_a' | 'agent_b';
  content: string;
}

export interface CompatibilityBreakdown {
  values: number;
  communication: number;
  lifestyle: number;
  humor: number;
}

export interface Match {
  id: string;
  user_a_id: string;
  user_b_id: string;
  conversation_id: string;
  has_messages: boolean;
  created_at: string;
  // Joined data
  other_user?: UserProfile;
  conversation?: AgentConversation;
  last_message?: HumanMessage;
  unread_count?: number;
}

export interface HumanMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface UserLike {
  id: string;
  liker_id: string;
  liked_id: string;
  action: 'like' | 'super_like' | 'pass';
  comment?: string;
  created_at: string;
}

export interface DiscoverProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  photos: string[];
  prompts?: UserPromptAnswer[];
  agent_score?: number;
  interests?: string[];
  bio?: string;
  job?: string;
  education?: string;
  dating_intention?: string;
}

export interface ProcessLikeResponse {
  success: boolean;
  matched?: boolean;
  match_id?: string;
  other_user?: {
    id: string;
    name: string;
    photos: string[];
  };
  score?: number;
  remaining_likes?: number;
  remaining_super_likes?: number;
}
