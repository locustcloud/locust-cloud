import LocustUi, { tabConfig } from 'locust-ui';

import { theme } from 'styles/theme';
import Charts from 'tabs/Charts';
import Scatterplot from 'tabs/Scatterplot';
import Stats from 'tabs/Stats';

const tabs = [
  {
    title: 'Charts',
    key: 'charts',
    component: Charts,
  },
  {
    title: 'Stats',
    key: 'stats',
    component: Stats,
  },
  {
    title: 'Scatterplot',
    key: 'scatterplot',
    component: Scatterplot,
  },
  tabConfig.exceptions,
  tabConfig.logs,
  tabConfig.ratios,
  tabConfig.workers,
  tabConfig.reports,
];

export default function App() {
  return <LocustUi extendedTheme={theme} tabs={tabs} />;
}
