import IconButton from "@mui/material/IconButton";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";

type Props = {
  mode: "light" | "dark";
  setMode: (m: "light" | "dark") => void;
};

export const ToggleTheme = ({ mode, setMode }: Props) => {
  return (
    <IconButton
      aria-label="toggle theme"
      onClick={() => setMode(mode === "light" ? "dark" : "light")}
      color="inherit"
    >
      {mode === "light" ? <Brightness4Icon /> : <Brightness7Icon />}
    </IconButton>
  );
};
