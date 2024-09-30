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
  baseTabs as locustBaseTabs,
} from 'locust-ui';

import Layout from 'components/Layout/Layout';
import Snackbar from 'components/Snackbar/Snackbar';
import Charts from 'components/tabs/Charts';
import Scatterplot from 'components/tabs/Scatterplot';
import Stats from 'components/tabs/Stats';
import Testruns from 'components/tabs/Testruns';
import useFetchTestruns from 'hooks/useFetchTestruns';
import { useLocustSelector, useSelector } from 'redux/hooks';
import { UI_VIEW_TYPES } from 'redux/slice/ui.slice';

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
  const viewType = useSelector(({ ui }) => ui.viewType);

  const theme = useCreateTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout>
        {!window.templateArgs.isGraphViewer && swarmState === SWARM_STATE.READY ? (
          <SwarmForm />
        ) : (
          <Tabs tabs={viewType == UI_VIEW_TYPES.CLOUD ? tabs : locustBaseTabs} />
        )}
      </Layout>
      <Snackbar />
    </ThemeProvider>
  );
}
