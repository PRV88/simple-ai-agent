import datetime
from typing import Any, Dict, List, Optional
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from simple_ai.config import EMBEDDING_DIM


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 Declarative Base."""
    pass


class UserModel(Base):
    """Relational User Account Model."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="admin", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Optional relationships
    documents: Mapped[List["DocumentModel"]] = relationship(
        "DocumentModel", back_populates="uploader", cascade="all, delete-orphan", lazy="selectin"
    )
    agent: Mapped[Optional["AgentModel"]] = relationship(
        "AgentModel", back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "password_hash": self.password_hash,
            "full_name": self.full_name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at,
        }


class DocumentModel(Base):
    """Relational Document Catalog Metadata Model."""
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    total_chunks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    uploaded_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), default="processed", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    uploader: Mapped[Optional["UserModel"]] = relationship("UserModel", back_populates="documents")
    chunks: Mapped[List["DocumentChunkModel"]] = relationship(
        "DocumentChunkModel", back_populates="document", cascade="all, delete-orphan", lazy="selectin"
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "filename": self.filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "total_chunks": self.total_chunks,
            "uploaded_by": self.uploaded_by,
            "status": self.status,
            "created_at": self.created_at,
        }


class DocumentChunkModel(Base):
    """Vector Embeddings & Semantic Search Chunk Model (pgvector)."""
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    chunk_metadata: Mapped[Dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, server_default="{}", nullable=False
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    document: Mapped["DocumentModel"] = relationship("DocumentModel", back_populates="chunks")

    __table_args__ = (
        Index(
            "idx_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("idx_chunks_doc_id", "doc_id"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "doc_id": self.doc_id,
            "chunk_index": self.chunk_index,
            "content": self.content,
            "metadata": self.chunk_metadata,
            "created_at": self.created_at,
        }


class ChatHistoryModel(Base):
    """Relational Conversation History Model."""
    __tablename__ = "chat_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AgentModel(Base):
    """Configurable AI Agent & Deployment Settings Model."""
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), default="Simple AI Assistant", nullable=False)
    welcome_message: Mapped[str] = mapped_column(
        Text,
        default="Hello! I am your AI knowledge assistant grounded in your documents. How can I help you today?",
        nullable=False,
    )
    system_prompt: Mapped[str] = mapped_column(
        Text,
        default="You are a professional, helpful enterprise AI assistant. Answer queries grounded strictly in the provided knowledge base context.",
        nullable=False,
    )
    model_name: Mapped[str] = mapped_column(String(100), default="gemini-2.5-flash", nullable=False)
    max_output_tokens: Mapped[int] = mapped_column(Integer, default=1024, nullable=False)
    monthly_token_budget: Mapped[int] = mapped_column(Integer, default=1000000, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    brand_color: Mapped[str] = mapped_column(String(30), default="#4f46e5", nullable=False)
    starter_prompts: Mapped[List[str]] = mapped_column(
        JSONB,
        default=lambda: [
            "What is our company security policy?",
            "What is the database backup standard?",
            "Summarize key compliance rules",
        ],
        server_default='["What is our company security policy?", "What is the database backup standard?", "Summarize key compliance rules"]',
        nullable=False,
    )
    mcp_servers: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB,
        default=list,
        server_default="[]",
        nullable=False,
    )
    guardrails: Mapped[str] = mapped_column(
        Text,
        default="",
        server_default="",
        nullable=False,
    )
    is_deployed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["UserModel"] = relationship("UserModel", back_populates="agent")
    usage_records: Mapped[List["AgentTokenUsageModel"]] = relationship(
        "AgentTokenUsageModel", back_populates="agent", cascade="all, delete-orphan", lazy="selectin"
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "title": self.name,
            "welcome_message": self.welcome_message,
            "system_prompt": self.system_prompt,
            "guardrails": self.guardrails or "",
            "model_name": self.model_name,
            "max_output_tokens": self.max_output_tokens,
            "monthly_token_budget": self.monthly_token_budget,
            "temperature": self.temperature,
            "brand_color": self.brand_color,
            "starter_prompts": self.starter_prompts,
            "mcp_servers": self.mcp_servers,
            "is_deployed": self.is_deployed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AgentTokenUsageModel(Base):
    """Tracks token consumption and computed cost per query/session."""
    __tablename__ = "agent_token_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="playground", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    agent: Mapped["AgentModel"] = relationship("AgentModel", back_populates="usage_records")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "model_name": self.model_name,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "cost_usd": self.cost_usd,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
