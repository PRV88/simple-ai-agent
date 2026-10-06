"use client";

import React from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Chip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  CloudUploadOutlined as IngestIcon,
  SearchOutlined as SearchIcon,
  DescriptionOutlined as DocIcon,
  ChatOutlined as PlaygroundIcon,
  SmartToyOutlined as AgentStudioIcon,
  CodeOutlined as WidgetIcon,
  BarChartOutlined as AnalyticsIcon,
  Bolt as BoltIcon,
} from "@mui/icons-material";
import { TabKey, UserProfile } from "@/types";

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  documentCount?: number;
  user: UserProfile | null;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const SIDEBAR_WIDTH = 260;

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  documentCount = 0,
  user,
  mobileOpen,
  onMobileClose,
}) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const navSections: NavSection[] = [
    {
      title: "Knowledge Vault",
      items: [
        {
          key: "documents",
          label: "Documents",
          icon: <DocIcon fontSize="small" />,
          badge: documentCount > 0 ? documentCount : undefined,
        },
        {
          key: "ingest",
          label: "Ingestion & Upload",
          icon: <IngestIcon fontSize="small" />,
        },
        {
          key: "search",
          label: "Vector Similarity",
          icon: <SearchIcon fontSize="small" />,
        },
      ],
    },
    {
      title: "Agent Studio",
      items: [
        {
          key: "agent",
          label: "Agent Configuration",
          icon: <AgentStudioIcon fontSize="small" />,
        },
        {
          key: "chat",
          label: "Test Playground",
          icon: <PlaygroundIcon fontSize="small" />,
        },
      ],
    },
    {
      title: "Distribution & Ops",
      items: [
        {
          key: "widget",
          label: "Deploy Widget",
          icon: <WidgetIcon fontSize="small" />,
        },
        {
          key: "analytics",
          label: "Token & Cost Analytics",
          icon: <AnalyticsIcon fontSize="small" />,
        },
      ],
    },
  ];

  const drawerContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: theme.palette.mode === "light" ? "#f8fafc" : "#111827",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          p: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "9px",
            background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(79, 70, 229, 0.25)",
          }}
        >
          <BoltIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Simple AI Agent
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>
            Multi-Tenant Knowledge Hub
          </Typography>
        </Box>
      </Box>

      {/* Navigation Sections */}
      <Box sx={{ flex: 1, py: 1.5, overflowY: "auto" }}>
        {navSections.map((section, sIdx) => (
          <Box key={section.title} sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{
                px: 3,
                py: 0.5,
                display: "block",
                fontWeight: 700,
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "text.secondary",
              }}
            >
              {section.title}
            </Typography>
            <List dense disablePadding sx={{ px: 1.5, mt: 0.5 }}>
              {section.items.map((item) => {
                const isActive = activeTab === item.key;
                return (
                  <ListItem key={item.key} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      selected={isActive}
                      onClick={() => {
                        onTabChange(item.key);
                        if (!isDesktop) onMobileClose();
                      }}
                      sx={{
                        borderRadius: "8px",
                        py: 0.85,
                        px: 1.5,
                        transition: "all 0.15s ease",
                        "&.Mui-selected": {
                          bgcolor:
                            theme.palette.mode === "light"
                              ? "rgba(79, 70, 229, 0.1)"
                              : "rgba(99, 102, 241, 0.2)",
                          color: "primary.main",
                          fontWeight: 600,
                          "&:hover": {
                            bgcolor:
                              theme.palette.mode === "light"
                                ? "rgba(79, 70, 229, 0.15)"
                                : "rgba(99, 102, 241, 0.25)",
                          },
                        },
                        "&:hover": {
                          bgcolor:
                            theme.palette.mode === "light"
                              ? "rgba(0, 0, 0, 0.04)"
                              : "rgba(255, 255, 255, 0.04)",
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 32,
                          color: isActive ? "primary.main" : "text.secondary",
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontSize: "0.86rem", fontWeight: isActive ? 600 : 500 }}>
                            {item.label}
                          </Typography>
                        }
                      />
                      {item.badge !== undefined && (
                        <Chip
                          label={item.badge}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            bgcolor: isActive
                              ? "primary.main"
                              : theme.palette.mode === "light"
                              ? "#e2e8f0"
                              : "#374151",
                            color: isActive ? "#ffffff" : "text.primary",
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
            {sIdx < navSections.length - 1 && (
              <Divider sx={{ my: 1.5, mx: 2, opacity: 0.6 }} />
            )}
          </Box>
        ))}
      </Box>

      {/* Footer Info */}
      {user && (
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: theme.palette.mode === "light" ? "#f1f5f9" : "#1f2937",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.82rem" }}>
                {user.username}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Admin (Isolated Realm)
              </Typography>
            </Box>
            <Chip
              label="Active"
              size="small"
              color="success"
              variant="outlined"
              sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      {/* Desktop Permanent Drawer */}
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: SIDEBAR_WIDTH,
              boxSizing: "border-box",
              border: "none",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      ) : (
        /* Mobile Temporary Drawer */
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: SIDEBAR_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
};
