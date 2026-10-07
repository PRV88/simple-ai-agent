import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select

from simple_ai.database import get_db
from simple_ai.models.db_models import DocumentChunkModel, DocumentModel

logger = logging.getLogger("simple_ai.repositories.document")


class DocumentRepository:
    """Repository handling all document catalog metadata using SQLAlchemy 2.0 ORM."""

    async def create_document(
        self,
        doc_id: str,
        filename: str,
        file_type: str,
        file_size: int,
        total_chunks: int,
        uploaded_by: str = "admin",
        user_id: Optional[int] = None,
        status: str = "processed",
    ) -> Dict[str, Any]:
        """Creates a document record using SQLAlchemy ORM entity with user_id scoping."""
        async with get_db() as session:
            doc = DocumentModel(
                id=doc_id,
                filename=filename,
                file_type=file_type,
                file_size=file_size,
                total_chunks=total_chunks,
                uploaded_by=uploaded_by,
                user_id=user_id,
                status=status,
            )
            session.add(doc)
            await session.commit()
            await session.refresh(doc)
            return doc.to_dict()

    async def list_documents(
        self, user_id: Optional[int] = None, uploaded_by: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Lists documents sorted by creation date with optional user_id scoping."""
        async with get_db() as session:
            stmt = select(DocumentModel).order_by(DocumentModel.created_at.desc())
            if user_id is not None:
                stmt = stmt.where(DocumentModel.user_id == user_id)
            elif uploaded_by:
                stmt = stmt.where(DocumentModel.uploaded_by == uploaded_by)
            result = await session.execute(stmt)
            docs = result.scalars().all()
            return [d.to_dict() for d in docs]

    async def find_by_id(
        self, doc_id: str, user_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """Finds document by primary key ID and strictly verifies ownership."""
        async with get_db() as session:
            doc = await session.get(DocumentModel, doc_id)
            if not doc:
                return None
            if user_id is not None and doc.user_id != user_id:
                return None
            return doc.to_dict()

    async def get_chunks_by_doc_id(
        self, doc_id: str, user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Fetches all chunk texts and metadata for a document scoped to owner."""
        async with get_db() as session:
            if user_id is not None:
                doc = await session.get(DocumentModel, doc_id)
                if not doc or doc.user_id != user_id:
                    return []
            stmt = (
                select(DocumentChunkModel)
                .where(DocumentChunkModel.doc_id == doc_id)
                .order_by(DocumentChunkModel.chunk_index.asc())
            )
            result = await session.execute(stmt)
            chunks = result.scalars().all()
            return [c.to_dict() for c in chunks]

    async def delete_document(
        self, doc_id: str, user_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Deletes a document with strict user ownership check.
        SQLAlchemy ORM relationship cascade automatically deletes associated vector chunks.
        """
        async with get_db() as session:
            doc = await session.get(DocumentModel, doc_id)
            if not doc:
                return None
            if user_id is not None and doc.user_id != user_id:
                return None
            info = {"id": doc.id, "filename": doc.filename}
            await session.delete(doc)
            await session.commit()
            return info

    async def count_documents(self, user_id: Optional[int] = None) -> int:
        """Counts total documents scoped to user."""
        async with get_db() as session:
            stmt = select(func.count(DocumentModel.id))
            if user_id is not None:
                stmt = stmt.where(DocumentModel.user_id == user_id)
            result = await session.execute(stmt)
            return result.scalar_one() or 0


document_repository = DocumentRepository()
