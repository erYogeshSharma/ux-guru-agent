import { AppThemeProvider } from "@/contexts/ThemeContext";
import { Router } from "@/routes";

const App = () => {
  return (
    <AppThemeProvider>
      <Router />
    </AppThemeProvider>
  );
};

export default App;
