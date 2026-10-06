"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ThemeProvider, CssBaseline, Box, Container } from "@mui/material";
import { lightTheme, darkTheme } from "@/theme/theme";
import { UserProfile, AdminStats, IngestedDocument, ToastMessage, TabKey } from "@/types";
import { Header, Toast, StatsGrid, Sidebar } from "@/components";
import {
  AuthView,
  IngestionView,
  SearchView,
  DocumentsView,
  ChatView,
  AgentStudioView,
  DeployWidgetView,
  TokenAnalyticsView,
} from "@/features";

export default function AdminDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("agent");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("simple_ai_theme_mode", next);
      return next;
    });
  }, []);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("simple_ai_token");
    setToken(null);
    setUser(null);
    showToast("Logged out successfully");
  }, [showToast]);

  const fetchUserProfile = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    }
  }, [handleLogout]);

  const loadStats = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/admin/stats", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  }, []);

  const loadDocuments = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/admin/knowledge/documents", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error("Failed to load documents", e);
    }
  }, []);

  const refreshData = useCallback(() => {
    if (token) {
      loadStats(token);
      loadDocuments(token);
    }
  }, [token, loadStats, loadDocuments]);

  // Load saved theme and auth token on mount
  useEffect(() => {
    let isMounted = true;
    const initApp = async () => {
      const savedTheme = localStorage.getItem("simple_ai_theme_mode");
      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeMode(savedTheme);
      } else {
        setThemeMode("light");
      }

      const savedToken = localStorage.getItem("simple_ai_token");
      if (savedToken && isMounted) {
        setToken(savedToken);
        await fetchUserProfile(savedToken);
      }
    };
    initApp();
    return () => {
      isMounted = false;
    };
  }, [fetchUserProfile]);

  // Refresh stats & documents whenever token changes
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      if (token && isMounted) {
        await loadStats(token);
        await loadDocuments(token);
      }
    };
    initData();
    return () => {
      isMounted = false;
    };
  }, [token, loadStats, loadDocuments]);

  const handleAuthSuccess = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem("simple_ai_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const currentTheme = themeMode === "light" ? lightTheme : darkTheme;

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
        {!user || !token ? (
          /* Logged out state */
          <Box>
            <Header
              user={null}
              onLogout={handleLogout}
              onNavigateHome={() => {}}
              themeMode={themeMode}
              onToggleThemeMode={toggleThemeMode}
            />
            <Container maxWidth="lg" sx={{ py: 6 }}>
              <AuthView onAuthSuccess={handleAuthSuccess} showToast={showToast} />
            </Container>
          </Box>
        ) : (
          /* Authenticated portal with Side Navigation layout */
          <Box sx={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              documentCount={documents.length}
              user={user}
              mobileOpen={mobileOpen}
              onMobileClose={() => setMobileOpen(false)}
            />

            {/* Main Content Area */}
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                bgcolor: "background.default",
              }}
            >
              <Header
                user={user}
                onLogout={handleLogout}
                onNavigateHome={() => setActiveTab("agent")}
                themeMode={themeMode}
                onToggleThemeMode={toggleThemeMode}
                onToggleSidebar={() => setMobileOpen((prev) => !prev)}
              />

              <Container maxWidth="xl" sx={{ py: 3.5, px: { xs: 2, sm: 3 } }}>
                {/* Stats grid visible on knowledge vault views */}
                {["documents", "ingest", "search"].includes(activeTab) && (
                  <Box sx={{ mb: 3 }}>
                    <StatsGrid stats={stats} />
                  </Box>
                )}

                {/* View Switching */}
                {activeTab === "agent" && (
                  <AgentStudioView
                    token={token}
                    showToast={showToast}
                    onNavigateToPlayground={() => setActiveTab("chat")}
                    onNavigateToWidget={() => setActiveTab("widget")}
                  />
                )}

                {activeTab === "ingest" && (
                  <IngestionView
                    token={token}
                    onIngestSuccess={refreshData}
                    showToast={showToast}
                  />
                )}

                {activeTab === "search" && (
                  <SearchView token={token} showToast={showToast} />
                )}

                {activeTab === "documents" && (
                  <DocumentsView
                    token={token}
                    documents={documents}
                    onRefresh={refreshData}
                    showToast={showToast}
                  />
                )}

                {activeTab === "chat" && <ChatView token={token} />}

                {activeTab === "widget" && (
                  <DeployWidgetView token={token} showToast={showToast} />
                )}

                {activeTab === "analytics" && (
                  <TokenAnalyticsView token={token} showToast={showToast} />
                )}
              </Container>
            </Box>
          </Box>
        )}

        <Toast toast={toast} />
      </Box>
    </ThemeProvider>
  );
}
