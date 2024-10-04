import { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';

import { useLocustSelector } from 'redux/hooks';
import { fetchQuery } from 'utils/api';

interface IVuhResponse {
  totalVuh: string;
}

const pluralize = (n: number) => (n === 1 ? '' : 's');

function formatTotalVuh(totalVuhResponse: IVuhResponse[]) {
  if (!totalVuhResponse || !totalVuhResponse.length || !totalVuhResponse[0].totalVuh) {
    return 'Unknown';
  }

  const [{ totalVuh }] = totalVuhResponse;

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

  useEffect(() => {
    fetchQuery<IVuhResponse[]>('/cloud-stats/total-runtime', {}, totalVuhResponse =>
      setTotalVuh(formatTotalVuh(totalVuhResponse)),
    );
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
        <Typography sx={{ fontWeight: 'bold' }}>Customer Total Virtual User Time</Typography>
        {totalVuh && totalVuh}
      </Box>
    </Paper>
  );
}
