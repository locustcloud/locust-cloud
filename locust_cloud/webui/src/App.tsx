import CloseIcon from '@mui/icons-material/Close';
import { Container, CssBaseline, IconButton, ThemeProvider } from '@mui/material';
import {
  SWARM_STATE,
  tabConfig,
  Tabs,
  useCreateTheme,
  useFetchExceptions,
  useFetchStats,
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
import useFetchCustomer from 'hooks/useFetchCustomer';
import useFetchTestruns from 'hooks/useFetchTestruns';
import useSwarmForm from 'hooks/useSwarmForm';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { UI_VIEW_TYPES, uiActions } from 'redux/slice/ui.slice';

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
  useLogViewer();
  useFetchTestruns();
  useFetchCustomer();

  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { viewType, hasDismissedSwarmForm } = useSelector(({ ui }) => ui);
  const setUi = useAction(uiActions.setUi);

  const theme = useCreateTheme();
  const { alert, shouldDisableForm, handleFormChange } = useSwarmForm();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout>
        {!window.templateArgs.isGraphViewer &&
        !hasDismissedSwarmForm &&
        swarmState === SWARM_STATE.READY ? (
          <Container maxWidth='md' sx={{ position: 'relative' }}>
            <IconButton
              aria-label='dismiss form'
              onClick={() => setUi({ hasDismissedSwarmForm: true })}
              size='small'
              sx={{
                color: theme => theme.palette.grey[500],
                position: 'absolute',
                right: 44,
                top: 0,
              }}
            >
              <CloseIcon />
            </IconButton>
            <SwarmForm
              alert={alert}
              isDisabled={shouldDisableForm}
              onFormChange={handleFormChange}
            />
          </Container>
        ) : (
          <Tabs tabs={viewType == UI_VIEW_TYPES.CLOUD ? tabs : locustBaseTabs} />
        )}
      </Layout>
      <Snackbar />
    </ThemeProvider>
  );
}
