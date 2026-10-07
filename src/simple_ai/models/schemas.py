from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


# ==========================================
# Authentication & User Schemas
# ==========================================

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Username for admin")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, description="Password (at least 6 characters)")
    full_name: Optional[str] = Field(None, max_length=100, description="Full name of admin")
    role: str = Field("admin", description="Role (defaults to admin)")


class UserLoginRequest(BaseModel):
    username_or_email: str = Field(..., description="Username or email")
    password: str = Field(..., description="Password")


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ==========================================
# Document & Knowledge Ingestion Schemas
# ==========================================

class IngestTextRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Title of the document / knowledge note")
    content: str = Field(..., min_length=1, description="Raw text content to ingest")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Custom metadata tags")


class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    total_chunks: int
    uploaded_by: Optional[str] = None
    status: str
    created_at: datetime


class DocumentChunkDetail(BaseModel):
    id: int
    doc_id: str
    chunk_index: int
    content: str
    metadata: Dict[str, Any]


class DocumentDetailResponse(DocumentResponse):
    chunks: List[DocumentChunkDetail] = []


class VectorSearchResult(BaseModel):
    id: int
    doc_id: str
    filename: str
    chunk_index: int
    content: str
    metadata: Dict[str, Any]
    similarity: float


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Search query or question")
    top_k: int = Field(5, ge=1, le=50, description="Number of results to retrieve")
    min_score: float = Field(0.0, ge=0.0, le=1.0, description="Minimum cosine similarity threshold")


class IngestionResponse(BaseModel):
    success: bool
    message: str
    doc_id: str
    filename: str
    total_chunks: int
    file_size: int


class AdminStatsResponse(BaseModel):
    total_users: int
    total_documents: int
    total_chunks: int
    vector_dimension: int
    pgvector_status: str


# ==========================================
# Chat & Agent Schemas
# ==========================================

class ChatRequest(BaseModel):
    query: Optional[str] = Field(None, description="User search query or question")
    message: Optional[str] = Field(None, description="Alternative alias for query")
    use_knowledge_base: bool = Field(True, description="Whether to augment response with vector DB retrieval")
    top_k: int = Field(3, ge=1, le=50, description="Top K relevant chunks to retrieve")
    min_score: float = Field(0.35, ge=0.0, le=1.0, description="Minimum cosine similarity threshold")

    def get_query(self) -> str:
        return (self.query or self.message or "").strip()


# ==========================================
# Agent Configuration & Studio Schemas
# ==========================================

class MCPServerConfig(BaseModel):
    name: str = Field(..., description="Display name for the MCP server")
    url: str = Field(..., description="SSE / HTTP endpoint of the MCP server")
    enabled: bool = Field(True, description="Whether this MCP server is active")


class AgentConfigResponse(BaseModel):
    id: str
    user_id: int
    name: str
    title: Optional[str] = None
    welcome_message: str
    system_prompt: str
    guardrails: Optional[str] = ""
    model_name: str
    max_output_tokens: int
    monthly_token_budget: int
    temperature: float
    brand_color: str
    starter_prompts: List[str]
    mcp_servers: List[Dict[str, Any]]
    is_deployed: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AgentConfigUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    welcome_message: Optional[str] = Field(None, min_length=1)
    system_prompt: Optional[str] = Field(None, min_length=1)
    guardrails: Optional[str] = Field(None)
    model_name: Optional[str] = Field(None)
    max_output_tokens: Optional[int] = Field(None, ge=128, le=8192)
    monthly_token_budget: Optional[int] = Field(None, ge=1000)
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    brand_color: Optional[str] = Field(None, max_length=30)
    starter_prompts: Optional[List[str]] = Field(None)
    mcp_servers: Optional[List[Dict[str, Any]]] = Field(None)
    is_deployed: Optional[bool] = Field(None)


# ==========================================
# Public Embeddable Widget Schemas
# ==========================================

class WidgetConfigResponse(BaseModel):
    agent_id: str
    title: str
    welcome_message: str
    brand_color: str
    starter_prompts: List[str]
    model_name: str
    is_deployed: bool


class WidgetChatRequest(BaseModel):
    agent_id: str = Field(..., description="Agent ID to chat with")
    query: str = Field(..., min_length=1, description="Visitor question")
    session_id: Optional[str] = Field(None, description="Persistent visitor session ID")
    use_knowledge_base: bool = Field(True, description="Ground with pgvector")


# ==========================================
# Token Usage & Cost Analytics Schemas
# ==========================================

class TokenUsageRecordResponse(BaseModel):
    id: int
    agent_id: str
    session_id: str
    model_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    source: str
    created_at: Optional[str] = None


class TokenUsageSummaryResponse(BaseModel):
    agent_id: str
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    total_requests: int
    monthly_budget: int
    budget_used_percentage: float
    recent_records: List[TokenUsageRecordResponse] = []


# ==========================================
# Ragas Evaluation Schemas
# ==========================================

class RagasTestCase(BaseModel):
    question: str
    ground_truth: Optional[str] = None


class RagasEvaluateRequest(BaseModel):
    test_cases: Optional[List[RagasTestCase]] = None


class RagasEvaluateResponse(BaseModel):
    total_samples: int
    summary_scores: Dict[str, float]
    breakdown: List[Dict[str, Any]] = []


