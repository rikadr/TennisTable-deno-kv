import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

import { TableTennisSnowfall } from "./components/table-tennis-snowfall";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.Fragment>
    <TableTennisSnowfall />
    <App />
  </React.Fragment>,
);
