import LocustUi, { tabConfig } from 'locust-ui';

import Charts from 'components/tabs/Charts';
import Scatterplot from 'components/tabs/Scatterplot';
import Stats from 'components/tabs/Stats';
import Testruns from 'components/tabs/Testruns';
import useFetchTestruns from 'hooks/useFetchTestruns';

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
  {
    title: 'Testruns',
    key: 'testruns',
    component: Testruns,
  },
  tabConfig.exceptions,
  tabConfig.logs,
  tabConfig.ratios,
  tabConfig.workers,
  tabConfig.reports,
];

export default function App() {
  useFetchTestruns();

  return <LocustUi tabs={tabs} />;
}
