import asyncio
import json
import logging
import time
import uuid
from typing import Dict, Optional, Tuple
from fastapi import APIRouter, Body, HTTPException, Query, status
from pathlib import Path
from fastapi.responses import FileResponse, StreamingResponse

from simple_ai.models import WidgetChatRequest, WidgetConfigResponse
from simple_ai.repositories.agent_repository import agent_repository
from simple_ai.services.rag_service import rag_service

logger = logging.getLogger("simple_ai.controllers.widget")

router = APIRouter(prefix="/widget", tags=["Public Chat Widget"])

# Session registry for widget chats: session_id -> (queue, created_at)
SessionEntry = Tuple[asyncio.Queue, float]
widget_sessions: Dict[str, SessionEntry] = {}

WIDGET_JS_LOCATIONS = [
    Path(__file__).resolve().parent.parent / "static" / "widget" / "chat-widget.js",
    Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "widget" / "chat-widget.js",
]


@router.api_route(
    "/chat-widget.js",
    methods=["GET", "HEAD"],
    summary="Serve universal embeddable chat widget script",
    include_in_schema=True,
)
@router.api_route(
    "/widget.js",
    methods=["GET", "HEAD"],
    summary="Serve universal embeddable chat widget script (alias)",
    include_in_schema=False,
)
async def get_widget_script():
    """Serves the isolated vanilla JS widget script for client website embedding."""
    for p in WIDGET_JS_LOCATIONS:
        if p.exists() and p.is_file():
            return FileResponse(
                path=str(p),
                media_type="application/javascript; charset=utf-8",
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*",
                },
            )
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="chat-widget.js bundle not found.")


def cleanup_stale_widget_sessions(ttl_seconds: float = 300.0) -> None:
    now = time.time()
    stale = [
        sid
        for sid, (_, created_at) in widget_sessions.items()
        if now - created_at > ttl_seconds
    ]
    for sid in stale:
        widget_sessions.pop(sid, None)


@router.get(
    "/config",
    response_model=WidgetConfigResponse,
    summary="Fetch public branding and greeting configuration for ChatWidget",
)
async def get_widget_config(
    agent_id: str = Query(..., description="Unique Agent ID deployed by admin")
):
    """Public endpoint for embeddable ChatWidget to load agent branding & greetings."""
    agent = await agent_repository.get_by_id(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found. Please verify the agent_id in your embed script.",
        )

    if not agent.get("is_deployed", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This agent has been temporarily deactivated by its administrator.",
        )

    return WidgetConfigResponse(
        agent_id=agent["id"],
        title=agent["name"],
        welcome_message=agent["welcome_message"],
        brand_color=agent["brand_color"],
        starter_prompts=agent["starter_prompts"],
        model_name=agent["model_name"],
        is_deployed=agent["is_deployed"],
    )


@router.post(
    "/chat",
    summary="Route 1 (Widget): Initialize or directly stream chat for visitor session",
)
async def widget_chat(
    request: WidgetChatRequest,
    stream_mode: str = Query(
        default="direct",
        description="'direct' for single-route direct SSE stream (serverless compatible), 'session' for Two-Route pattern",
    ),
):
    """
    Initializes or directly streams a visitor chat session for the specified agent.
    Grounds retrieval strictly in the agent owner's documents.
    """
    agent = await agent_repository.get_by_id(request.agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{request.agent_id}' not found.",
        )

    if not agent.get("is_deployed", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent is currently disabled.",
        )

    session_id = request.session_id or str(uuid.uuid4())

    # Mode A: Direct single-route SSE stream (recommended for Serverless / Vercel)
    if stream_mode == "direct":
        async def direct_widget_stream():
            try:
                async for chunk in rag_service.stream_answer_with_rag(
                    query=request.query,
                    use_knowledge_base=request.use_knowledge_base,
                    user_id=agent["user_id"],
                    agent_id=agent["id"],
                    session_id=session_id,
                    model_name=agent["model_name"],
                    system_prompt=agent["system_prompt"],
                    guardrails=agent.get("guardrails"),
                    agent_title=agent.get("title") or agent.get("name"),
                    source="widget",
                ):
                    yield f"data: {json.dumps(chunk)}\n\n"
            except Exception as e:
                logger.error(f"Widget direct RAG failed: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            finally:
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            direct_widget_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Access-Control-Allow-Origin": "*",
            },
        )

    # Mode B: Two-Route in-memory session pattern
    cleanup_stale_widget_sessions()
    event_queue: asyncio.Queue = asyncio.Queue()
    widget_sessions[session_id] = (event_queue, time.time())

    # Background task to stream RAG tokens and log cost
    async def run_widget_rag_pipeline():
        try:
            async for chunk in rag_service.stream_answer_with_rag(
                query=request.query,
                use_knowledge_base=request.use_knowledge_base,
                user_id=agent["user_id"],
                agent_id=agent["id"],
                session_id=session_id,
                model_name=agent["model_name"],
                system_prompt=agent["system_prompt"],
                guardrails=agent.get("guardrails"),
                agent_title=agent.get("title") or agent.get("name"),
                source="widget",
            ):
                payload_str = f"data: {json.dumps(chunk)}\n\n"
                await event_queue.put(payload_str)
        except Exception as e:
            logger.error(f"Widget background RAG failed: {e}")
            err_str = f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            await event_queue.put(err_str)
        finally:
            await event_queue.put("data: [DONE]\n\n")
            await event_queue.put(None)

    asyncio.create_task(run_widget_rag_pipeline())

    return {
        "session_id": session_id,
        "agent_id": agent["id"],
        "status": "processing",
        "stream_url": f"/widget/chat/{session_id}/events",
    }


@router.get(
    "/chat/stream",
    summary="Native EventSource Direct SSE stream for Widget",
)
async def widget_chat_stream_get(
    agent_id: str = Query(..., description="Target Agent ID"),
    query: str = Query(..., description="Visitor query prompt"),
    use_knowledge_base: bool = Query(default=True),
    session_id: Optional[str] = Query(default=None),
):
    """
    Direct single-connection SSE stream compatible with native browser EventSource.
    Eliminates cross-container serverless state dependency.
    """
    agent = await agent_repository.get_by_id(agent_id)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found.",
        )

    if not agent.get("is_deployed", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent is currently disabled.",
        )

    sid = session_id or str(uuid.uuid4())

    async def get_stream_generator():
        try:
            async for chunk in rag_service.stream_answer_with_rag(
                query=query,
                use_knowledge_base=use_knowledge_base,
                user_id=agent["user_id"],
                agent_id=agent["id"],
                session_id=sid,
                model_name=agent["model_name"],
                system_prompt=agent["system_prompt"],
                guardrails=agent.get("guardrails"),
                agent_title=agent.get("title") or agent.get("name"),
                source="widget",
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"Widget GET stream RAG failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        get_stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get(
    "/chat/{session_id}/events",
    summary="Route 2 (Widget): Subscribe to SSE stream for visitor session",
)
async def widget_chat_events(session_id: str):
    """Streams SSE events directly to the external embeddable ChatWidget."""
    cleanup_stale_widget_sessions()

    if session_id not in widget_sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget chat session expired or not found. Please resubmit your query.",
        )

    event_queue, _ = widget_sessions[session_id]

    async def sse_event_generator():
        try:
            while True:
                item = await event_queue.get()
                if item is None:
                    break
                yield item
        finally:
            widget_sessions.pop(session_id, None)

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )
