import asyncio
import json
import logging
import time
import uuid
from typing import Any, Dict, Optional, Tuple
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from simple_ai.middlewares import chat_rate_limiter
from simple_ai.models import ChatRequest
from simple_ai.repositories.agent_repository import agent_repository
from simple_ai.services.auth_service import get_current_user_optional
from simple_ai.services.rag_service import rag_service

logger = logging.getLogger("simple_ai.controllers.chat")

router = APIRouter(tags=["Chat & Agents"])

# Session registry: session_id -> (queue, created_at)
SessionEntry = Tuple[asyncio.Queue, float]
chat_sessions: Dict[str, SessionEntry] = {}


def cleanup_stale_sessions(ttl_seconds: float = 300.0) -> None:
    """Removes unconsumed sessions older than TTL to avoid memory leaks."""
    now = time.time()
    stale = [
        sid
        for sid, (_, created_at) in chat_sessions.items()
        if now - created_at > ttl_seconds
    ]
    for sid in stale:
        chat_sessions.pop(sid, None)


@router.get("/")
def home():
    """Service health and overview."""
    return {
        "status": "online",
        "service": "Simple AI Enterprise Knowledge Engine",
        "architecture": "Controller-Service-Repository Pattern",
        "vector_backend": "PostgreSQL + pgvector",
        "docs_url": "/docs",
        "frontend_url": "http://localhost:3000",
    }


# ==============================================================================
# ROUTE 1: POST /chat (Session Creation / Query Dispatch)
# ==============================================================================
@router.post("/chat", dependencies=[Depends(chat_rate_limiter)])
async def chat(
    request: Optional[ChatRequest] = Body(default=None),
    query: Optional[str] = Query(default=None, description="Query string if passed as URL parameter"),
    stream_mode: str = Query(
        default="direct",
        description="'direct' for single-route direct SSE stream (serverless compatible), 'session' for Two-Route pattern, 'sync' for static JSON",
    ),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Route 1 (Two-Route Pattern): Receives user query, initializes session queue,
    and returns session_id + stream_url for SSE subscription.
    """
    target_query = ""
    use_knowledge_base = True
    top_k = 3
    min_score = 0.35

    if request:
        target_query = request.get_query()
        use_knowledge_base = request.use_knowledge_base
        top_k = request.top_k
        min_score = request.min_score

    if not target_query and query:
        target_query = query.strip()

    if not target_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A search question or query is required. Provide 'query' or 'message' in the JSON body or as a '?query=' parameter.",
        )

    # Resolve agent settings if authenticated
    user_id = current_user.get("id") if current_user else None
    agent_id = None
    agent_title = "Enterprise AI Assistant"
    model_name = "gemini-2.5-flash"
    system_prompt = None
    guardrails = None

    if current_user and user_id:
        agent = await agent_repository.get_or_create_for_user(
            user_id=user_id, username=current_user["username"]
        )
        agent_id = agent["id"]
        agent_title = agent.get("title") or agent.get("name")
        model_name = agent["model_name"]
        system_prompt = agent["system_prompt"]
        guardrails = agent.get("guardrails")

    # Mode A: Synchronous static JSON response
    if stream_mode == "sync":
        session_id = str(uuid.uuid4())
        rag_result = await rag_service.answer_with_rag(
            query=target_query,
            use_knowledge_base=use_knowledge_base,
            top_k=top_k,
            min_score=min_score,
            user_id=user_id,
            agent_id=agent_id,
            session_id=session_id,
            model_name=model_name,
            system_prompt=system_prompt,
            guardrails=guardrails,
            agent_title=agent_title,
            source="playground",
        )
        return {
            "message": rag_result["answer"],
            "citations": rag_result["citations"],
            "tokens": rag_result.get("tokens"),
        }

    # Mode B: Direct single-route SSE stream
    if stream_mode == "direct":
        session_id = str(uuid.uuid4())

        async def direct_sse_stream():
            try:
                async for chunk in rag_service.stream_answer_with_rag(
                    query=target_query,
                    use_knowledge_base=use_knowledge_base,
                    top_k=top_k,
                    min_score=min_score,
                    user_id=user_id,
                    agent_id=agent_id,
                    session_id=session_id,
                    model_name=model_name,
                    system_prompt=system_prompt,
                    guardrails=guardrails,
                    agent_title=agent_title,
                    source="playground",
                ):
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(f"Error direct streaming chat: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            direct_sse_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream; charset=utf-8",
                "X-Accel-Buffering": "no",
            },
        )

    # Mode C: Two-Route Session Pattern (Default)
    cleanup_stale_sessions()
    session_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    chat_sessions[session_id] = (queue, time.time())

    async def background_producer():
        try:
            async for chunk in rag_service.stream_answer_with_rag(
                query=target_query,
                use_knowledge_base=use_knowledge_base,
                top_k=top_k,
                min_score=min_score,
                user_id=user_id,
                agent_id=agent_id,
                session_id=session_id,
                model_name=model_name,
                system_prompt=system_prompt,
                guardrails=guardrails,
                agent_title=agent_title,
                source="playground",
            ):
                await queue.put(f"data: {json.dumps(chunk)}\n\n")
            await queue.put("data: [DONE]\n\n")
        except Exception as e:
            logger.error(f"Error producing SSE stream for session {session_id}: {e}")
            await queue.put(f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n")
            await queue.put("data: [DONE]\n\n")
        finally:
            await queue.put(None)

    asyncio.create_task(background_producer())

    return {
        "session_id": session_id,
        "status": "processing",
        "stream_url": f"/chat/{session_id}/events",
    }


# ==============================================================================
# ROUTE 2: GET /chat/{session_id}/events (SSE Subscription Listener)
# ==============================================================================
@router.get("/chat/{session_id}/events")
async def chat_events(session_id: str):
    """Route 2 (Two-Route Pattern): Consumes the FIFO event queue for this session."""
    cleanup_stale_sessions()

    if session_id not in chat_sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found or expired. Please initiate a new chat session via POST /chat.",
        )

    queue, _ = chat_sessions[session_id]

    async def event_generator():
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            chat_sessions.pop(session_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Accel-Buffering": "no",
        },
    )
