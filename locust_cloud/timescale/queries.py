requests_query = """
SELECT
	name,
  request_type as "method",
	SUM(average * count) / SUM(count) as "average",
	SUM(count) as "requests",
	SUM("failedCount") as "failed",
	MIN(min),
	MAX(max),
	SUM("failedCount") / SUM(count) * 100 "errorPercentage"
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY name, method
"""


failures_query = """
SELECT name as "name",
 left(exception,300) as exception,
 count(*)
FROM "request"
WHERE time BETWEEN %(start)s AND %(end)s AND
 exception is not null
GROUP BY "name",left(exception,300)
"""


requests_per_second = """
WITH user_count_agg AS (
  SELECT
    time_bucket('5.000s', time) AS time,
    avg(user_count) as users
  FROM user_count
  WHERE time BETWEEN %(start)s AND %(end)s
  GROUP BY 1
  ORDER BY 1
),
request_count_agg AS (
  SELECT
    time_bucket('5.000s', time) AS time,
    count(*)/(5000/1000.0) as "rps"
  FROM request
  WHERE time BETWEEN %(start)s AND %(end)s
  GROUP BY 1
  ORDER BY 1
)
SELECT
  u.time,
  u.users,
  r.rps
FROM user_count_agg u
JOIN request_count_agg r ON u.time = r.time
ORDER BY u.time;
"""


total_requests = """
SELECT
 SUM(count)
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
"""


total_failed = """
SELECT
 SUM("failedCount")
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
"""


error_percentage = """
SELECT
	SUM("failedCount") / SUM(count) * 100 "errorPercentage"
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
 """


errors_per_second = """
SELECT
    bucket as time,
    SUM("failedCount") as "errorRate"
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY 1
ORDER BY 1
"""


rps_per_request = """
SELECT
    bucket as time,
    name,
    SUM(count) as throughput
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
ORDER BY 1,2
"""


avg_response_times = """
SELECT
    bucket as time,
    name,
    avg(average) as "responseTime"
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
ORDER BY 1, 2
"""


errors_per_request = """
SELECT
    bucket as time,
    name,
    SUM("failedCount") as "errorRate"
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
ORDER BY 1
"""


perc99_response_times = """
SELECT time_bucket('5.000s', time) AS time,
  name,
  percentile_cont(0.99) within group (order by response_time) as "perc99"
FROM request
WHERE time BETWEEN %(start)s AND %(end)s
GROUP BY 1, name
"""


response_length = """
SELECT
    bucket as time,
    "responseLength",
    name
FROM request_summary
WHERE bucket BETWEEN %(start)s AND %(end)s
AND "responseLength" > 0
"""


request_names = """
SELECT DISTINCT name
FROM request
WHERE time BETWEEN %(start)s AND %(end)s
"""


queries = {
    "request-names": request_names,
    "requests": requests_query,
    "failures": failures_query,
    "rps": requests_per_second,
    "total-requests": total_requests,
    "total-failures": total_failed,
    "error-percentage": error_percentage,
    "errors-per-second": errors_per_second,
    "rps-per-request": rps_per_request,
    "avg-response-times": avg_response_times,
    "errors-per-request": errors_per_request,
    "perc99-response-times": perc99_response_times,
    "response-length": response_length,
}
