export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: string;
}

export interface AdminStats {
  total_users: number;
  total_documents: number;
  total_chunks: number;
  vector_dimension: number;
  pgvector_status: string;
}

export interface IngestedDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  total_chunks: number;
  uploaded_by: string;
  status: string;
  created_at: string;
}

export interface ChunkDetail {
  id: number;
  doc_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  id: number;
  doc_id: string;
  filename: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface Citation {
  source: string;
  similarity: number;
  content_preview: string;
  chunk_index?: number;
}

export interface ChatMessage {
  sender: "user" | "agent";
  text: string;
  citations?: Citation[];
}

export interface ToastMessage {
  message: string;
  isError?: boolean;
}

export interface McpServerConfig {
  name: string;
  url: string;
  enabled: boolean;
  description?: string;
}

export interface AgentConfig {
  id: string;
  user_id: number;
  name: string;
  title: string;
  welcome_message: string;
  system_prompt: string;
  guardrails?: string;
  model_name: string;
  max_output_tokens: number;
  monthly_token_budget: number;
  temperature: number;
  brand_color: string;
  starter_prompts: string[];
  mcp_servers: McpServerConfig[];
  is_deployed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenUsageRecord {
  id: number;
  created_at: string;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  source: string;
}

export interface TokenUsageSummary {
  agent_id: string;
  model_name: string;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  monthly_budget: number;
  budget_used_percentage: number;
  recent_records: TokenUsageRecord[];
}

export type TabKey =
  | "ingest"
  | "search"
  | "documents"
  | "chat"
  | "agent"
  | "widget"
  | "analytics";
