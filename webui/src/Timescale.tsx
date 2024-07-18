import { LineChart, Table, useInterval } from "locust-ui";
import { useEffect, useState } from "react";
// import { useEffect, useState } from "react";

// const requestsTable = (start, end) => `
// SELECT Req1.name, Req1.request_type as "request type",
//  count(Req1.*) as "requests",
//  count(Req1.exception) as "failed",
//  (count(Req1.exception)*100.0/(select count(*) from request Req2 where Req2.request_type = Req1.request_type and Req2.name = Req1.name and Req2.time BETWEEN '${start}' AND '${end}' AND (Req2.testplan = 'locust.py' or 'locust.py' = 'All'))) as "error percentage",
//  AVG(Req1.response_time) as "Average",
//  percentile_cont(0.95) within group (order by Req1.response_time) as "95 perc",
//  percentile_cont(0.99) within group (order by Req1.response_time) as "99 perc",
//  max(Req1.response_time)
// FROM request Req1
// WHERE time BETWEEN '${start}' AND '${end}' AND
//  (Req1.testplan = 'locust.py' OR 'locust.py' = 'All')
// GROUP BY Req1.request_type, Req1.name
//     `;

// const failuresTable = `
//   SELECT name as "request name",
//         left(exception,300) as exception,
//         count(*)
//   FROM "request"
//   WHERE $__timeFilter(time) and
//         (testplan = '$testplan' OR '$testplan' = 'All') AND
//         exception is not null
//   GROUP BY "name",left(exception,300)
// `;

// const requestsPerActiveUser = `
// SELECT $__timeGroup("time",$__interval,NULL),
//       count(*)/($__interval_ms/1000.0) as "Req/s"
// FROM request
// WHERE $__timeFilter(time) and
//       (testplan = '$testplan' OR '$testplan' = 'All')
// GROUP BY 1
// ORDER BY 1
// `;

// const totalRequests = `
// SELECT
//   $__timeGroupAlias("time",$__interval),
//   count(*) AS "AllRequests"
// FROM request
// WHERE
//   $__timeFilter("time") AND
//   (testplan = '$testplan' OR '$testplan' = 'All')
// GROUP BY 1
// `;

// const totalFailures = `
// SELECT
//   $__timeGroupAlias("time",$__interval),
//   count(*)
// FROM request
// WHERE
//   $__timeFilter("time") AND
//   (testplan = '$testplan' OR '$testplan' = 'All') AND
//   exception is not null
// GROUP BY 1
// `;

// const errorRatePercent = `
// SELECT
// CASE cast(allRec as numeric)
//    WHEN 0 THEN 0
//    ELSE cast(errorRec as numeric) / cast(allRec as numeric)
// END
// FROM (SELECT count(*) as allRec FROM request WHERE $__timeFilter(time) and (testplan = '$testplan' OR '$testplan' = 'All')) AS "allRecords",
//      (SELECT count(*) as errorRec FROM request WHERE $__timeFilter(time) and (testplan = '$testplan' OR '$testplan' = 'All') AND exception is not null) AS "errorRecords"
// `;

// const errorsPerSecond = `
// SELECT $__timeGroup("time",$__interval,NULL),
//       count(*)/($__interval_ms/1000.0) as "Error rate"
// FROM request
// WHERE $__timeFilter(time) and
//       (testplan = '$testplan' OR '$testplan' = 'All') and
//       exception is not null
// GROUP BY 1
// ORDER BY 1
// `;

// // 2024-07-16T19:02:00.203Z
// const requestsPerSecond = (start, end) => `
// SELECT time_bucket('5.000s',"time") AS "time",
//  count(*)/(1000/1000.0) as "reqPerS"
// FROM request_summary
// WHERE time BETWEEN '${start}' AND '${end}' and
//  (testplan = 'locust.py' OR 'locust.py' = 'All')
// GROUP BY 1
// ORDER BY 1
// `;

// const throughputPerRequest = `
// SELECT time_bucket('5.000s',time) AS "time",
//  name,
//  count(*)/(5000/1000.0) as throughput
// FROM request
// WHERE time BETWEEN '2024-07-16T19:02:00.203Z' AND '2024-07-16T19:07:00.205Z' and
//  (testplan = 'locust.py' OR 'locust.py' = 'All')
// GROUP BY 1, name
// ORDER BY 1,2
// `;

// const avgTransactionResponseTimes = `
// SELECT $__timeGroup("time",$__interval, NULL),
//       name ,
//       avg(response_time)
// FROM request
// WHERE $__timeFilter(time) and
//       (testplan = '$testplan' OR '$testplan' = 'All')
// GROUP BY 1, name
// ORDER BY 1, 2
// `;

// const errorsPerSecondPerRequest = `
// SELECT $__timeGroup("time",$__interval, NULL),
//       name,
//       count(*)/($__interval_ms/1000.0) as "Error rate"
// FROM request
// WHERE $__timeFilter(time) and
//       (testplan = '$testplan' OR '$testplan' = 'All') and
//       exception is not null
// GROUP BY 1, name
// ORDER BY 1
// `;

// const logTransactionResponseTimes = `
// SELECT $__timeGroup("time",$__interval, NULL),
//       name ,
//       avg(response_time)
// FROM request
// WHERE $__timeFilter(time) and
//       (testplan = '$testplan' OR '$testplan' = 'All')
// GROUP BY 1, name
// ORDER BY 1, 2
// `;

