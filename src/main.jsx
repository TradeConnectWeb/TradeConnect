import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { getFirebaseApp } from "./firebase.js";

getFirebaseApp()
  .then(() => {
    console.log("Firebase initialized");
    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
  })
  .catch((err) => {
    console.error("Firebase init error:", err);
  });
