"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  DeleteOutlined as DeleteIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { IngestedDocument, ChunkDetail } from "@/types";
import { formatFileSize } from "@/utils/format";

interface DocumentsViewProps {
  token: string;
  documents: IngestedDocument[];
  onRefresh: () => void;
  showToast: (message: string, isError?: boolean) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  token,
  documents,
  onRefresh,
  showToast,
}) => {
  const [selectedDocDetails, setSelectedDocDetails] = useState<{
    doc: IngestedDocument;
    chunks: ChunkDetail[];
  } | null>(null);

  const inspectDocument = async (docId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/admin/knowledge/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedDocDetails({ doc: data, chunks: data.chunks || [] });
      }
    } catch (e) {
      console.error("Failed to inspect document", e);
    }
  };

  const deleteDocument = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete '${filename}' and its pgvector embeddings?`))
      return;
    if (!token) return;

    try {
      const res = await fetch(`/admin/knowledge/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      showToast(`Document '${filename}' deleted.`);
      onRefresh();
      if (selectedDocDetails?.doc.id === docId) {
        setSelectedDocDetails(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      showToast(msg, true);
    }
  };

  return (
    <Card sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
      <CardContent sx={{ p: 0 }}>
        {/* Header toolbar */}
        <Box
          sx={{
            pb: 2.5,
            mb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }} color="text.primary">
              Ingested Knowledge Documents
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage knowledge assets and their persistent vector embeddings in pgvector.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            sx={{ borderColor: "divider" }}
          >
            Refresh
          </Button>
        </Box>

        {/* Table */}
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            bgcolor: "background.paper",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Table>
            <TableHead
              sx={{
                bgcolor: (theme) =>
                  theme.palette.mode === "light"
                    ? "rgba(0, 0, 0, 0.02)"
                    : "rgba(255, 255, 255, 0.02)",
              }}
            >
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.78rem" }}>DOCUMENT</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.78rem" }}>TYPE</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.78rem" }}>SIZE</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.78rem" }}>CHUNKS</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.78rem" }}>UPLOADED BY</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.78rem" }}>CREATED</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.78rem" }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                    No documents ingested yet. Go to Document Ingestion to upload your first file!
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    hover
                    sx={{
                      "&:hover": {
                        bgcolor: (theme) =>
                          theme.palette.mode === "light"
                            ? "rgba(0, 0, 0, 0.02)"
                            : "rgba(255, 255, 255, 0.02)",
                      },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600, color: "text.primary" }}>
                      {doc.filename}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={doc.file_type}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          bgcolor: (theme) =>
                            theme.palette.mode === "light"
                              ? "rgba(0, 0, 0, 0.05)"
                              : "rgba(255, 255, 255, 0.06)",
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                      {formatFileSize(doc.file_size)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${doc.total_chunks} chunks`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                      {doc.uploaded_by || "admin"}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                        <Tooltip title="View Chunks">
                          <IconButton
                            size="small"
                            onClick={() => inspectDocument(doc.id)}
                            color="primary"
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Document">
                          <IconButton
                            size="small"
                            onClick={() => deleteDocument(doc.id, doc.filename)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Chunks Inspector Dialog */}
        <Dialog
          open={!!selectedDocDetails}
          onClose={() => setSelectedDocDetails(null)}
          maxWidth="md"
          fullWidth
          slotProps={{
            paper: {
              sx: {
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 3,
              },
            },
          }}
        >
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Chunks Preview: {selectedDocDetails?.doc.filename}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total {selectedDocDetails?.chunks.length} chunks indexed in pgvector
              </Typography>
            </Box>
            <IconButton onClick={() => setSelectedDocDetails(null)} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ borderColor: "divider" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {selectedDocDetails?.chunks.map((chunk) => (
                <Paper
                  key={chunk.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: (theme) =>
                      theme.palette.mode === "light"
                        ? "#f8fafc"
                        : "rgba(17, 24, 39, 0.9)",
                    border: "1px solid",
                    borderColor: "divider",
                    borderLeft: (theme) => `4px solid ${theme.palette.primary.main}`,
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{ fontWeight: 700, display: "block", mb: 0.75 }}
                  >
                    Chunk #{chunk.chunk_index}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      color: (theme) =>
                        theme.palette.mode === "light" ? "#1e293b" : "#cbd5e1",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                    }}
                  >
                    {chunk.content}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setSelectedDocDetails(null)} variant="outlined">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};