// const perc99TransactionResponseTimes = `
// SELECT $__timeGroup("time",$__interval,NULL),
//       name,
//       percentile_cont(0.99) within group (order by response_time) as "99 percentile"
// FROM request
// WHERE $__timeFilter(time) and
//       (testplan = '$testplan' OR '$testplan' = 'All')
// GROUP BY  1, name
// ORDER BY 1, 2
// `;

// const transactionResponseLength = `
// SELECT $__timeGroup("time",$__interval, NULL),
//       avg(response_length),
//       name
// FROM request
// WHERE $__timeFilter(time) and
//       (testplan = '$testplan' OR '$testplan' = 'All')
// GROUP BY 1, name
// ORDER BY 1
// `;

// const startTime = new Date(new Date().getTime() - 5 * 60 * 1000).toISOString();
// export default function Timescale() {
//   const [timestamp, setTimestamp] = useState(new Date().toISOString());
//   const [statsData, setStatsData] = useState([]);
//   const [requestChart, setRequestChart] = useState({});
//   const [throughputChartLines, setThroughputChartLines] = useState([]);
//   const [throughputChart, setThroughputChart] = useState([]);

//   const getRequests = (start, end) => {
//     const data = fetch("http://localhost:3002", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         query: requestsTable(start, end),
//       }),
//     })
//       .then((res) => res.json())
//       .then(setStatsData)
//       .catch(console.log);
//   };

//   const getRequestPerSecond = (start, end) => {
//     const data = fetch("http://localhost:3002", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         query: `
//                   SELECT time_bucket('1.000s',"bucket") AS "time",
//          sum("count")/(1000/1000.0) as "reqPerS"
//         FROM request_summary
//         WHERE bucket BETWEEN '${start}' AND '${end}'
//         GROUP BY 1
//         ORDER BY 1
//                 `,
//       }),
//     })
//       .then((res) => res.json())
//       // .then(console.log)
//       .then((res) =>
//         setRequestChart(
//           res.reduce(
//             (final, { reqPerS, time }) => ({
//               ...final,
//               time: [...(final.time || []), time],
//               reqPerS: [...(final.reqPerS || []), reqPerS],
//             }),
//             {}
//           )
//         )
//       )
//       .catch(console.log);
//   };

//   const getThroughput = () => {
//     const data = fetch("http://localhost:3002", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         query: throughputPerRequest,
//       }),
//     })
//       .then((res) => res.json())
//       .then((res) => {
//         const lines = [];
//         const chart = res.reduce((final, { time, name, throughput }) => {
//           if (!lines.includes(name)) {
//             lines.push(name);
//           }
//           return {
//             ...final,
//             time: [...(final.time || []), time],
//             [name]: [...(final[name] || []), throughput],
//           };
//         }, {});
//         console.log({
//           chart,
//         });
//         setThroughputChartLines(
//           lines.map((line) => ({
//             name: `${line} throughtput`,
//             key: line,
//           }))
//         );
//         setThroughputChart(chart);
//       })
//       .catch(console.log);
//   };

// useEffect(() => {
//   getRequests(startTime, timestamp);
// }, []);

//   useInterval(() => {
//     console.log({
//       startTime,
//       timestamp,
//       currentTime: new Date().toISOString(),
//     });
//     getRequestPerSecond(startTime, timestamp);
//     setTimestamp(new Date().toISOString());
//   }, 1005);

//   return (
//     <div>
// <Table
//   structure={[
//     { key: "name", title: "Name" },
//     { key: "method", title: "Type" },
//     { key: "requests", title: "Requests" },
//     { key: "failed", title: "Failed" },
//     { key: "max", title: "Max", round: 2 },
//     { key: "errorPercentage", title: "Error Percentage (%)" },
//   ]}
//   rows={statsData}
// />
//       <LineChart
//         colors={[
//           "#9966CC",
//           "#8A2BE2",
//           "#8E4585",
//           "#E0B0FF",
//           "#C8A2C8",
//           "#E6E6FA",
//         ]}
//         lines={[{ name: "Req/s", key: "reqPerS" }]}
//         title=""
//         charts={requestChart}
//       />
//       {/* <LineChart
//         colors={[
//           "#9966CC",
//           "#8A2BE2",
//           "#8E4585",
//           "#E0B0FF",
//           "#C8A2C8",
//           "#E6E6FA",
//         ]}
//         lines={throughputChartLines}
//         title=""
//         charts={throughputChart}
//       /> */}
//     </div>
//   );
// }

const startTime = new Date(new Date().getTime() - 5 * 60 * 1000).toISOString();

export default function Timescale() {
  const [timestamp, setTimestamp] = useState(new Date().toISOString());
  const [statsData, setStatsData] = useState([]);
  const [requestChart, setRequestChart] = useState({});
  const [throughputChartLines, setThroughputChartLines] = useState([]);
  const [throughputChart, setThroughputChart] = useState([]);

  const getRequests = (start: string, end: string) => {
    const data = fetch("/cloud-stats/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start,
        end,
      }),
    })
      .then((res) => res.json())
      .then(setStatsData)
      .catch(console.log);
  };

  useEffect(() => {
    getRequests(startTime, timestamp);
  }, []);

  return (
    <div>
      <Table
        structure={[
          { key: "name", title: "Name" },
          { key: "method", title: "Type" },
          { key: "requests", title: "Requests" },
          { key: "failed", title: "Failed" },
          { key: "max", title: "Max", round: 2 },
          { key: "errorPercentage", title: "Error Percentage (%)" },
        ]}
        rows={statsData}
      />
    </div>
  );
}
