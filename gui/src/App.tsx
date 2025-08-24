import { AppThemeProvider } from "@/contexts/ThemeContext";
import { Router } from "@/routes";
import "./App.css";
const App = () => {
  return (
    <AppThemeProvider>
      <Router />
    </AppThemeProvider>
  );
};

export default App;
