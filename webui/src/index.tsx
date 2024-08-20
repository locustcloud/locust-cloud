import { locustStore } from 'locust-ui';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import App from 'App';
import { ReduxContext } from 'redux/slice/root.slice';
import { Action, IRootState, store } from 'redux/store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider<Action, IRootState> context={ReduxContext} store={store}>
    <Provider store={locustStore}>
      <App />
    </Provider>
  </Provider>,
);
