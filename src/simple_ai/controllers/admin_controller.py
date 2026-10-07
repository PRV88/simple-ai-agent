import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from simple_ai.config import EMBEDDING_DIM
from simple_ai.exceptions import NotFoundException, ValidationException
from simple_ai.models import (
    AdminStatsResponse,
    AgentConfigResponse,
    AgentConfigUpdateRequest,
    DocumentDetailResponse,
    DocumentResponse,
    IngestTextRequest,
    IngestionResponse,
    QueryRequest,
    RagasEvaluateRequest,
    RagasEvaluateResponse,
    TokenUsageSummaryResponse,
    VectorSearchResult,
)
from simple_ai.repositories.agent_repository import agent_repository
from simple_ai.repositories.document_repository import document_repository
from simple_ai.repositories.usage_repository import usage_repository
from simple_ai.repositories.user_repository import user_repository
from simple_ai.repositories.vector_repository import vector_repository
from simple_ai.services.auth_service import get_current_admin
from simple_ai.services.et_service import et_service
from simple_ai.services.rag_service import rag_service
from simple_ai.services.ragas_service import ragas_service

logger = logging.getLogger("simple_ai.controllers.admin")

router = APIRouter(prefix="/admin", tags=["Admin & Knowledge Ingestion"])


@router.post(
    "/knowledge/upload",
    response_model=IngestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload & Ingest Document (PDF, TXT, MD, CSV, JSON) into pgvector",
)
async def upload_document(
    file: UploadFile = File(..., description="Document file to ingest"),
    metadata_json: Optional[str] = Form(None, description="Optional JSON string of metadata key-values"),
    current_admin: Dict[str, Any] = Depends(get_current_admin),
):
    """Controller: Extracts file data and delegates ingestion pipeline to ETService scoped to admin."""
    if not file.filename:
        raise ValidationException("Uploaded file must have a filename.")

    custom_meta = {}
    if metadata_json:
        try:
            custom_meta = json.loads(metadata_json)
        except Exception:
            raise ValidationException("metadata_json must be valid JSON format.")

    content_bytes = await file.read()
    if not content_bytes:
        raise ValidationException("Uploaded file is empty.")

    doc_id, total_chunks = await et_service.ingest_document(
        filename=file.filename,
        file_bytes=content_bytes,
        uploaded_by=current_admin["username"],
        user_id=current_admin["id"],
        custom_metadata=custom_meta,
    )

    return IngestionResponse(
        success=True,
        message=f"Document '{file.filename}' processed and stored in pgvector.",
        doc_id=doc_id,
        filename=file.filename,
        total_chunks=total_chunks,
        file_size=len(content_bytes),
    )


@router.post(
    "/knowledge/text",
    response_model=IngestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Directly ingest raw text / article into pgvector",
)
async def ingest_text(
    request: IngestTextRequest,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
):
    """Controller: Ingests raw text documentation directly via ETService scoped to admin."""
    doc_id, total_chunks = await et_service.ingest_raw_text(
        title=request.title,
        content=request.content,
        uploaded_by=current_admin["username"],
        user_id=current_admin["id"],
        custom_metadata=request.metadata,
    )
    return IngestionResponse(
        success=True,
        message=f"Text knowledge '{request.title}' ingested into pgvector.",
        doc_id=doc_id,
        filename=f"{request.title}.txt",
        total_chunks=total_chunks,
        file_size=len(request.content.encode("utf-8")),
    )


@router.get(
    "/knowledge/documents",
    response_model=List[DocumentResponse],
    summary="List all ingested documents for the authenticated admin",
)
async def list_documents(current_admin: Dict[str, Any] = Depends(get_current_admin)):
    """Controller: Fetches documents scoped strictly to current admin."""
    return await document_repository.list_documents(user_id=current_admin["id"])


@router.get(
    "/knowledge/documents/{doc_id}",
    response_model=DocumentDetailResponse,
    summary="Get document details and chunk previews for the authenticated admin",
)
async def get_document(
    doc_id: str,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
):
    """Controller: Fetches document header and chunk previews scoped to current admin."""
    doc = await document_repository.find_by_id(doc_id, user_id=current_admin["id"])
    if not doc:
        raise NotFoundException("Document not found.")

    chunks = await document_repository.get_chunks_by_doc_id(doc_id)
    return {**doc, "chunks": chunks}


@router.delete(
    "/knowledge/documents/{doc_id}",
    summary="Delete a document and cascade delete all its pgvector embeddings",
)
async def delete_document(
    doc_id: str,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
):
    """Controller: Deletes document owned by current admin."""
    deleted = await document_repository.delete_document(doc_id, user_id=current_admin["id"])
    if not deleted:
        raise NotFoundException("Document not found or access denied.")

    return {
        "success": True,
        "message": f"Document '{deleted['filename']}' and its vector embeddings were deleted.",
        "doc_id": doc_id,
    }


