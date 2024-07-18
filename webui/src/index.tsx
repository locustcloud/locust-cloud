import React from "react";
import ReactDOM from "react-dom/client";
import LocustUi, { baseTabs } from "locust-ui";
import Timescale from "Timescale";

const tabs = [...baseTabs];
tabs.splice(2, 0, {
  title: "Timescale",
  key: "timescale",
  component: Timescale,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <LocustUi tabs={tabs} />
);
