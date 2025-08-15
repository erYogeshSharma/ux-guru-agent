import React from "react";
import { Alert, AlertTitle, IconButton } from "@mui/material";
import { Close } from "@mui/icons-material";

interface ErrorAlertProps {
  error: string | null;
  onClose: () => void;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <Alert
      severity="error"
      action={
        <IconButton color="inherit" size="small" onClick={onClose}>
          <Close fontSize="inherit" />
        </IconButton>
      }
      sx={{ mx: 2, mt: 1 }}
    >
      <AlertTitle>Connection Error</AlertTitle>
      {error}
    </Alert>
  );
};

export default ErrorAlert;
