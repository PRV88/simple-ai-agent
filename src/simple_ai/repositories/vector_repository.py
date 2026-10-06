import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select, text

from simple_ai.database import get_vector_db
from simple_ai.models.db_models import DocumentChunkModel, DocumentModel

logger = logging.getLogger("simple_ai.repositories.vector")


class VectorRepository:
    """
    Repository handling all vector storage and semantic search operations
    using SQLAlchemy 2.0 with pgvector.sqlalchemy native distance functions.
    """

    async def insert_chunks_batch(
        self,
        doc_id: str,
        chunks: List[Dict[str, Any]],
        embeddings: List[List[float]],
    ) -> None:
        """Persists chunks and vector embeddings using SQLAlchemy session.add_all()."""
        async with get_vector_db() as session:
            chunk_models = [
                DocumentChunkModel(
                    doc_id=doc_id,
                    chunk_index=chunk["chunk_index"],
                    content=chunk["content"],
                    embedding=vec,
                    chunk_metadata=chunk.get("metadata", {}),
                )
                for chunk, vec in zip(chunks, embeddings)
            ]
            session.add_all(chunk_models)
            await session.commit()

    async def cosine_similarity_search(
        self,
        query_vec: List[float],
        top_k: int = 5,
        min_score: float = 0.0,
        user_id: Optional[int] = None,
        uploaded_by: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Executes semantic search using native pgvector.sqlalchemy cosine_distance() operator:
        Calculates similarity = 1 - cosine_distance(query_vec) scoped by user_id.
        """
        async with get_vector_db() as session:
            distance_expr = DocumentChunkModel.embedding.cosine_distance(query_vec)
            similarity_expr = (1 - distance_expr).label("similarity")

            stmt = (
                select(
                    DocumentChunkModel,
                    DocumentModel.filename,
                    DocumentModel.uploaded_by,
                    similarity_expr,
                )
                .join(DocumentModel, DocumentChunkModel.doc_id == DocumentModel.id)
                .where(similarity_expr >= min_score)
            )

            if user_id is not None:
                stmt = stmt.where(DocumentModel.user_id == user_id)
            elif uploaded_by:
                stmt = stmt.where(DocumentModel.uploaded_by == uploaded_by)

            stmt = stmt.order_by(distance_expr.asc()).limit(top_k)

            result = await session.execute(stmt)
            rows = result.all()

            results: List[Dict[str, Any]] = []
            for chunk_row, filename, uploader, similarity in rows:
                results.append({
                    "id": chunk_row.id,
                    "doc_id": chunk_row.doc_id,
                    "filename": filename,
                    "uploaded_by": uploader,
                    "chunk_index": chunk_row.chunk_index,
                    "content": chunk_row.content,
                    "metadata": chunk_row.chunk_metadata,
                    "similarity": round(float(similarity), 4),
                })
            return results

    async def count_chunks(self, user_id: Optional[int] = None) -> int:
        """Counts total indexed vector chunks scoped to user."""
        async with get_vector_db() as session:
            if user_id is not None:
                stmt = (
                    select(func.count(DocumentChunkModel.id))
                    .join(DocumentModel, DocumentChunkModel.doc_id == DocumentModel.id)
                    .where(DocumentModel.user_id == user_id)
                )
            else:
                stmt = select(func.count(DocumentChunkModel.id))
            result = await session.execute(stmt)
            return result.scalar_one() or 0

    async def get_pgvector_status(self) -> str:
        """Inspects pgvector extension metadata."""
        async with get_vector_db() as session:
            res = await session.execute(
                text("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
            )
            row = res.fetchone()
            return f"active (v{row[0]})" if row else "not installed"


vector_repository = VectorRepository()
