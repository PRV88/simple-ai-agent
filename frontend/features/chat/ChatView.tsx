"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Chip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Paper,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";
import {
  Send as SendIcon,
  Stop as StopIcon,
  RestartAlt as ResetIcon,
  Description as DocIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  LightbulbOutlined as LightbulbIcon,
} from "@mui/icons-material";
import { ChatMessage, Citation } from "@/types";
import { createChatSession, streamChatSession, streamChatDirect } from "./chatSdk";

const STARTER_PROMPTS = [
  "What is our company security policy?",
  "What is the database backup encryption standard?",
  "How does pgvector calculate cosine similarity?",
  "Summarize key security and compliance rules",
];

interface ChatViewProps {
  token?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ token }) => {
  const [agentTitle, setAgentTitle] = useState("AI Knowledge Assistant");
  const [welcomeText, setWelcomeText] = useState(
    "Hello! I am your AI knowledge assistant grounded in your pgvector database. Ask me anything about your ingested documents or policies."
  );
  const [prompts, setPrompts] = useState<string[]>(STARTER_PROMPTS);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "agent",
      text: "Hello! I am your AI knowledge assistant grounded in your pgvector database. Ask me anything about your ingested documents or policies.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const streamStateRef = useRef<{ text: string; citations: Citation[] }>({
    text: "",
    citations: [],
  });

  // Load configured agent welcome text and prompts if token is available
  useEffect(() => {
    if (!token) return;
    const fetchAgent = async () => {
      try {
        const res = await fetch("/admin/agent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.title) setAgentTitle(data.title);
          if (data.welcome_message) {
            setWelcomeText(data.welcome_message);
            setMessages([
              {
                sender: "agent",
                text: data.welcome_message,
              },
            ]);
          }
          if (Array.isArray(data.starter_prompts) && data.starter_prompts.length > 0) {
            setPrompts(data.starter_prompts);
          }
        }
      } catch (e) {
        console.error("Failed to fetch agent in chat playground", e);
      }
    };
    fetchAgent();
  }, [token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleStop = () => {
    if (stopStreamRef.current) {
      stopStreamRef.current();
      stopStreamRef.current = null;
    }
    setIsLoading(false);
  };

  const handleClear = () => {
    handleStop();
    setActiveSessionId(null);
    setMessages([
      {
        sender: "agent",
        text: welcomeText,
      },
    ]);
  };

  const sendMessage = async (userPrompt: string) => {
    const trimmed = userPrompt.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { sender: "user", text: trimmed },
      { sender: "agent", text: "", citations: [] },
    ]);
    setIsLoading(true);
    streamStateRef.current = { text: "", citations: [] };

    try {
      const closeStream = streamChatDirect(
        {
          query: trimmed,
          use_knowledge_base: useKnowledgeBase,
          token: token,
        },
        {
        onCitations: (citations) => {
          streamStateRef.current.citations = citations;
          updateLastAgentMessage();
        },
        onDelta: (delta) => {
          streamStateRef.current.text += delta;
          updateLastAgentMessage();
        },
        onDone: (fullMessage, citations) => {
          streamStateRef.current.text = fullMessage;
          streamStateRef.current.citations = citations;
          updateLastAgentMessage();
          setIsLoading(false);
          stopStreamRef.current = null;
        },
        onError: (err) => {
          setIsLoading(false);
          stopStreamRef.current = null;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.sender === "agent" && !last.text) {
              updated[updated.length - 1] = {
                sender: "agent",
                text: `Streaming error: ${err.message}`,
              };
              return updated;
            }
            return prev;
          });
        },
      });

      stopStreamRef.current = closeStream;
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : "Error initiating chat session";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.sender === "agent" && !last.text) {
          updated[updated.length - 1] = {
            sender: "agent",
            text: `Encountered an issue: ${msg}`,
          };
          return updated;
        }
        return [
          ...prev,
          { sender: "agent", text: `Encountered an issue: ${msg}` },
        ];
      });
    }
  };

  const updateLastAgentMessage = () => {
    const text = streamStateRef.current.text;
    const citations = streamStateRef.current.citations;
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = {
        sender: "agent",
        text,
        citations,
      };
      return updated;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <Card
      sx={{
        height: 700,
        display: "flex",
        flexDirection: "column",
        p: { xs: 2, sm: 3 },
        borderRadius: 3,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: (theme) =>
          theme.palette.mode === "light"
            ? "0 4px 20px -2px rgba(0, 0, 0, 0.05)"
            : "none",
      }}
    >
      <CardContent
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          "&:last-child": { pb: 0 },
        }}
      >
        {/* Header bar */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pb: 2,
            mb: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} color="text.primary">
                {agentTitle}
              </Typography>
              <Chip
                label="Playground Sandbox"
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: "0.72rem", fontWeight: 700, height: 22 }}
              />
              <Chip
                label="EventSource SSE"
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: "0.72rem", fontWeight: 700, height: 22 }}
              />
              {activeSessionId && (
                <Chip
                  label={`Session: ${activeSessionId.slice(0, 8)}...`}
                  size="small"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.7rem",
                    height: 22,
                    bgcolor: (theme) =>
                      theme.palette.mode === "light"
                        ? "rgba(0, 0, 0, 0.04)"
                        : "rgba(255, 255, 255, 0.05)",
                  }}
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Grounded vector queries powered by PostgreSQL <code>pgvector</code> & Gemini embeddings.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={useKnowledgeBase}
                  onChange={(e) => setUseKnowledgeBase(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.secondary">
                  pgvector Grounding
                </Typography>
              }
            />

            <Tooltip title="Clear conversation">
              <IconButton size="small" onClick={handleClear} sx={{ color: "text.secondary" }}>
                <ResetIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Messages Stream Container */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pr: 1,
            mb: 2,
          }}
        >
          {messages.map((msg, i) => {
            const isAgent = msg.sender === "agent";
            const isCurrentStreaming = isAgent && isLoading && i === messages.length - 1;

            return (
              <Box
                key={i}
                sx={{
                  alignSelf: isAgent ? "flex-start" : "flex-end",
                  maxWidth: { xs: "92%", sm: "80%" },
                  bgcolor: isAgent
                    ? (theme) =>
                        theme.palette.mode === "light"
                          ? "#f1f5f9"
                          : "rgba(17, 24, 39, 0.9)"
                    : "primary.main",
                  color: isAgent
                    ? (theme) =>
                        theme.palette.mode === "light" ? "#0f172a" : "#f8fafc"
                    : "#ffffff",
                  p: 2,
                  borderRadius: 2.5,
                  border: isAgent ? "1px solid" : "none",
                  borderColor: "divider",
                  boxShadow: (theme) =>
                    theme.palette.mode === "light"
                      ? "0 2px 8px rgba(0, 0, 0, 0.04)"
                      : "0 4px 12px rgba(0, 0, 0, 0.25)",
                }}
              >
                {/* Message Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.75,
                    color: isAgent ? "primary.main" : "rgba(255, 255, 255, 0.85)",
                  }}
                >
                  {isAgent ? (
                    <BotIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <PersonIcon sx={{ fontSize: 18 }} />
                  )}
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase" }}>
                    {isAgent ? "Simple AI Assistant" : "You"}
                  </Typography>
                </Box>

                {/* Message Text or Thinking State */}
                {isCurrentStreaming && !msg.text ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
                    <CircularProgress size={16} thickness={5} color="primary" />
                    <Typography
                      variant="body2"
                      sx={{
                        fontStyle: "italic",
                        color: "text.secondary",
                        fontSize: "0.88rem",
                      }}
                    >
                      Searching knowledge base & reasoning...
                    </Typography>
                  </Box>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                      fontSize: "0.92rem",
                      color: isAgent
                        ? (theme) =>
                            theme.palette.mode === "light" ? "#0f172a" : "#f8fafc"
                        : "#ffffff",
                    }}
                  >
                    {msg.text}
                    {isCurrentStreaming && <span className="ai-typing-cursor" />}
                  </Typography>
                )}

                {/* Citations if available */}
                {msg.citations && msg.citations.length > 0 && (
                  <Box
                    sx={{
                      mt: 1.5,
                      pt: 1.25,
                      borderTop: "1px solid",
                      borderColor: (theme) =>
                        theme.palette.mode === "light"
                          ? "rgba(0, 0, 0, 0.08)"
                          : "rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="secondary.main"
                      sx={{ fontWeight: 700, display: "block", mb: 1 }}
                    >
                      Grounded Knowledge Sources ({msg.citations.length}):
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {msg.citations.map((c, ci) => {
                        const citationKey = `${i}-${ci}`;
                        const isExpanded = expandedCitation === citationKey;

                        return (
                          <Box key={ci}>
                            <Paper
                              variant="outlined"
                              onClick={() =>
                                setExpandedCitation(isExpanded ? null : citationKey)
                              }
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                p: "6px 10px",
                                bgcolor: (theme) =>
                                  theme.palette.mode === "light"
                                    ? "rgba(2, 132, 199, 0.08)"
                                    : "rgba(56, 189, 248, 0.08)",
                                borderColor: (theme) =>
                                  theme.palette.mode === "light"
                                    ? "rgba(2, 132, 199, 0.25)"
                                    : "rgba(56, 189, 248, 0.25)",
                                borderRadius: 1.5,
                                cursor: "pointer",
                                "&:hover": {
                                  bgcolor: (theme) =>
                                    theme.palette.mode === "light"
                                      ? "rgba(2, 132, 199, 0.15)"
                                      : "rgba(56, 189, 248, 0.15)",
                                },
                              }}
                            >
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <DocIcon sx={{ fontSize: 16, color: "secondary.main" }} />
                                <Typography variant="caption" sx={{ fontWeight: 600 }} color="secondary.main">
                                  {c.source} ({(c.similarity * 100).toFixed(1)}% Match)
                                </Typography>
                              </Box>
                              {isExpanded ? (
                                <ExpandLessIcon sx={{ fontSize: 16, color: "secondary.main" }} />
                              ) : (
                                <ExpandMoreIcon sx={{ fontSize: 16, color: "secondary.main" }} />
                              )}
                            </Paper>

                            <Collapse in={isExpanded}>
                              <Paper
                                sx={{
                                  mt: 0.75,
                                  p: 1.5,
                                  bgcolor: (theme) =>
                                    theme.palette.mode === "light"
                                      ? "#ffffff"
                                      : "rgba(0, 0, 0, 0.4)",
                                  border: "1px solid",
                                  borderColor: "divider",
                                  borderRadius: 1.5,
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                  color: (theme) =>
                                    theme.palette.mode === "light"
                                      ? "#1e293b"
                                      : "#cbd5e1",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  color="secondary.main"
                                  sx={{ fontWeight: 700, display: "block", mb: 0.5 }}
                                >
                                  Chunk Preview #{c.chunk_index ?? 0}:
                                </Typography>
                                {c.content_preview}
                              </Paper>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}

          {isLoading && messages[messages.length - 1]?.sender !== "agent" && (
            <Box sx={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 1.5, p: 1 }}>
              <CircularProgress size={18} color="primary" />
              <Typography variant="body2" color="text.secondary">
                Connecting to EventSource and streaming response...
              </Typography>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Starter Prompts */}
        {messages.length <= 1 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75, display: "block" }}>
              Suggested Queries:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {prompts.map((prompt, idx) => (
                <Chip
                  key={idx}
                  icon={<LightbulbIcon sx={{ fontSize: 16 }} />}
                  label={prompt}
                  onClick={() => sendMessage(prompt)}
                  variant="outlined"
                  clickable
                  sx={{
                    bgcolor: (theme) =>
                      theme.palette.mode === "light"
                        ? "rgba(0, 0, 0, 0.02)"
                        : "rgba(255, 255, 255, 0.02)",
                    borderColor: "divider",
                    "&:hover": {
                      bgcolor: (theme) =>
                        theme.palette.mode === "light"
                          ? "rgba(79, 70, 229, 0.08)"
                          : "rgba(99, 102, 241, 0.15)",
                      borderColor: "primary.main",
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Input Bar */}
        <Box
          component="form"
          onSubmit={handleFormSubmit}
          sx={{ display: "flex", gap: 1.5, alignItems: "center" }}
        >
          <TextField
            fullWidth
            placeholder="Ask a question about your knowledge base (Press Enter)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            size="medium"
          />

          {isLoading ? (
            <Button
              variant="contained"
              color="error"
              onClick={handleStop}
              startIcon={<StopIcon />}
              sx={{ minWidth: 100, minHeight: 48 }}
            >
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              variant="contained"
              disabled={!input.trim()}
              startIcon={<SendIcon />}
              sx={{
                minWidth: 100,
                minHeight: 48,
                background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
              }}
            >
              Send
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
