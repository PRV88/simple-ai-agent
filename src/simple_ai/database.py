import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from simple_ai.config import DATABASE_URL, VECTOR_DATABASE_URL, settings
from simple_ai.models.db_models import Base

logger = logging.getLogger("simple_ai.database")


def to_async_url(url: str) -> str:
    """Ensures connection string uses the psycopg async dialect."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


# SQLAlchemy 2.0 Async Engines
relational_engine: Optional[AsyncEngine] = None
vector_engine: Optional[AsyncEngine] = None

# Async Session Factories
relational_session_factory: Optional[async_sessionmaker[AsyncSession]] = None
vector_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_relational_engine() -> AsyncEngine:
    """Returns singleton SQLAlchemy engine for relational PostgreSQL data."""
    global relational_engine, relational_session_factory
    if relational_engine is None:
        relational_engine = create_async_engine(
            to_async_url(DATABASE_URL),
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            echo=settings.DEBUG,
        )
        relational_session_factory = async_sessionmaker(
            bind=relational_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return relational_engine


def get_vector_engine() -> AsyncEngine:
    """Returns singleton SQLAlchemy engine for pgvector semantic search."""
    global vector_engine, vector_session_factory
    # If pointing to the same instance, reuse relational engine
    if VECTOR_DATABASE_URL == DATABASE_URL:
        get_relational_engine()
        vector_engine = relational_engine
        vector_session_factory = relational_session_factory
        return vector_engine

    if vector_engine is None:
        vector_engine = create_async_engine(
            to_async_url(VECTOR_DATABASE_URL),
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            echo=settings.DEBUG,
        )
        vector_session_factory = async_sessionmaker(
            bind=vector_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return vector_engine


@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency / context manager yielding an AsyncSession for relational operations."""
    get_relational_engine()
    assert relational_session_factory is not None
    async with relational_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def get_vector_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency / context manager yielding an AsyncSession for pgvector operations."""
    get_vector_engine()
    assert vector_session_factory is not None
    async with vector_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """
    Initializes PostgreSQL database using SQLAlchemy 2.0 ORM:
    1. Ensures pgvector extension is enabled
    2. Synchronizes all declarative ORM tables (Users, Documents, DocumentChunks, ChatHistory)
    3. Builds HNSW vector index
    """
    logger.info("Initializing SQLAlchemy 2.0 ORM engines and pgvector schema...")

    # Enable pgvector extension
    v_engine = get_vector_engine()
    async with v_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

    # Create all ORM tables through SQLAlchemy Metadata
    r_engine = get_relational_engine()
    async with r_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id INTEGER;"))
        await conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails TEXT DEFAULT '';"))
        # Backfill document user_id for any legacy unassigned documents
        await conn.execute(text("""
            UPDATE documents d
            SET user_id = u.id
            FROM users u
            WHERE d.user_id IS NULL
              AND (LOWER(d.uploaded_by) = LOWER(u.username) OR LOWER(d.uploaded_by) = LOWER(u.email));
        """))
        # Add index for fast multi-tenant document queries
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);"))

    # If vector engine is on a separate database, ensure tables on vector database too
    if VECTOR_DATABASE_URL != DATABASE_URL:
        async with v_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Ensure HNSW vector index exists for lightning fast similarity queries
    async with v_engine.begin() as conn:
        try:
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chunks_embedding 
                ON document_chunks USING hnsw (embedding vector_cosine_ops);
            """))
        except Exception as idx_err:
            logger.warning(f"Note on HNSW index initialization: {idx_err}")

    logger.info("SQLAlchemy 2.0 ORM tables and pgvector indexes initialized successfully.")


async def close_db_pool() -> None:
    """Disposes of SQLAlchemy engines cleanly on shutdown."""
    global relational_engine, vector_engine
    if relational_engine:
        await relational_engine.dispose()
        relational_engine = None
    if vector_engine and vector_engine != relational_engine:
        await vector_engine.dispose()
        vector_engine = None
    logger.info("SQLAlchemy database engines disposed.")
