import { Box, Paper, Typography } from "@mui/material";
import Gauge from "components/Gauge/Gauge";
import {
  Table,
  useInterval,
  roundToDecimalPlaces,
  IRootState,
  SWARM_STATE,
} from "locust-ui";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { IRequestBody, fetchQuery } from "utils/api";

interface IStatsData {
  method: string;
  name: string;
  average: number;
  requests: number;
  failed: number;
  min: number;
  max: number;
  errorPercentage: number;
}

interface IFailuresData {
  name: string;
  exception: string;
  count: number;
}

interface ITotalRequestsResponse {
  totalRequests: number;
}

interface ITotalFailuresResponse {
  totalFailures: number;
}

interface IErrorPercentageResponse {
  errorPercentage: number;
}

export default function Stats() {
  const swarmState = useSelector(({ swarm }: IRootState) => swarm.state);
  const startTime = useSelector(({ swarm }: IRootState) => swarm.startTime);

  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [totalRequests, setTotalRequests] = useState<number>(0);
  const [totalFailures, setTotalFailures] = useState<number>(0);
  const [errorPercentage, setErrorPercentage] = useState<number>(0);
  const [statsData, setStatsData] = useState<IStatsData[]>([]);
  const [failuresData, setFailuresData] = useState<IFailuresData[]>([]);

  const getRequests = (body: IRequestBody) =>
    fetchQuery<IStatsData[]>("/cloud-stats/requests", body, setStatsData);
  const getFailures = (body: IRequestBody) =>
    fetchQuery<IFailuresData[]>("/cloud-stats/failures", body, setFailuresData);
  const getTotalRequests = (body: IRequestBody) =>
    fetchQuery<ITotalRequestsResponse[]>(
      "/cloud-stats/total-requests",
      body,
      ([{ totalRequests }]) => setTotalRequests(totalRequests)
    );
  const getTotalFailures = (body: IRequestBody) =>
    fetchQuery<ITotalFailuresResponse[]>(
      "/cloud-stats/total-failures",
      body,
      ([{ totalFailures }]) => setTotalFailures(totalFailures)
    );
  const getErrorPercentage = (body: IRequestBody) =>
    fetchQuery<IErrorPercentageResponse[]>(
      "/cloud-stats/error-percentage",
      body,
      ([{ errorPercentage }]) =>
        setErrorPercentage(roundToDecimalPlaces(errorPercentage, 2))
    );

  const fetchTimescaleGraphs = () => {
    const currentTimestamp = new Date().toISOString();

    getTotalRequests({ start: startTime, end: timestamp });
    getTotalFailures({ start: startTime, end: timestamp });
    getErrorPercentage({ start: startTime, end: timestamp });
    getRequests({ start: startTime, end: timestamp });
    getFailures({ start: startTime, end: timestamp });

    setTimestamp(currentTimestamp);
  };

  useInterval(fetchTimescaleGraphs, 1000, {
    shouldRunInterval:
      swarmState === SWARM_STATE.SPAWNING || swarmState == SWARM_STATE.RUNNING,
  });

  useEffect(() => {
    fetchTimescaleGraphs();
  }, []);

  return (
    <>
      <Paper
        elevation={3}
        sx={{ display: "flex", justifyContent: "space-between", px: 4, mb: 4 }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography noWrap component="p" mb={1} variant="h6">
            Total Requests
          </Typography>
          <Typography component="p" mb={1} variant="h6" color="success.main">
            {totalRequests}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flex: 0.5 }}>
          <Gauge name="Error Rate" gaugeValue={errorPercentage} />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography noWrap component="p" mb={1} variant="h6">
            Total Failures
          </Typography>
          <Typography component="p" mb={1} variant="h6" color="error">
            {totalFailures}
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ display: "flex", flexDirection: "column", rowGap: 4 }}>
        <Box>
          <Typography component="h2" mb={1} variant="h6">
            Request Statistics
          </Typography>
          <Table
            structure={[
              { key: "name", title: "Name" },
              { key: "method", title: "Type" },
              { key: "requests", title: "Requests" },
              { key: "failed", title: "Failed" },
              { key: "max", title: "Max", round: 2 },
              {
                key: "errorPercentage",
                title: "Error Percentage (%)",
                round: 2,
              },
            ]}
            rows={statsData}
          />
        </Box>
        <Box>
          <Typography component="h2" mb={1} variant="h6">
            Failure Statistics
          </Typography>
          <Table
            structure={[
              { key: "name", title: "Name" },
              { key: "exception", title: "Message" },
              { key: "count", title: "Count" },
            ]}
            rows={failuresData}
          />
        </Box>
      </Box>
    </>
  );
}
