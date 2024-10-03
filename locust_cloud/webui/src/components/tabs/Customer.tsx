import { useEffect, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { roundToDecimalPlaces } from 'locust-ui';

import { fetchQuery } from 'utils/api';

interface IRuntimeResponse {
  totalRuntime: string;
}

const pluralize = (n: number) => (n === 1 ? '' : 's');

function formatRuntime(runtimeResponse: IRuntimeResponse[]) {
  if (!runtimeResponse || !runtimeResponse.length) {
    return 'Unknown';
  }

  const [{ totalRuntime }] = runtimeResponse;

  const [hours, minutes, seconds] = totalRuntime.split(':').map(Number);

  return `${hours} hour${pluralize(hours)}, ${minutes} minute${pluralize(minutes)}, ${roundToDecimalPlaces(seconds)} second${pluralize(seconds)}`;
}

export default function Customer() {
  const [totalRuntime, setTotalruntime] = useState<string>();

  useEffect(() => {
    fetchQuery<IRuntimeResponse[]>('/cloud-stats/total-runtime', {}, runtimeResponse =>
      setTotalruntime(formatRuntime(runtimeResponse)),
    );
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
        <Typography sx={{ fontWeight: 'bold' }}>Runtime</Typography>
        {totalRuntime && totalRuntime}
      </Box>
    </Paper>
  );
}
