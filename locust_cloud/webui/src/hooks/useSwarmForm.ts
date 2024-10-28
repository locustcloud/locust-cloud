import { useCallback, useState } from 'react';
import { AlertColor } from '@mui/material';

import { useLocustSelector, useSelector } from 'redux/hooks';

interface IAlert {
  level?: AlertColor;
  message: string;
}

export default function useSwarmForm() {
  const { numUsers, workerCount } = useLocustSelector(({ swarm }) => swarm);
  const { maxUsers, usersPerWorker } = useSelector(({ customer }) => customer);

  const [alert, setAlert] = useState<IAlert>();
  const [shouldDisableForm, setShouldDisableForm] = useState(false);

  const handleFormChange = useCallback(
    ({ target }: React.ChangeEvent<HTMLFormElement>) => {
      if (target && target.name === 'userCount') {
        const userCount = target.value;

        if (maxUsers && userCount > maxUsers) {
          setAlert({
            level: 'error',
            message: 'The number of users has exceeded the allowance for this account.',
          });
          setShouldDisableForm(true);
        } else if (userCount > workerCount * Number(usersPerWorker)) {
          setAlert({
            level: 'warning',
            message: `Locust worker count is determined by the User count you specified at start up (${numUsers}), and launching more users risks overloading workers, impacting your results. Re-run locust-cloud with your desired user count to avoid this.`,
          });
          setShouldDisableForm(false);
        } else {
          setShouldDisableForm(false);
          setAlert(undefined);
        }
      }
    },
    [numUsers, workerCount],
  );

  return {
    alert,
    shouldDisableForm,
    handleFormChange,
  };
}
