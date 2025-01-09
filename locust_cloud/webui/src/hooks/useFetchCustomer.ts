import { useEffect } from 'react';

import { useGetCustomerDataMutation } from 'redux/api/cloud-stats';
import { useGetTotalVuhMutation } from 'redux/api/cloud-stats';
import { useAction, useLocustSelector } from 'redux/hooks';
import { customerActions } from 'redux/slice/customer.slice';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { ICustomer } from 'types/customer.types';
import { IVuhResponse } from 'types/request.types';

const pluralize = (n: number) => (n === 1 ? '' : 's');

function formatTotalVuh(totalVuhResponse: IVuhResponse[]) {
  if (!totalVuhResponse || !totalVuhResponse.length || !totalVuhResponse[0].totalVuh) {
    return '0 minutes';
  }

  const [{ totalVuh: seconds }] = totalVuhResponse;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return [
    hours && `${hours} hour${pluralize(hours)}`,
    minutes && `${minutes} minute${pluralize(minutes)}`,
  ]
    .filter(Boolean)
    .join(', ');
}

export default function useFetchCustomer() {
  const setSnackbar = useAction(snackbarActions.setSnackbar);
  const setCustomer = useAction(customerActions.setCustomer);
  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const [getCustomerData] = useGetCustomerDataMutation();
  const [getTotalVuh] = useGetTotalVuhMutation();

  const fetchCustomer = async () => {
    const { data: customerData, error: customerDataError } = await getCustomerData();

    if (customerDataError && 'error' in customerDataError) {
      setSnackbar({ message: customerDataError.error });
    } else {
      setCustomer(customerData as ICustomer);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, []);

  const fetchTotalVuh = async () => {
    const { data: totalVuh, error: totalVuhError } = await getTotalVuh();

    const fetchError = totalVuhError;

    if (fetchError && 'error' in fetchError) {
      setSnackbar({ message: fetchError.error });
    } else {
      setCustomer({ totalVuh: formatTotalVuh(totalVuh as IVuhResponse[]) });
    }
  };

  useEffect(() => {
    fetchTotalVuh();
  }, [swarmState]);
}
