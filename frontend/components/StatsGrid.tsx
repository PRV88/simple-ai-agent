"use client";

import React from "react";
import { Grid, Card, CardContent, Typography, Box } from "@mui/material";
import {
  Storage as StorageIcon,
  Description as DescriptionIcon,
  AutoAwesomeMotion as LayersIcon,
  Group as GroupIcon,
} from "@mui/icons-material";
import { AdminStats } from "@/types";

interface StatsGridProps {
  stats: AdminStats | null;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  const cards = [
    {
      title: "Vector Database",
      value: "PostgreSQL",
      subtitle: stats ? `pgvector: ${stats.pgvector_status}` : "Connecting...",
      icon: <StorageIcon sx={{ color: "#4f46e5" }} />,
      glowColor: "rgba(79, 70, 229, 0.12)",
    },
    {
      title: "Knowledge Files",
      value: stats?.total_documents ?? 0,
      subtitle: "Ingested Documents",
      icon: <DescriptionIcon sx={{ color: "#0284c7" }} />,
      glowColor: "rgba(2, 132, 199, 0.12)",
    },
    {
      title: "Vector Chunks",
      value: stats?.total_chunks ?? 0,
      subtitle: stats ? `${stats.vector_dimension}-dim HNSW` : "768-dim",
      icon: <LayersIcon sx={{ color: "#9333ea" }} />,
      glowColor: "rgba(147, 51, 234, 0.12)",
    },
    {
      title: "System Admins",
      value: stats?.total_users ?? 1,
      subtitle: "Active Accounts",
      icon: <GroupIcon sx={{ color: "#16a34a" }} />,
      glowColor: "rgba(22, 163, 74, 0.12)",
    },
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {cards.map((card, idx) => (
          <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                height: "100%",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: (theme) =>
                  theme.palette.mode === "light"
                    ? "0 4px 12px rgba(0, 0, 0, 0.04)"
                    : "none",
                transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  borderColor: "primary.main",
                  boxShadow: (theme) =>
                    theme.palette.mode === "light"
                      ? "0 8px 20px rgba(79, 70, 229, 0.1)"
                      : "0 8px 20px rgba(0, 0, 0, 0.4)",
                },
              }}
            >
              <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: "text.secondary",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {card.title}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: "6px",
                      bgcolor: card.glowColor,
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary", mb: 0.5 }}>
                  {card.value}
                </Typography>
                <Typography variant="body2" sx={{ color: "secondary.main", fontSize: "0.8rem", fontWeight: 500 }}>
                  {card.subtitle}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
