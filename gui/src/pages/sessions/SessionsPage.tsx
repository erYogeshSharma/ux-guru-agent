import React, { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from '@tanstack/react-router'
import { SessionHistoryList } from '@/components'
import { ROUTES, getPlayerRoute } from '@/routes/config'

const SessionsPage: React.FC = () => {
  const navigate = useNavigate()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (startTime: number, lastActivity: number) => {
    const duration = lastActivity - startTime
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    navigate({ to: getPlayerRoute(sessionId) })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Session Recordings
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate({ to: ROUTES.DASHBOARD })}
        >
          Back to Dashboard
        </Button>
      </Box>
      
      <SessionHistoryList 
        selectedSessionId={selectedSessionId}
        onSessionSelect={handleSessionSelect}
        formatTime={formatTime}
        formatDuration={formatDuration}
      />
    </Box>
  )
}

export default SessionsPage
