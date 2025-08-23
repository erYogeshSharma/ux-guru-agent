import React, { useState, useEffect, useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import createAppTheme from "@/config/theme";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeContext } from "./theme.context";

const STORAGE_KEY = "theme";

interface AppThemeProviderProps {
  children: React.ReactNode;
}

export const AppThemeProvider: React.FC<AppThemeProviderProps> = ({
  children,
}) => {
  const [mode, setMode] = useState<"light" | "dark">("light");

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as "light" | "dark" | null;
    if (stored === "light" || stored === "dark") {
      setMode(stored);
    }
  }, []);

  // Persist when mode changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const contextValue = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};
