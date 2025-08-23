import { createContext } from "react";

interface ThemeContextType {
  mode: "light" | "dark";
  setMode: (mode: "light" | "dark") => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);
