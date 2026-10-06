"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Paper,
  InputAdornment,
} from "@mui/material";
import {
  Search as SearchIcon,
  AutoAwesome as SparklesIcon,
  Description as DocIcon,
} from "@mui/icons-material";
import { SearchResult } from "@/types";

interface SearchViewProps {
  token: string;
  showToast: (message: string, isError?: boolean) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ token, showToast }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !token) return;

    setIsSearching(true);
    try {
      const res = await fetch("/admin/knowledge/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          top_k: 4,
          min_score: 0.0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Search failed");
      setSearchResults(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Search failed";
      showToast(msg, true);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
      <CardContent sx={{ p: 0 }}>
        {/* Header */}
        <Box
          sx={{
            pb: 2.5,
            mb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" color="text.primary" gutterBottom sx={{ fontWeight: 700 }}>
            Vector DB Semantic Search Playground
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Performs real-time cosine distance queries (<code>1 - (embedding &lt;=&gt; query_vec)</code>) against PostgreSQL pgvector HNSW index.
          </Typography>
        </Box>

        {/* Search input form */}
        <Box
          component="form"
          onSubmit={handleSearch}
          sx={{ display: "flex", gap: 1.5, mb: 3, flexDirection: { xs: "column", sm: "row" } }}
        >
          <TextField
            fullWidth
            placeholder="Search by meaning (e.g. 'What is the database encryption standard?')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={isSearching || !searchQuery.trim()}
            startIcon={isSearching ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
            sx={{
              px: 3,
              whiteSpace: "nowrap",
              minHeight: 52,
              background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
            }}
          >
            {isSearching ? "Searching..." : "Search pgvector"}
          </Button>
        </Box>

        {/* Results */}
        {searchResults !== null && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Found {searchResults.length} relevant chunks:
            </Typography>

            {searchResults.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 4,
                  textAlign: "center",
                  bgcolor: (theme) =>
                    theme.palette.mode === "light"
                      ? "rgba(0, 0, 0, 0.02)"
                      : "rgba(255, 255, 255, 0.02)",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Typography color="text.secondary">
                  No matching chunks found in pgvector. Ingest more documents to expand the knowledge base!
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {searchResults.map((result, idx) => (
                  <Paper
                    key={idx}
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                      borderLeft: (theme) => `4px solid ${theme.palette.primary.main}`,
                      borderRadius: 2,
                      boxShadow: (theme) =>
                        theme.palette.mode === "light"
                          ? "0 2px 10px rgba(0, 0, 0, 0.03)"
                          : "none",
                      transition: "border-color 0.2s",
                      "&:hover": {
                        borderColor: "primary.light",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1.5,
                      }}
                    >
                      <Chip
                        icon={<SparklesIcon sx={{ fontSize: 14 }} />}
                        label={`${(result.similarity * 100).toFixed(1)}% Match`}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        Chunk #{result.chunk_index}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                      <DocIcon fontSize="small" color="primary" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.primary">
                        {result.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        (Doc ID: {result.doc_id.slice(0, 8)}...)
                      </Typography>
                    </Box>

                    <Paper
                      sx={{
                        p: 1.5,
                        bgcolor: (theme) =>
                          theme.palette.mode === "light"
                            ? "#f8fafc"
                            : "rgba(0, 0, 0, 0.35)",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        fontFamily: "monospace",
                        fontSize: "0.84rem",
                        color: (theme) =>
                          theme.palette.mode === "light" ? "#1e293b" : "#e2e8f0",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {result.content}
                    </Paper>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
