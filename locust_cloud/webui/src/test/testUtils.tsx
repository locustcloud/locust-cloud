import { Action, configureStore, UnknownAction } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { createLocustStore } from 'locust-ui';
import { Provider } from 'react-redux';

import { cloudStats } from 'redux/api/cloud-stats';
import { ReduxContext } from 'redux/context';
import { IRootState } from 'redux/slice/root.slice';
import rootReducer from 'redux/slice/root.slice';

const createStore = (initialState = {}) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: initialState,
    middleware: getDefaultMiddleware => getDefaultMiddleware().concat(cloudStats.middleware),
  });

export const renderWithProvider = (
  Component: React.ReactElement,
  initialState = {},
  locustState = {},
) => {
  const store = createStore(initialState);
  const locustStore = createLocustStore(locustState);

  const renderResult = render(
    <Provider<Action | UnknownAction, IRootState> context={ReduxContext} store={store}>
      <Provider store={locustStore}>{Component}</Provider>
    </Provider>,
  );

  return {
    ...renderResult,
    store,
    locustStore,
  };
};

export const rerenderWithProvider = (Component, rerender) => {
  const store = createStore({});
  const locustStore = createLocustStore({});

  const renderResult = rerender(
    <Provider<Action | UnknownAction, IRootState> context={ReduxContext} store={store}>
      <Provider store={locustStore}>{Component}</Provider>
    </Provider>,
  );

  return {
    ...renderResult,
    store,
    locustStore,
  };
};