@router.post(
    "/knowledge/search",
    response_model=List[VectorSearchResult],
    summary="Search knowledge base via pgvector cosine similarity scoped to admin",
)
async def search_knowledge(
    request: QueryRequest,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
):
    """Controller: Vector Search Playground scoped strictly to current admin's documents."""
    return await rag_service.retrieve_knowledge(
        query=request.query,
        top_k=request.top_k,
        min_score=request.min_score,
        user_id=current_admin["id"],
    )


@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    summary="Get admin statistics scoped to current admin",
)
async def get_admin_stats(current_admin: Dict[str, Any] = Depends(get_current_admin)):
    """Controller: Collects system metrics scoped to current admin."""
    users_count = await user_repository.count_users()
    docs_count = await document_repository.count_documents(user_id=current_admin["id"])
    chunks_count = await vector_repository.count_chunks(user_id=current_admin["id"])
    pgvector_status = await vector_repository.get_pgvector_status()

    return AdminStatsResponse(
        total_users=users_count,
        total_documents=docs_count,
        total_chunks=chunks_count,
        vector_dimension=EMBEDDING_DIM,
        pgvector_status=pgvector_status,
    )


# ==========================================
# Agent Configuration & Studio Endpoints
# ==========================================

@router.get(
    "/agent",
    response_model=AgentConfigResponse,
    summary="Get current admin's Agent configuration & MCP settings",
)
async def get_agent_config(current_admin: Dict[str, Any] = Depends(get_current_admin)):
    """Controller: Fetches or initializes the agent settings for current admin."""
    return await agent_repository.get_or_create_for_user(
        user_id=current_admin["id"], username=current_admin["username"]
    )


@router.put(
    "/agent",
    response_model=AgentConfigResponse,
    summary="Update current admin's Agent configuration, token limits & MCP settings",
)
async def update_agent_config(
    request: AgentConfigUpdateRequest,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
):
    """Controller: Updates agent settings (Title, Greeting, Model, Token Limits, MCP Servers)."""
    current_agent = await agent_repository.get_or_create_for_user(
        user_id=current_admin["id"], username=current_admin["username"]
    )

    updates = request.model_dump(exclude_unset=True)
    updated = await agent_repository.update_agent(
        agent_id=current_agent["id"], user_id=current_admin["id"], updates=updates
    )
    if not updated:
        raise NotFoundException("Agent configuration not found.")
    return updated


@router.get(
    "/usage",
    response_model=TokenUsageSummaryResponse,
    summary="Get token consumption and cost analytics for current admin's Agent",
)
async def get_token_usage_summary(current_admin: Dict[str, Any] = Depends(get_current_admin)):
    """Controller: Aggregates token usage, computed costs, and recent records for admin."""
    current_agent = await agent_repository.get_or_create_for_user(
        user_id=current_admin["id"], username=current_admin["username"]
    )
    return await usage_repository.get_summary_for_user(
        user_id=current_admin["id"],
        agent_id=current_agent["id"],
        monthly_budget=current_agent.get("monthly_token_budget", 1000000),
    )


@router.post(
    "/evaluation/ragas",
    response_model=RagasEvaluateResponse,
    summary="Evaluate RAG pipeline using Ragas framework (Faithfulness, Relevancy, Precision, Recall)",
)
async def evaluate_rag_pipeline(
    request: Optional[RagasEvaluateRequest] = None,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
):
    """Controller: Runs Ragas evaluation on the current admin's Agent and ingested knowledge."""
    current_agent = await agent_repository.get_or_create_for_user(
        user_id=current_admin["id"], username=current_admin["username"]
    )

    test_cases_data = []
    if request and request.test_cases:
        test_cases_data = [tc.model_dump() for tc in request.test_cases]
    else:
        docs = await document_repository.list_documents(user_id=current_admin["id"])
        filenames = [d["filename"] for d in docs] if docs else []
        test_cases_data = [
            {
                "question": f"What information is contained in {filenames[0]}?" if filenames else "What services and knowledge are available in the system?",
                "ground_truth": "Enterprise knowledge and documentation."
            },
            {
                "question": "Can you summarize the primary technical and operational capabilities described in your documents?",
                "ground_truth": "System architecture, services, and operational specifications."
            }
        ]

    eval_result = await ragas_service.evaluate_live_pipeline(
        test_cases=test_cases_data,
        user_id=current_admin["id"],
        agent_id=current_agent["id"],
        system_prompt=current_agent.get("system_prompt"),
        guardrails=current_agent.get("guardrails"),
        model_name=current_agent.get("model_name", "gemini-2.5-flash"),
    )
    return eval_result

