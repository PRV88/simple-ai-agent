"use client";

import React from "react";
import { Tabs, Tab, Box, Badge } from "@mui/material";
import {
  CloudUpload as IngestIcon,
  Search as SearchIcon,
  MenuBook as DocumentsIcon,
  SmartToy as ChatIcon,
} from "@mui/icons-material";
import { TabKey } from "@/types";

interface NavTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  documentCount: number;
}

export const NavTabs: React.FC<NavTabsProps> = ({
  activeTab,
  onTabChange,
  documentCount,
}) => {
  const handleChange = (_event: React.SyntheticEvent, newValue: TabKey) => {
    onTabChange(newValue);
  };

  return (
    <Box
      sx={{
        mb: 3,
        bgcolor: (theme) =>
          theme.palette.mode === "light"
            ? "rgba(0, 0, 0, 0.04)"
            : "rgba(17, 24, 39, 0.7)",
        backdropFilter: "blur(12px)",
        p: 0.75,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      <Tabs
        value={activeTab}
        onChange={handleChange}
        textColor="primary"
        indicatorColor="primary"
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: "44px",
          "& .MuiTabs-indicator": {
            height: 3,
            borderRadius: "3px 3px 0 0",
            background: "linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%)",
          },
          "& .MuiTab-root": {
            minHeight: "44px",
            py: 1,
            px: 2.2,
            borderRadius: 2,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "text.secondary",
            textTransform: "none",
            transition: "all 0.2s",
            gap: 1,
            "&.Mui-selected": {
              color: "primary.main",
              bgcolor: (theme) =>
                theme.palette.mode === "light"
                  ? "#ffffff"
                  : "rgba(99, 102, 241, 0.12)",
              boxShadow: (theme) =>
                theme.palette.mode === "light"
                  ? "0 2px 6px rgba(0, 0, 0, 0.06)"
                  : "none",
            },
            "&:hover": {
              color: "text.primary",
              bgcolor: (theme) =>
                theme.palette.mode === "light"
                  ? "rgba(0, 0, 0, 0.04)"
                  : "rgba(255, 255, 255, 0.04)",
            },
          },
        }}
      >
        <Tab
          value="ingest"
          icon={<IngestIcon fontSize="small" />}
          iconPosition="start"
          label="Ingestion Pipeline"
        />
        <Tab
          value="search"
          icon={<SearchIcon fontSize="small" />}
          iconPosition="start"
          label="Vector Search"
        />
        <Tab
          value="documents"
          icon={<DocumentsIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <span>Knowledge Files</span>
              <Badge
                badgeContent={documentCount}
                color="primary"
                max={999}
                sx={{
                  "& .MuiBadge-badge": {
                    fontSize: "0.7rem",
                    height: 18,
                    minWidth: 18,
                    padding: "0 5px",
                    fontWeight: 700,
                  },
                }}
              />
            </Box>
          }
        />
        <Tab
          value="chat"
          icon={<ChatIcon fontSize="small" />}
          iconPosition="start"
          label="AI Agent Chat"
        />
      </Tabs>
    </Box>
  );
};
