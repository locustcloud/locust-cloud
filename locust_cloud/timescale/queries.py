def requests_query(start, end):
    return f"""
SELECT Req1.name, Req1.request_type as "request type",
 count(Req1.*) as "requests",
 count(Req1.exception) as "failed",
 (count(Req1.exception)*100.0/(select count(*) from request Req2 where Req2.request_type = Req1.request_type and Req2.name = Req1.name and Req2.time BETWEEN '${start}' AND '${end}')) as "error percentage",
 AVG(Req1.response_time) as "Average",
 percentile_cont(0.95) within group (order by Req1.response_time) as "95 perc",
 percentile_cont(0.99) within group (order by Req1.response_time) as "99 perc",
 max(Req1.response_time)
FROM request Req1
WHERE time BETWEEN '{start}' AND '{end}'
GROUP BY Req1.request_type, Req1.name
    """
