import { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { roundToDecimalPlaces } from 'locust-ui';

import { fetchQuery } from 'utils/api';

interface IRuntimeResponse {
  totalRuntime: string;
  totalUsers: string;
}

function calculateTotalVuh([hours, minutes, seconds]: number[], totalUsers: string) {
  const roundedSeconds = roundToDecimalPlaces(seconds);
  const roundedMinutes = roundToDecimalPlaces(Number(`${minutes}.${roundedSeconds}`));
  const roundedHours = roundToDecimalPlaces(Number(`${hours}.${roundedMinutes}`));

  return roundedHours * Number(totalUsers);
}

const pluralize = (n: number) => (n === 1 ? '' : 's');

function formatRuntime([hours, minutes, seconds]: number[]) {
  return `${hours} hour${pluralize(hours)}, ${minutes} minute${pluralize(minutes)}, ${roundToDecimalPlaces(seconds)} second${pluralize(seconds)}`;
}

export default function Customer() {
  const [totalRuntime, setTotalruntime] = useState<string>();
  const [totalVuh, setTotalVuh] = useState<number>();

  useEffect(() => {
    fetchQuery<IRuntimeResponse[]>('/cloud-stats/total-runtime', {}, runtimeResponse => {
      if (!runtimeResponse || !runtimeResponse.length) {
        setTotalruntime('Unknown');
      }

      const [{ totalRuntime, totalUsers }] = runtimeResponse;

      const runtime = totalRuntime.split(':').map(Number);

      setTotalruntime(formatRuntime(runtime));
      setTotalVuh(calculateTotalVuh(runtime, totalUsers));
    });
  }, []);

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
        <Typography sx={{ fontWeight: 'bold' }}>Total Runtime</Typography>
        {totalRuntime && totalRuntime}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          rowGap: 1,
        }}
      >
        <Typography sx={{ fontWeight: 'bold' }}>Total Virtual User Hours</Typography>
        {totalVuh && totalVuh}
      </Box>
    </Paper>
  );
}
