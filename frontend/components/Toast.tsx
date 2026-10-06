"use client";

import React from "react";
import { Snackbar, Alert } from "@mui/material";
import { ToastMessage } from "@/types";

interface ToastProps {
  toast: ToastMessage | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <Snackbar
      open={!!toast}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{
        bottom: { xs: 16, sm: 24 },
        right: { xs: 16, sm: 24 },
      }}
    >
      <Alert
        severity={toast.isError ? "error" : "success"}
        variant="filled"
        sx={{
          borderRadius: 2,
          fontWeight: 600,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
          alignItems: "center",
        }}
      >
        {toast.message}
      </Alert>
    </Snackbar>
  );
};
