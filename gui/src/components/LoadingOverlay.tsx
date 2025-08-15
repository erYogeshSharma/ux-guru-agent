import React from "react";
import { Backdrop, CircularProgress, Typography, Stack } from "@mui/material";

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open,
  message = "Loading session...",
}) => {
  return (
    <Backdrop
      open={open}
      sx={{
        color: "common.white",
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Stack alignItems="center" spacing={2}>
        <CircularProgress color="inherit" />
        <Typography>{message}</Typography>
      </Stack>
    </Backdrop>
  );
};

export default LoadingOverlay;
