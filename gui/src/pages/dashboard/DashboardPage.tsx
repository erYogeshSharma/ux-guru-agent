import React from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { ROUTES } from '@/routes/config'

const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleSignOut = () => {
    logout()
    navigate({ to: ROUTES.AUTH })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3 }}>
        Welcome to your session recording dashboard.
      </Typography>

      <Button
        variant="contained"
        onClick={() => navigate({ to: ROUTES.SESSIONS })}
        sx={{ mr: 2 }}
      >
        View Sessions
      </Button>
      
      <Button
        variant="outlined"
        onClick={handleSignOut}
      >
        Sign Out
      </Button>
    </Box>
  )
}

export default DashboardPage
