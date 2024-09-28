import { CssBaseline, ThemeProvider } from '@mui/material';
import {
  SWARM_STATE,
  SwarmForm,
  tabConfig,
  Tabs,
  useCreateTheme,
  useFetchExceptions,
  useFetchStats,
  useFetchTasks,
  useLogViewer,
} from 'locust-ui';

import Layout from 'components/Layout/Layout';
import Charts from 'components/tabs/Charts';
import Scatterplot from 'components/tabs/Scatterplot';
import Stats from 'components/tabs/Stats';
import Testruns from 'components/tabs/Testruns';
import useFetchTestruns from 'hooks/useFetchTestruns';
import { useLocustSelector } from 'redux/hooks';

const baseTabs = [
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

const graphViewerTabs = [
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
];

const tabs = window.templateArgs.isGraphViewer ? graphViewerTabs : baseTabs;

export default function App() {
  useFetchStats();
  useFetchExceptions();
  useFetchTasks();
  useLogViewer();
  useFetchTestruns();

  const swarmState = useLocustSelector(({ swarm }) => swarm.state);

  const theme = useCreateTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout>
        {!window.templateArgs.isGraphViewer && swarmState === SWARM_STATE.READY ? (
          <SwarmForm />
        ) : (
          <Tabs tabs={tabs} />
        )}
      </Layout>
    </ThemeProvider>
  );
}
