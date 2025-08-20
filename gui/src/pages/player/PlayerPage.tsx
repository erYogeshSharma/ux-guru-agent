import React from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate, useParams } from '@tanstack/react-router'
import { SessionReplayContainer } from '@/components'
import { ROUTES } from '@/routes/config'

const PlayerPage: React.FC = () => {
  const navigate = useNavigate()
  const { sessionId } = useParams({ from: '/player/$sessionId' })

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Session Player - {sessionId}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate({ to: ROUTES.SESSIONS })}
        >
          Back to Sessions
        </Button>
      </Box>
      
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <SessionReplayContainer 
          wsUrl="ws://localhost:8080/ws"
          autoReconnect={true}
          maxReconnectAttempts={5}
        />
      </Box>
    </Box>
  )
}

export default PlayerPage
