import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initTheme } from "./hooks/useTheme";
import "./index.css";

initTheme();

createRoot(document.getElementById("root")!).render(<App />);
