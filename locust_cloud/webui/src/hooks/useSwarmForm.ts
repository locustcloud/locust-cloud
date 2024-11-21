import { useCallback, useEffect, useState } from 'react';
import { AlertColor } from '@mui/material';

import { useLocustSelector, useSelector } from 'redux/hooks';

interface IAlert {
  level?: AlertColor;
  message: string;
}

const getTotalVuhHours = (totalVuh: string) =>
  totalVuh.includes('hours') ? parseInt(totalVuh.split(',')[0]) : 0;

export default function useSwarmForm() {
  const { numUsers, workerCount } = useLocustSelector(({ swarm }) => swarm);
  const { maxUsers, usersPerWorker, maxVuh, totalVuh } = useSelector(({ customer }) => customer);

  const [alert, setAlert] = useState<IAlert>();
  const [shouldDisableForm, setShouldDisableForm] = useState(false);

  const handleFormChange = useCallback(
    ({ target }: React.ChangeEvent<HTMLFormElement>) => {
      if (target && target.name === 'userCount') {
        const userCount = Number(target.value);

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
    [numUsers, workerCount, maxUsers, usersPerWorker],
  );

  useEffect(() => {
    if (maxVuh && totalVuh) {
      const totalVuhHours = getTotalVuhHours(totalVuh);
      if (totalVuhHours >= maxVuh) {
        setAlert({
          level: 'error',
          message: `The maximum virtual user hours for this account (${maxVuh}) has been exceeded. Please reach out to us at support@locust.cloud if you would like to extend your hours for this month.`,
        });
        setShouldDisableForm(true);
      }

      if (totalVuhHours >= maxVuh - 4) {
        setAlert({
          level: 'warning',
          message: `The maximum virtual user hours (${maxVuh}) for this account will be reached in 4 hours or less.`,
        });
      }
    }
  }, [maxVuh, totalVuh]);

  return {
    alert,
    shouldDisableForm,
    handleFormChange,
  };
}
