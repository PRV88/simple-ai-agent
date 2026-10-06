"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  RadioGroup,
  FormControlLabel,
  Radio,
  Tabs,
  Tab,
  CircularProgress,
  Tooltip,
  Paper,
  Chip,
} from "@mui/material";
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  OpenInNew as OpenIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  Shield as ShieldIcon,
  Speed as FastIcon,
} from "@mui/icons-material";
import { AgentConfig } from "@/types";

interface DeployWidgetViewProps {
  token: string;
  showToast: (msg: string, isError?: boolean) => void;
}

export const DeployWidgetView: React.FC<DeployWidgetViewProps> = ({
  token,
  showToast,
}) => {
  const [agent, setAgent] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [tabFormat, setTabFormat] = useState<"html" | "react" | "nextjs">("html");

  const loadAgent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/admin/agent", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgent(data);
      } else {
        showToast("Failed to fetch agent details", true);
      }
    } catch {
      showToast("Network error fetching agent", true);
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const agentId = agent?.id || "YOUR_AGENT_ID";

  const getEmbedCode = () => {
    const scriptSrc = `${origin}/widget/chat-widget.js`;
    const apiBase = origin;

    if (tabFormat === "html") {
      return `<!-- Simple AI Universal ChatWidget -->
<script
  src="${scriptSrc}"
  data-agent-id="${agentId}"
  data-api-base="${apiBase}"
  data-position="${position}"
  defer>
</script>`;
    }

    if (tabFormat === "react") {
      return `// React Integration (e.g. inside App.tsx or index.html)
import { useEffect } from "react";

export function SimpleAIChatWidget() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "${scriptSrc}";
    script.setAttribute("data-agent-id", "${agentId}");
    script.setAttribute("data-api-base", "${apiBase}");
    script.setAttribute("data-position", "${position}");
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}`;
    }

    // Next.js
    return `// Next.js Script Component (app/layout.tsx or pages/_app.tsx)
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="${scriptSrc}"
          data-agent-id="${agentId}"
          data-api-base="${apiBase}"
          data-position="${position}"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    showToast("Embed code copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenDemo = () => {
    if (typeof window !== "undefined") {
      window.open(`/widget-demo.html?agent_id=${agentId}`, "_blank");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Deploy Embeddable Chat Widget
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Copy and paste this snippet into any external website, CRM, or portal to connect visitors directly to your agent.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<OpenIcon />}
          onClick={handleOpenDemo}
          sx={{ fontWeight: 600 }}
        >
          Open Live Simulation Demo
        </Button>
      </Box>

      {/* Highlights */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
            <ShieldIcon color="primary" />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Shadow DOM Isolation
              </Typography>
              <Typography variant="caption" color="text.secondary">
                No CSS conflicts with host websites
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
            <FastIcon color="secondary" />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Two-Route SSE Streaming
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Zero lag, token-by-token instant responses
              </Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper variant="outlined" sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
            <CodeIcon color="success" />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Universal Compatibility
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Works in HTML, React, Vue, WordPress, Shopify
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Embed Code Configuration Card */}
      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Widget Embed Code
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: "text.secondary" }}>
                Position:
              </Typography>
              <RadioGroup
                row
                value={position}
                onChange={(e) => setPosition(e.target.value as "bottom-right" | "bottom-left")}
              >
                <FormControlLabel
                  value="bottom-right"
                  control={<Radio size="small" />}
                  label="Bottom Right"
                />
                <FormControlLabel
                  value="bottom-left"
                  control={<Radio size="small" />}
                  label="Bottom Left"
                />
              </RadioGroup>
            </Box>
          </Box>

          {/* Format Tabs */}
          <Tabs
            value={tabFormat}
            onChange={(_, val) => setTabFormat(val)}
            sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
          >
            <Tab label="HTML / Vanilla JS" value="html" />
            <Tab label="React" value="react" />
            <Tab label="Next.js" value="nextjs" />
          </Tabs>

          {/* Code display */}
          <Box sx={{ position: "relative" }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: (theme) => (theme.palette.mode === "light" ? "#1e293b" : "#0f172a"),
                color: "#38bdf8",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {getEmbedCode()}
            </Paper>

            <Tooltip title={copied ? "Copied!" : "Copy code"}>
              <Button
                variant="contained"
                size="small"
                startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                onClick={handleCopy}
                sx={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  bgcolor: copied ? "success.main" : "primary.main",
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                {copied ? "Copied" : "Copy Code"}
              </Button>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Embedded Live Sandbox Demo */}
      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PreviewIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Interactive Live Preview Sandbox
              </Typography>
            </Box>
            <Chip label="Isolated iFrame Sandbox" size="small" variant="outlined" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Test your live agent widget directly inside an external website simulation. Notice how the widget launcher appears in the bottom right corner of the embedded preview below.
          </Typography>

          <Box
            sx={{
              width: "100%",
              height: 520,
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <iframe
              src={`/widget-demo.html?agent_id=${agentId}`}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Chat Widget Live Demo Sandbox"
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
