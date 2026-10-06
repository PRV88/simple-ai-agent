import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let query = "";
    if (typeof body.query === "string" && body.query.trim()) {
      query = body.query.trim();
    } else if (typeof body.message === "string" && body.message.trim()) {
      query = body.message.trim();
    } else if (Array.isArray(body.messages) && body.messages.length > 0) {
      const lastMsg = body.messages[body.messages.length - 1];
      query = (
        typeof lastMsg === "string"
          ? lastMsg
          : lastMsg?.content || lastMsg?.text || ""
      ).trim();
    }

    if (!query) {
      return NextResponse.json(
        { error: "Query or prompt is required." },
        { status: 400 }
      );
    }

    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://127.0.0.1:8000";

    const backendRes = await fetch(`${backendUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        use_knowledge_base: body.use_knowledge_base ?? true,
        top_k: body.top_k ?? 3,
        min_score: body.min_score ?? 0.35,
      }),
    });

    if (!backendRes.ok) {
      const errorData = await backendRes
        .json()
        .catch(() => ({ error: "Backend error" }));
      return NextResponse.json(errorData, { status: backendRes.status });
    }

    const sessionData = await backendRes.json();
    return NextResponse.json({
      session_id: sessionData.session_id,
      status: sessionData.status,
      stream_url: `/api/chat/${sessionData.session_id}/events`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to connect to AI backend";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
