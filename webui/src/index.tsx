import React from "react";
import ReactDOM from "react-dom/client";
import LocustUi, { baseTabs } from "locust-ui";
import Timescale from "Timescale";
import Scatterplot from "Scatterplot";

const tabs = [...baseTabs];
tabs.splice(2, 0, {
  title: "Timescale",
  key: "timescale",
  component: Timescale,
});
tabs.splice(3, 0, {
  title: "Scatterplot",
  key: "scatterplot",
  component: Scatterplot,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <LocustUi tabs={tabs} />
);
