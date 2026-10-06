"use client";

import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Box,
  Tooltip,
} from "@mui/material";
import {
  Logout as LogoutIcon,
  Storage as StorageIcon,
  Bolt as BoltIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { UserProfile } from "@/types";

interface HeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
  onNavigateHome: () => void;
  themeMode?: "light" | "dark";
  onToggleThemeMode?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onNavigateHome,
  themeMode = "light",
  onToggleThemeMode,
  onToggleSidebar,
}) => {
  const envBadgeLabel =
    process.env.NEXT_PUBLIC_APP_ENV === "production"
      ? "PROD"
      : process.env.NEXT_PUBLIC_APP_ENV === "staging"
        ? "STAGE"
        : "DEV";

  const envColor: "error" | "warning" | "success" =
    envBadgeLabel === "PROD"
      ? "error"
      : envBadgeLabel === "STAGE"
        ? "warning"
        : "success";

  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? "rgba(255, 255, 255, 0.85)"
            : "rgba(17, 24, 39, 0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid",
        borderColor: "divider",
        boxShadow: (theme) =>
          theme.palette.mode === "light"
            ? "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
            : "none",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between", minHeight: "64px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {onToggleSidebar && user && (
            <IconButton
              size="small"
              onClick={onToggleSidebar}
              sx={{ display: { xs: "flex", md: "none" }, mr: 0.5, color: "text.primary" }}
              aria-label="Toggle navigation drawer"
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer" }}
            onClick={onNavigateHome}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "8px",
                background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
                color: "#fff",
              }}
            >
              <BoltIcon fontSize="small" />
            </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "text.primary",
            }}
          >
            Simple AI
          </Typography>


            <Chip
              label={envBadgeLabel}
              size="small"
              color={envColor}
              sx={{ fontSize: "0.7rem", fontWeight: 700, height: 22 }}
            />
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {onToggleThemeMode && (
            <Tooltip title={`Switch to ${themeMode === "light" ? "Dark" : "Light"} Mode`}>
              <IconButton
                size="small"
                onClick={onToggleThemeMode}
                sx={{
                  color: "text.secondary",
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: (theme) =>
                    theme.palette.mode === "light"
                      ? "rgba(0, 0, 0, 0.02)"
                      : "rgba(255, 255, 255, 0.04)",
                  "&:hover": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "light"
                        ? "rgba(0, 0, 0, 0.06)"
                        : "rgba(255, 255, 255, 0.08)",
                  },
                }}
              >
                {themeMode === "light" ? (
                  <DarkModeIcon fontSize="small" />
                ) : (
                  <LightModeIcon fontSize="small" sx={{ color: "#fbbf24" }} />
                )}
              </IconButton>
            </Tooltip>
          )}

          {user ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                backgroundColor: (theme) =>
                  theme.palette.mode === "light"
                    ? "rgba(0, 0, 0, 0.03)"
                    : "rgba(255, 255, 255, 0.05)",
                padding: "4px 8px 4px 12px",
                borderRadius: "24px",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  bgcolor: "primary.main",
                  color: "#fff",
                }}
              >
                {user.username.slice(0, 2).toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                {user.username}
              </Typography>
              <Chip
                label={user.role}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  bgcolor: "rgba(79, 70, 229, 0.12)",
                  color: "primary.main",
                }}
              />
              <Tooltip title="Sign Out">
                <IconButton size="small" onClick={onLogout} sx={{ color: "text.secondary" }}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Admin Portal
            </Typography>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
