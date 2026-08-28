import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { registerServiceWorker } from "./services/service-worker-registration";
import { initInstallPromptCapture } from "./services/install-prompt";

initInstallPromptCapture();
registerServiceWorker();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.Fragment>
    <App />
  </React.Fragment>,
);
