def requests_query(start, end):
    return f"""
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
WHERE bucket BETWEEN '{start}' AND '{end}'
GROUP BY name, method
"""


def failures_query(start, end):
    return f"""
SELECT name as "name",
 left(exception,300) as exception,
 count(*)
FROM "request"
WHERE time BETWEEN '{start}' AND '{end}' and
 (testplan = 'locust.py' OR 'locust.py' = 'All') AND
 exception is not null
GROUP BY "name",left(exception,300)
"""


def requests_per_second(start, end):
    return f"""
WITH user_count_agg AS (
  SELECT
    time_bucket('5.000s',"time") AS "time",
    avg(user_count) as users
  FROM user_count
  WHERE time BETWEEN '{start}' AND '{end}'
  GROUP BY 1
  ORDER BY 1
),
request_count_agg AS (
  SELECT
    bucket as "time",
    SUM(count) as "rps"
  FROM request_summary
  WHERE bucket BETWEEN '{start}' AND '{end}'
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


def total_requests(start, end):
    return f"""
SELECT
 SUM(count)
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
"""


def total_failed(start, end):
    return f"""
SELECT
 SUM("failedCount")
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
"""


def error_percentage(start, end):
    return f"""
SELECT
	SUM("failedCount") / SUM(count) * 100 "errorPercentage"
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
 """


def errors_per_second(start, end):
    return f"""
SELECT
    bucket as "time",
    SUM("failedCount")
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
GROUP BY 1
ORDER BY 1
"""


def rps_per_request(start, end):
    return f"""
SELECT
    bucket as "time",
    name,
    SUM(count)
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
GROUP BY 1, name
ORDER BY 1,2
"""


def avg_response_times(start, end):
    return f"""
SELECT
    bucket as "time",
    name,
    avg(average) as "responseTime"
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
GROUP BY 1, name
ORDER BY 1, 2
"""


def errors_per_request(start, end):
    return f"""
SELECT
    bucket as "time",
    name,
    SUM("failedCount")
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
GROUP BY 1, name
ORDER BY 1
"""


def perc99_response_times(start, end):
    return f"""
SELECT time_bucket('5.000s',"time") AS "time",
 name,
 percentile_cont(0.99) within group (order by response_time) as "perc99"
FROM request
WHERE time BETWEEN '{start}' AND '{end}'
"""


def response_length(start, end):
    return f"""
SELECT
    bucket as "time",
    "responseLength",
    name
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
"""


def request_names(start, end):
    return f"""
SELECT name
FROM request_summary
WHERE bucket BETWEEN '{start}' AND '{end}'
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
