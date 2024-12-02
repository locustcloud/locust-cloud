import { Action, configureStore, UnknownAction } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { locustStore } from 'locust-ui';
import { IRootState, ReduxContext } from 'redux/slice/root.slice';

import { cloudStats } from 'redux/api/cloud-stats';
import rootReducer from 'redux/slice/root.slice';

const createStore = (initialState = {}) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: initialState,
    middleware: getDefaultMiddleware => getDefaultMiddleware().concat(cloudStats.middleware),
  });

export const renderWithProvider = (Component: React.ReactElement, initialState = {}) => {
  const store = createStore(initialState);

  const renderResult = render(
    <Provider<Action | UnknownAction, IRootState> store={store} context={ReduxContext}>
      <Provider store={locustStore}>{Component}</Provider>
    </Provider>,
  );

  return {
    ...renderResult,
    store,
  };
};
