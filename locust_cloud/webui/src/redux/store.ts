import { configureStore } from '@reduxjs/toolkit';

import { cloudStats } from 'redux/api/cloud-stats';
import rootReducer from 'redux/slice/root.slice';

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(cloudStats.middleware),
});

export type { IRootState, Action } from 'redux/slice/root.slice';
export default configureStore;
