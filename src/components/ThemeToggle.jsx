import { useEffect, useState } from "react";
import "./ThemeToggle.css";

export default function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("sheerwood-theme") === "dark");

  useEffect(() => {
    document.body.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("sheerwood-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return <button className="theme-toggle" type="button" onClick={() => setDarkMode((current) => !current)} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={darkMode}><span>{darkMode ? "☀" : "☾"}</span><b>{darkMode ? "Light" : "Dark"}</b></button>;
}
