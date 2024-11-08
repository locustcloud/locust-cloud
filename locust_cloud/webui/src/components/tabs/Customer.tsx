import { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';

import { useGetTotalVuhMutation } from 'redux/api/cloud-stats';
import { useAction, useLocustSelector, useSelector } from 'redux/hooks';
import { snackbarActions } from 'redux/slice/snackbar.slice';
import { IVuhResponse } from 'types/request.types';

const pluralize = (n: number) => (n === 1 ? '' : 's');

function formatTotalVuh(totalVuhResponse: IVuhResponse[]) {
  if (!totalVuhResponse || !totalVuhResponse.length || !totalVuhResponse[0].totalVuh) {
    return 'Unknown';
  }

  const [{ totalVuh }] = totalVuhResponse;

  if (totalVuh === '0') {
    return totalVuh;
  }

  const [days, hourMinuteSeconds] = totalVuh.includes('days')
    ? totalVuh.split(', ')
    : ['0 days', totalVuh];

  const daysInHours = parseInt(days) * 24;

  const [hours, minutes] = hourMinuteSeconds.split(':').map(Number);

  const totalHours = hours + daysInHours;

  return [
    totalHours && `${totalHours} hour${pluralize(totalHours)}`,
    minutes && `${minutes} minute${pluralize(minutes)}`,
  ]
    .filter(Boolean)
    .join(', ');
}

export default function Customer() {
  const [totalVuh, setTotalVuh] = useState<string>();

  const swarmState = useLocustSelector(({ swarm }) => swarm.state);
  const { maxVuh } = useSelector(({ customer }) => customer);
  const setSnackbar = useAction(snackbarActions.setSnackbar);

  const [getTotalVuh] = useGetTotalVuhMutation();

  const fetchTotalVuh = async () => {
    const { data: totalVuh, error: totalVuhError } = await getTotalVuh();

    const fetchError = totalVuhError;

    if (fetchError && 'error' in fetchError) {
      setSnackbar({ message: fetchError.error });
    } else {
      setTotalVuh(formatTotalVuh(totalVuh as IVuhResponse[]));
    }
  };

  useEffect(() => {
    fetchTotalVuh();
  }, [swarmState]);

  return (
    <Paper
      elevation={3}
      sx={{
        py: 4,
        px: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        rowGap: 4,
      }}
    >
      {window.templateArgs.username && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column',
            rowGap: 1,
          }}
        >
          <Typography sx={{ fontWeight: 'bold' }}>Current User</Typography>
          <Typography>{window.templateArgs.username}</Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          rowGap: 1,
        }}
      >
        <Typography sx={{ fontWeight: 'bold' }}>Current Month Virtual User Time</Typography>
        <Typography>Included in Plan: {maxVuh}</Typography>
        <Typography>Used: {totalVuh}</Typography>
      </Box>
    </Paper>
  );
}
