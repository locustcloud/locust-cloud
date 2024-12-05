from typing import LiteralString

requests_query = """
SELECT
	name,
  request_type as method,
	SUM(count) as requests,
	SUM(failed_count) as failed,
	MAX(max),
	SUM(failed_count) / SUM(count) * 100 as "errorPercentage"
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY name, method
"""


failures_query = """
SELECT
  name as name,
  exception,
  count(*)
FROM requests_view
WHERE time BETWEEN %(start)s AND %(end)s AND
 success = 0
AND run_id = %(testrun)s
GROUP BY "name",exception
"""


requests_per_second = """
WITH request_count_agg AS (
  SELECT
    time_bucket_gapfill(%(resolution)s * interval '1 second', bucket) AS time,
    COALESCE(SUM(count)/%(resolution)s, 0) as rps
  FROM requests_summary_view
  WHERE bucket BETWEEN %(start)s AND %(end)s
  AND run_id = %(testrun)s
  GROUP BY 1
  ORDER BY 1
),
user_count_agg AS (
  SELECT
    time_bucket_gapfill(%(resolution)s * interval '1 second', time) AS time,
    COALESCE(avg(user_count), 0) as users
  FROM number_of_users
  WHERE time BETWEEN %(start)s AND %(end)s
  AND run_id = %(testrun)s
  GROUP BY 1
  ORDER BY 1
),
errors_per_s_agg AS (
  SELECT
    time_bucket_gapfill(%(resolution)s * interval '1 second', bucket) AS time,
    COALESCE(SUM(failed_count)/%(resolution)s, 0) as error_rate
  FROM requests_summary_view
  WHERE bucket BETWEEN %(start)s AND %(end)s
  AND run_id = %(testrun)s
  GROUP BY 1
  ORDER BY 1
)
SELECT
  r.time,
  u.users,
  r.rps,
  e.error_rate as "errorRate"
FROM request_count_agg r
LEFT JOIN user_count_agg u ON r.time = u.time
LEFT JOIN errors_per_s_agg e on r.time = e.time
ORDER BY r.time;
"""


total_requests = """
SELECT
 SUM(count) as "totalRequests"
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
"""


total_failed = """
SELECT
 SUM(failed_count) as "totalFailures"
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
"""


error_percentage = """
SELECT
	SUM(failed_count) / SUM(count) * 100 "errorPercentage"
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
"""

rps_per_request = """
SELECT
    time_bucket_gapfill(%(resolution)s * interval '1 second', bucket) AS time,
    name,
    COALESCE(SUM(count)/%(resolution)s, 0) as throughput
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1,2
"""


avg_response_times = """
SELECT
    time_bucket_gapfill(%(resolution)s * interval '1 second', bucket) as time,
    name,
    avg(average) as "responseTime"
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1, 2
"""

errors_per_request = """
SELECT
    time_bucket_gapfill(%(resolution)s * interval '1 second', bucket) AS time,
    name,
    SUM(failed_count)/%(resolution)s as "errorRate"
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1
"""


perc99_response_times = """
SELECT time_bucket_gapfill(%(resolution)s * interval '1 second', bucket) AS time,
  name,
  MAX(perc99) as perc99
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1
"""


response_length = """
SELECT
    time_bucket_gapfill(%(resolution)s * interval '1 second', bucket) as time,
    AVG(response_length) as "responseLength",
    name
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
GROUP BY 1, name
ORDER BY 1
"""


request_names = """
SELECT DISTINCT name
FROM requests_summary_view
WHERE bucket BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
"""

scatterplot = """
SELECT
 time,
 name,
 response_time as "responseTime"
FROM requests_view
WHERE time BETWEEN %(start)s AND %(end)s
AND run_id = %(testrun)s
ORDER BY 1,2
"""

testruns = """
SELECT
  id as "runId",
  end_time as "endTime",
  locustfile,
  profile
FROM testruns
ORDER BY id DESC
"""

testruns_table = """
SELECT
 id as "runId",
 profile,
 num_users as "numUsers",
 round(rps_avg, 1) as "rpsAvg",
 round(resp_time_avg, 1) as "respTime",
 fail_ratio as "failRatio",
 requests,
 date_trunc('second', end_time - id) AS "runTime",
 exit_code as "exitCode",
 username,
 worker_count as "workerCount",
 locustfile
FROM testruns
WHERE %(profile)s::text IS NULL or profile = %(profile)s
OR locustfile = %(profile)s
ORDER BY id DESC
"""

testruns_rps = """
WITH avg_rps AS (
  SELECT
    id AS time,
    rps_avg AS avg_rps
  FROM testruns
  WHERE %(profile)s::text IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
),
avg_rps_failed AS (
  SELECT
    id AS time,
    CASE
        WHEN exit_code > 0 THEN rps_avg
        ELSE 0
    END AS avg_rps_failed
  FROM testruns
  WHERE %(profile)s::text IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
)
SELECT
  a.time,
  a.avg_rps as "avgRps",
  f.avg_rps_failed as "avgRpsFailed"
FROM avg_rps a
JOIN avg_rps_failed f ON a.time = f.time
ORDER BY a.time
"""

testruns_response_time = """
WITH avg_response_time AS (
  SELECT
    id AS time,
    resp_time_avg AS avg_response_time
  FROM testruns
  WHERE %(profile)s::text IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
),
avg_response_time_failed AS (
  SELECT
    id AS time,
    CASE
        WHEN exit_code > 0 THEN resp_time_avg
        ELSE 0
    END AS avg_response_time_failed
  FROM testruns
  WHERE %(profile)s::text IS NULL or profile = %(profile)s
  OR locustfile = %(profile)s
  ORDER BY id
)
SELECT
  a.time,
  a.avg_response_time as "avgResponseTime",
  f.avg_response_time_failed as "avgResponseTimeFailed"
FROM avg_response_time a
JOIN avg_response_time_failed f ON a.time = f.time
ORDER BY a.time
"""

total_vuh = """
SELECT
  COALESCE(SUM((end_time - id) * num_users), '0') AS "totalVuh"
FROM testruns
WHERE id >= date_trunc('month', NOW()) AND NOT refund
"""

customer = """
SELECT
  max_vuh as "maxVuh",
  max_workers as "maxWorkers",
  max_users as "maxUsers",
  users_per_worker as "usersPerWorker"
FROM customers
WHERE id = current_user
"""

profiles = """
SELECT DISTINCT
CASE
    WHEN profile IS NOT NULL AND profile != '' THEN profile
    ELSE locustfile
END AS profile
FROM testruns
WHERE locustfile IS NOT NULL
"""

queries: dict["str", LiteralString] = {
    "request-names": request_names,
    "requests": requests_query,
    "failures": failures_query,
    "rps": requests_per_second,
    "total-requests": total_requests,
    "total-failures": total_failed,
    "error-percentage": error_percentage,
    "rps-per-request": rps_per_request,
    "avg-response-times": avg_response_times,
    "errors-per-request": errors_per_request,
    "perc99-response-times": perc99_response_times,
    "response-length": response_length,
    "scatterplot": scatterplot,
    "testruns": testruns,
    "testruns-table": testruns_table,
    "testruns-rps": testruns_rps,
    "testruns-response-time": testruns_response_time,
    "total-vuh": total_vuh,
    "customer": customer,
    "profiles": profiles,
}
