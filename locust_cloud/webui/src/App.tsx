import { CssBaseline, ThemeProvider } from '@mui/material';
import {
  SWARM_STATE,
  tabConfig,
  Tabs,
  useCreateTheme,
  useFetchExceptions,
  useFetchStats,
  useFetchTasks,
  useLogViewer,
  baseTabs as locustBaseTabs,
  SwarmForm,
} from 'locust-ui';

import Layout from 'components/Layout/Layout';
import Snackbar from 'components/Snackbar/Snackbar';
import Charts from 'components/tabs/Charts';
import Customer from 'components/tabs/Customer';
import Scatterplot from 'components/tabs/Scatterplot';
import Stats from 'components/tabs/Stats';
import Testruns from 'components/tabs/Testruns';
import useFetchTestruns from 'hooks/useFetchTestruns';
import useSwarmForm from 'hooks/useSwarmForm';
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
  tabConfig.logs,
  tabConfig.workers,
  tabConfig.reports,
  {
    title: 'Customer',
    key: 'customer',
    component: Customer,
  },
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
  {
    title: 'Customer',
    key: 'customer',
    component: Customer,
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
  const { alert, shouldDisableForm, handleFormChange } = useSwarmForm();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout>
        {!window.templateArgs.isGraphViewer && swarmState === SWARM_STATE.READY ? (
          <SwarmForm alert={alert} isDisabled={shouldDisableForm} onFormChange={handleFormChange} />
        ) : (
          <Tabs tabs={viewType == UI_VIEW_TYPES.CLOUD ? tabs : locustBaseTabs} />
        )}
      </Layout>
      <Snackbar />
    </ThemeProvider>
  );
}
