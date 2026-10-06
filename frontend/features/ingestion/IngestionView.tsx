"use client";

import React, { useState, useRef } from "react";
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Stack,
  IconButton,
  Paper,
} from "@mui/material";
import {
  CloudUpload as UploadIcon,
  NoteAdd as NoteAddIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  Bolt as BoltIcon,
} from "@mui/icons-material";
import { formatFileSize } from "@/utils/format";

interface IngestionViewProps {
  token: string;
  onIngestSuccess: () => void;
  showToast: (message: string, isError?: boolean) => void;
}

export const IngestionView: React.FC<IngestionViewProps> = ({
  token,
  onIngestSuccess,
  showToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [isIngestingText, setIsIngestingText] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !token) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/admin/knowledge/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "File ingestion failed");

      showToast(`Success! Ingested ${data.total_chunks} chunks into pgvector.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onIngestSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      showToast(msg, true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleIngestText = async () => {
    if (!textTitle.trim() || !textContent.trim() || !token) {
      showToast("Please provide both title and content", true);
      return;
    }
    setIsIngestingText(true);

    try {
      const res = await fetch("/admin/knowledge/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: textTitle.trim(),
          content: textContent.trim(),
          metadata: { ingested_via: "nextjs_material_dashboard" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Text ingestion failed");

      showToast(`Ingested ${data.total_chunks} chunks into pgvector!`);
      setTextTitle("");
      setTextContent("");
      onIngestSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ingestion failed";
      showToast(msg, true);
    } finally {
      setIsIngestingText(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
      <CardContent sx={{ p: 0 }}>
        {/* Header Section */}
        <Box
          sx={{
            pb: 2.5,
            mb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} color="text.primary">
                Document Knowledge Ingestion Pipeline
              </Typography>
              <Chip
                icon={<BoltIcon sx={{ fontSize: 16 }} />}
                label="768-dim Gemini"
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontWeight: 700, fontSize: "0.72rem" }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Parses raw documents, creates semantic chunks, generates vector embeddings, and indexes in PostgreSQL pgvector.
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3.5}>
          {/* File Upload Dropzone */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }} color="text.primary">
              Upload Knowledge Documents (.pdf, .txt, .md, .csv, .json)
            </Typography>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.txt,.md,.markdown,.csv,.json"
              style={{ display: "none" }}
            />

            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: "2px dashed",
                borderColor: (theme) =>
                  isDragging
                    ? "primary.main"
                    : theme.palette.mode === "light"
                    ? "rgba(79, 70, 229, 0.3)"
                    : "rgba(99, 102, 241, 0.35)",
                borderRadius: 2.5,
                bgcolor: (theme) =>
                  isDragging
                    ? theme.palette.mode === "light"
                      ? "rgba(79, 70, 229, 0.08)"
                      : "rgba(99, 102, 241, 0.1)"
                    : theme.palette.mode === "light"
                    ? "#f8fafc"
                    : "rgba(99, 102, 241, 0.03)",
                p: 4,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.25s",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: (theme) =>
                    theme.palette.mode === "light"
                      ? "rgba(79, 70, 229, 0.04)"
                      : "rgba(99, 102, 241, 0.06)",
                },
              }}
            >
              <UploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 600 }} color="text.primary">
                Drag & drop files here, or browse
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Supports PDF reports, Markdown manuals, CSV/JSON structured datasets
              </Typography>
            </Box>

            {selectedFile && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  mt: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "light"
                      ? "#f8fafc"
                      : "rgba(255, 255, 255, 0.03)",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <FileIcon color="primary" />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.primary">
                        {selectedFile.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(selectedFile.size)}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  startIcon={isUploading ? <CircularProgress size={18} color="inherit" /> : <UploadIcon />}
                  sx={{
                    mt: 2,
                    background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                  }}
                >
                  {isUploading ? "Computing embeddings & saving to pgvector..." : "Run Ingestion Pipeline"}
                </Button>
              </Paper>
            )}
          </Grid>

          {/* Text Note Ingestion */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }} color="text.primary">
              Direct Text Notes or Compliance Guidelines
            </Typography>

            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Document Title"
                placeholder="e.g. Return Policy & Compliance Guidelines 2026"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
              <TextField
                fullWidth
                multiline
                rows={5}
                label="Document Content"
                placeholder="Paste reference text, guidelines, or knowledge base articles here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleIngestText}
                disabled={isIngestingText || !textTitle.trim() || !textContent.trim()}
                startIcon={isIngestingText ? <CircularProgress size={18} color="inherit" /> : <NoteAddIcon />}
                sx={{ py: 1.2, fontWeight: 600 }}
              >
                {isIngestingText ? "Embedding text into pgvector..." : "Ingest Text Note"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
