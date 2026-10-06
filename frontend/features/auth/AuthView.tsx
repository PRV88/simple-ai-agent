"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Stack,
  InputAdornment,
} from "@mui/material";
import {
  Login as LoginIcon,
  PersonAdd as PersonAddIcon,
  AccountCircle as UserIcon,
  Email as EmailIcon,
  Badge as BadgeIcon,
  Key as KeyIcon,
} from "@mui/icons-material";
import { UserProfile } from "@/types";

interface AuthViewProps {
  onAuthSuccess: (token: string, user: UserProfile) => void;
  showToast: (message: string, isError?: boolean) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, showToast }) => {
  const [authIndex, setAuthIndex] = useState(0); // 0 = login, 1 = register
  const [loginForm, setLoginForm] = useState({ username_or_email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      onAuthSuccess(data.access_token, data.user);
      showToast(`Welcome back, ${data.user.username}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      showToast(msg, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...registerForm, role: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      showToast("Admin account registered! Logging in...");
      const loginRes = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_email: registerForm.username,
          password: registerForm.password,
        }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        onAuthSuccess(loginData.access_token, loginData.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      showToast(msg, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 460, mx: "auto", my: 6 }}>
      <Card
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: 3,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: (theme) =>
            theme.palette.mode === "light"
              ? "0 10px 30px -5px rgba(0,0,0,0.06)"
              : "0 20px 40px -15px rgba(0,0,0,0.5)",
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography variant="h5" color="text.primary" gutterBottom sx={{ fontWeight: 700 }}>
              Admin Portal
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Material Design Knowledge Engine & Vector Workspace
            </Typography>
          </Box>

          <Tabs
            value={authIndex}
            onChange={(_e, v) => setAuthIndex(v)}
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
            sx={{
              mb: 3,
              bgcolor: (theme) =>
                theme.palette.mode === "light"
                  ? "rgba(0, 0, 0, 0.04)"
                  : "rgba(255, 255, 255, 0.03)",
              borderRadius: 2,
              p: 0.5,
              "& .MuiTab-root": {
                fontWeight: 600,
                borderRadius: 1.5,
                minHeight: 40,
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "primary.main",
                  bgcolor: (theme) =>
                    theme.palette.mode === "light"
                      ? "#ffffff"
                      : "rgba(99, 102, 241, 0.15)",
                  boxShadow: (theme) =>
                    theme.palette.mode === "light"
                      ? "0 2px 6px rgba(0, 0, 0, 0.06)"
                      : "none",
                },
              },
            }}
          >
            <Tab label="Sign In" icon={<LoginIcon fontSize="small" />} iconPosition="start" />
            <Tab label="Register" icon={<PersonAddIcon fontSize="small" />} iconPosition="start" />
          </Tabs>

          {authIndex === 0 ? (
            <Box component="form" onSubmit={handleLogin}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Username or Email"
                  placeholder="admin or admin@simple-ai.dev"
                  value={loginForm.username_or_email}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username_or_email: e.target.value })
                  }
                  required
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <UserIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  required
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <KeyIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                  sx={{
                    mt: 1,
                    py: 1.3,
                    background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
                    },
                  }}
                >
                  {isLoading ? "Signing in..." : "Sign In to Admin Portal"}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleRegister}>
              <Stack spacing={2.2}>
                <TextField
                  fullWidth
                  label="Admin Username"
                  placeholder="admin"
                  value={registerForm.username}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, username: e.target.value })
                  }
                  required
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <UserIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  fullWidth
                  type="email"
                  label="Email Address"
                  placeholder="admin@simple-ai.dev"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  required
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="Full Name"
                  placeholder="System Administrator"
                  value={registerForm.full_name}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, full_name: e.target.value })
                  }
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Password"
                  placeholder="At least 6 characters"
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, password: e.target.value })
                  }
                  required
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <KeyIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PersonAddIcon />}
                  sx={{
                    mt: 1,
                    py: 1.3,
                    background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #4338ca 0%, #312e81 100%)",
                    },
                  }}
                >
                  {isLoading ? "Creating account..." : "Create Admin Account"}
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
