import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import useFetchTestruns from 'hooks/useFetchTestruns';
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
import { useLocustSelector } from 'redux/hooks';
// import Scatterplot from 'components/tabs/Scatterplot';
// import Stats from 'components/tabs/Stats';

const tabs = [
  {
    title: 'Charts',
    key: 'charts',
    component: Charts,
  },
  // {
  //   title: 'Stats',
  //   key: 'stats',
  //   component: Stats,
  // },
  // {
  //   title: 'Scatterplot',
  //   key: 'scatterplot',
  //   component: Scatterplot,
  // },
  tabConfig.exceptions,
  tabConfig.logs,
  tabConfig.ratios,
  tabConfig.workers,
  tabConfig.reports,
];

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
      <Layout>{swarmState === SWARM_STATE.READY ? <SwarmForm /> : <Tabs tabs={tabs} />}</Layout>
    </ThemeProvider>
  );
}
