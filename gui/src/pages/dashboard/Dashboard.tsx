// React import not required with new JSX transform
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Avatar,
} from "@mui/material";
import { Person, Business, Email } from "@mui/icons-material";
import { useAuth } from "@/shared/hooks/userAuth";
import { Profile } from "./MeShow";

const Dashboard = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Box>
        <Typography variant="h5">Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome back, {user.name}!
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Avatar sx={{ mr: 2, bgcolor: "primary.main" }}>
                <Person />
              </Avatar>
              <Typography variant="h6">User Information</Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <Email sx={{ mr: 1, color: "text.secondary" }} />
              <Typography variant="body1">{user.email}</Typography>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Chip
                label={user.role.toUpperCase()}
                color="primary"
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Avatar sx={{ mr: 2, bgcolor: "secondary.main" }}>
                <Business />
              </Avatar>
              <Typography variant="h6">Organization</Typography>
            </Box>

            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Name:</strong> {user.organization.name}
            </Typography>

            <Typography variant="body1" sx={{ mb: 1 }}>
              <strong>Company:</strong> {user.organization.companyName}
            </Typography>

            <Typography variant="body1">
              <strong>Email:</strong> {user.organization.email}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This is your dashboard. You can add more features and functionality
            here.
          </Typography>
        </CardContent>
      </Card>
      <Profile />
    </Box>
  );
};

export default Dashboard;
