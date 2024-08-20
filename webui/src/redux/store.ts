import { configureStore } from '@reduxjs/toolkit';

import rootReducer, { IRootState, Action } from 'redux/slice/root.slice';

export const store = configureStore<IRootState, Action>({
  reducer: rootReducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware(),
});

export type { IRootState, Action } from 'redux/slice/root.slice';
export default configureStore;
