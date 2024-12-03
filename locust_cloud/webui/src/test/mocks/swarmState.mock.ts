import { IRootState } from 'locust-ui';

import { ITemplateArgs } from 'types/window.types';

export const percentilesToChart = [0.5, 0.95];
export const percentilesToStatistics = [0.5, 0.95, 0.99];

export const swarmStateMock: IRootState['swarm'] & ITemplateArgs = {
  availableShapeClasses: ['Default'],
  availableUserClasses: ['ExampleClass'],
  availableUserTasks: { ExampleClass: ['ExampleTask'] },
  extraOptions: {},
  history: [],
  host: 'https://localhost',
  isDistributed: false,
  locustfile: 'main.py',
  numUsers: null,
  overrideHostWarning: false,
  percentilesToStatistics: percentilesToStatistics,
  showUserclassPicker: false,
  spawnRate: null,
  state: 'ready',
  percentilesToChart: percentilesToChart,
  statsHistoryEnabled: false,
  tasks: '{}',
  userCount: 0,
  version: '2.15.0',
  workerCount: 0,
  users: {},
  isGraphViewer: false,
  locustVersion: '',
  locustCloudVersion: '',
  webBasePath: '',
  username: '',
};
