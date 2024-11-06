import { useEffect } from 'react';

import { useGetCustomerDataMutation } from 'redux/api/cloud-stats';
import { useAction } from 'redux/hooks';
import { customerActions } from 'redux/slice/customer.slice';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { ICustomer } from 'types/customer.types';

export default function useFetchCustomer() {
  const [getCustomerData] = useGetCustomerDataMutation();
  const setSnackbar = useAction(snackbarActions.setSnackbar);
  const setCustomer = useAction(customerActions.setCustomer);

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
}
