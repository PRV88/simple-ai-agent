import io
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple
from openai import AsyncOpenAI
import pypdf

from simple_ai.config import (
    API_KEY,
    BASE_URL,
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
)
from simple_ai.exceptions import ValidationException
from simple_ai.repositories.document_repository import document_repository
from simple_ai.repositories.vector_repository import vector_repository

logger = logging.getLogger("simple_ai.services.et_service")


class ETService:
    """
    ET (Extract & Transform) Ingestion Service:
    Orchestrates document parsing, chunking, embedding generation,
    and delegates storage to DocumentRepository and VectorRepository.
    """

    def __init__(self):
        self.embedding_client = AsyncOpenAI(
            api_key=API_KEY,
            base_url=BASE_URL,
        )
        self.doc_repo = document_repository
        self.vec_repo = vector_repository

    # -------------------------------------------------------------
    # Step 1: Extract
    # -------------------------------------------------------------
    @staticmethod
    def extract_text(file_bytes: bytes, filename: str) -> List[Tuple[str, Dict[str, Any]]]:
        """Extracts text from PDF, Markdown, TXT, CSV, JSON."""
        lower_name = filename.lower()
        extracted_segments: List[Tuple[str, Dict[str, Any]]] = []

        if lower_name.endswith(".pdf"):
            try:
                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                for page_num, page in enumerate(reader.pages, start=1):
                    page_text = page.extract_text() or ""
                    cleaned = page_text.strip()
                    if cleaned:
                        extracted_segments.append(
                            (cleaned, {"page_number": page_num, "source": filename})
                        )
            except Exception as e:
                logger.error(f"Error reading PDF {filename}: {e}")
                raise ValidationException(f"Failed to parse PDF file: {str(e)}")

        elif lower_name.endswith((".txt", ".md", ".markdown", ".csv", ".json")):
            try:
                text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = file_bytes.decode("latin-1", errors="replace")

            cleaned = text.strip()
            if cleaned:
                extracted_segments.append((cleaned, {"source": filename}))

        else:
            try:
                text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = file_bytes.decode("latin-1", errors="replace")
            if text.strip():
                extracted_segments.append((text.strip(), {"source": filename}))

        return extracted_segments

    # -------------------------------------------------------------
    # Step 2: Transform (Chunking)
    # -------------------------------------------------------------
    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = CHUNK_SIZE,
        chunk_overlap: int = CHUNK_OVERLAP,
        base_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Splits raw text into semantically cohesive overlapping chunks."""
        if base_metadata is None:
            base_metadata = {}

        paragraphs = text.split("\n\n")
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_length = 0

        for paragraph in paragraphs:
            p_clean = paragraph.strip()
            if not p_clean:
                continue

            p_len = len(p_clean)

            if p_len > chunk_size:
                lines = p_clean.split("\n")
                for line in lines:
                    l_clean = line.strip()
                    if not l_clean:
                        continue
                    if current_length + len(l_clean) > chunk_size and current_chunk:
                        chunk_str = "\n".join(current_chunk)
                        chunks.append(chunk_str)

                        overlap_chars = chunk_str[-chunk_overlap:] if chunk_overlap > 0 else ""
                        current_chunk = [overlap_chars] if overlap_chars else []
                        current_length = len(overlap_chars)

                    current_chunk.append(l_clean)
                    current_length += len(l_clean)
            else:
                if current_length + p_len > chunk_size and current_chunk:
                    chunk_str = "\n\n".join(current_chunk)
                    chunks.append(chunk_str)

                    overlap_chars = chunk_str[-chunk_overlap:] if chunk_overlap > 0 else ""
                    current_chunk = [overlap_chars] if overlap_chars else []
                    current_length = len(overlap_chars)

                current_chunk.append(p_clean)
                current_length += p_len

        if current_chunk:
            chunk_str = "\n\n".join(current_chunk).strip()
            if chunk_str:
                chunks.append(chunk_str)

        result: List[Dict[str, Any]] = []
        for idx, content in enumerate(chunks):
            chunk_meta = dict(base_metadata)
            chunk_meta.update({
                "chunk_index": idx,
                "char_count": len(content),
            })
            result.append({
                "chunk_index": idx,
                "content": content,
                "metadata": chunk_meta,
            })

        return result

    # -------------------------------------------------------------
    # Step 3: Embed (Vector Generation)
    # -------------------------------------------------------------
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generates 768-dim embeddings in batches using Gemini."""
        if not texts:
            return []

        batch_size = 20
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                response = await self.embedding_client.embeddings.create(
                    model=EMBEDDING_MODEL,
                    input=batch,
                    dimensions=EMBEDDING_DIM,
                )
                batch_vectors = [item.embedding for item in response.data]
                all_embeddings.extend(batch_vectors)
            except Exception as e:
                logger.error(f"Error generating embeddings for batch: {e}")
                raise RuntimeError(f"Embedding generation failed: {str(e)}")

        return all_embeddings

    # -------------------------------------------------------------
    # Step 4: Pipeline Execution (Orchestrates Repositories)
    # -------------------------------------------------------------
    async def ingest_document(
        self,
        filename: str,
        file_bytes: bytes,
        uploaded_by: str = "admin",
        user_id: Optional[int] = None,
        custom_metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, int]:
        """Executes complete ET pipeline for an uploaded document file."""
        if custom_metadata is None:
            custom_metadata = {}

        # 1. Extract
        segments = self.extract_text(file_bytes, filename)
        if not segments:
            raise ValidationException(f"No extractable text found in file '{filename}'.")

        # 2. Transform (Chunk)
        all_chunks: List[Dict[str, Any]] = []
        chunk_counter = 0

        for text_content, seg_meta in segments:
            meta = {
                **custom_metadata,
                **seg_meta,
                "filename": filename,
                "uploaded_by": uploaded_by,
                "user_id": user_id,
            }
            seg_chunks = self.chunk_text(text_content, base_metadata=meta)
            for c in seg_chunks:
                c["chunk_index"] = chunk_counter
                chunk_counter += 1
                all_chunks.append(c)

        if not all_chunks:
            raise ValidationException("File produced 0 chunks after splitting.")

        # 3. Embed
        chunk_texts = [c["content"] for c in all_chunks]
        logger.info(f"Generating embeddings for {len(chunk_texts)} chunks of '{filename}'...")
        embeddings = await self.generate_embeddings(chunk_texts)

        # 4. Load via Repositories
        doc_id = str(uuid.uuid4())
        file_type = filename.split(".")[-1].lower() if "." in filename else "unknown"
        file_size = len(file_bytes)

        await self.doc_repo.create_document(
            doc_id=doc_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            total_chunks=len(all_chunks),
            uploaded_by=uploaded_by,
            user_id=user_id,
            status="processed",
        )

        await self.vec_repo.insert_chunks_batch(
            doc_id=doc_id,
            chunks=all_chunks,
            embeddings=embeddings,
        )

        logger.info(f"Successfully ingested '{filename}' (ID: {doc_id}) with {len(all_chunks)} chunks.")
        return doc_id, len(all_chunks)

    async def ingest_raw_text(
        self,
        title: str,
        content: str,
        uploaded_by: str = "admin",
        user_id: Optional[int] = None,
        custom_metadata: Optional[Dict[str, Any]] = None,
    ) -> Tuple[str, int]:
        """Ingests direct text / documentation note into pgvector."""
        file_bytes = content.encode("utf-8")
        filename = f"{title}.txt" if not title.endswith((".txt", ".md")) else title
        return await self.ingest_document(
            filename=filename,
            file_bytes=file_bytes,
            uploaded_by=uploaded_by,
            user_id=user_id,
            custom_metadata=custom_metadata,
        )


et_service = ETService()
