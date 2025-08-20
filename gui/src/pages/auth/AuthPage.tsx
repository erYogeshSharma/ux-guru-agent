import React from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/routes/config'

const AuthPage: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSignIn = () => {
    login()
    navigate({ to: ROUTES.DASHBOARD })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h4" gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body2" sx={{ mb: 3 }}>
          Sign in to access your session recordings
        </Typography>
        <Button
          variant="contained"
          fullWidth
          onClick={handleSignIn}
          size="large"
        >
          Sign In
        </Button>
      </Paper>
    </Box>
  )
}

export default AuthPage
