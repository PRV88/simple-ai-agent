"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  AttachMoney as CostIcon,
  Token as TokenIcon,
  QuestionAnswer as QueryIcon,
  PieChart as BudgetIcon,
  Refresh as RefreshIcon,
  Public as WidgetIcon,
  DeveloperMode as PlaygroundIcon,
} from "@mui/icons-material";
import { TokenUsageSummary } from "@/types";

interface TokenAnalyticsViewProps {
  token: string;
  showToast: (msg: string, isError?: boolean) => void;
}

export const TokenAnalyticsView: React.FC<TokenAnalyticsViewProps> = ({
  token,
  showToast,
}) => {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<TokenUsageSummary | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/admin/usage", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: TokenUsageSummary = await res.json();
        setUsage(data);
      } else {
        showToast("Failed to fetch token usage data", true);
      }
    } catch {
      showToast("Network error fetching usage metrics", true);
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  if (loading && !usage) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalCost = usage?.total_cost_usd ?? 0;
  const totalTokens = usage?.total_tokens ?? 0;
  const promptTokens = usage?.total_prompt_tokens ?? 0;
  const completionTokens = usage?.total_completion_tokens ?? 0;
  const totalRequests = usage?.total_requests ?? 0;
  const budget = usage?.monthly_budget ?? 500000;
  const budgetPercent = usage?.budget_used_percentage ?? 0;

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
            Token Usage & Cost Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time inference costs, token tracking, and budget utilization for your agent.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={loadUsage}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Metric Cards Grid */}
      <Grid container spacing={2.5}>
        {/* Cost Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Total Cost (USD)
                </Typography>
                <CostIcon color="success" />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "success.main", mb: 0.5 }}>
                ${totalCost < 0.0001 && totalCost > 0 ? "< $0.0001" : `$${totalCost.toFixed(5)}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Exact Gemini pricing per 1M tokens
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Tokens Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Total Tokens
                </Typography>
                <TokenIcon color="primary" />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {totalTokens.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {promptTokens.toLocaleString()} in / {completionTokens.toLocaleString()} out
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Queries Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Questions Answered
                </Typography>
                <QueryIcon color="secondary" />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                {totalRequests.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Across Widget & Playground
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Budget Card */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Monthly Budget
                </Typography>
                <BudgetIcon color="warning" />
              </Box>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {budgetPercent.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of {budget.toLocaleString()} tokens
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(budgetPercent, 100)}
                color={budgetPercent > 80 ? "error" : "primary"}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Token Distribution Breakdown */}
      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Token Breakdown & Pricing Model
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Input tokens encompass the system persona prompt, question text, and retrieved pgvector context chunks. Output tokens reflect Gemini's synthesized answers.
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  PROMPT / INPUT TOKENS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: "primary.main" }}>
                  {promptTokens.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {totalTokens > 0 ? `${((promptTokens / totalTokens) * 100).toFixed(1)}% of total volume` : "0%"}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  COMPLETION / OUTPUT TOKENS
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: "secondary.main" }}>
                  {completionTokens.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {totalTokens > 0 ? `${((completionTokens / totalTokens) * 100).toFixed(1)}% of total volume` : "0%"}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recent Activity Log Table */}
      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Recent Query Inferences & Costs
            </Typography>
            <Chip
              label={`${usage?.recent_records?.length ?? 0} recent requests`}
              size="small"
              variant="outlined"
            />
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "background.default" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Channel / Source</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Model</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Prompt</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Completion</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Total Tokens</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Cost (USD)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usage?.recent_records && usage.recent_records.length > 0 ? (
                  usage.recent_records.map((rec) => (
                    <TableRow key={rec.id} hover>
                      <TableCell sx={{ fontSize: "0.82rem" }}>
                        {new Date(rec.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={rec.source === "widget" ? <WidgetIcon /> : <PlaygroundIcon />}
                          label={rec.source === "widget" ? "Widget Visitor" : "Playground"}
                          size="small"
                          color={rec.source === "widget" ? "primary" : "default"}
                          sx={{ height: 22, fontSize: "0.72rem" }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                        {rec.model_name}
                      </TableCell>
                      <TableCell align="right">{rec.prompt_tokens.toLocaleString()}</TableCell>
                      <TableCell align="right">{rec.completion_tokens.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {rec.total_tokens.toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ color: "success.main", fontWeight: 700 }}>
                        ${rec.cost_usd.toFixed(6)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No queries recorded yet. Send questions in Playground or the ChatWidget to start tracking tokens and cost!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};
