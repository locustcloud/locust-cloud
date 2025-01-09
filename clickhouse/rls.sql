CREATE ROW POLICY customers_select_policy
ON customers
FOR SELECT
USING (id = currentUser() OR currentUser() LIKE 'sql-console%')
TO ALL;

CREATE ROW POLICY testruns_select_policy
ON testruns
FOR SELECT
USING (customer = currentUser() OR currentUser() LIKE 'sql-console%')
TO ALL;

CREATE ROW POLICY number_of_users_select_policy
ON number_of_users
FOR SELECT
USING (customer = currentUser() OR currentUser() LIKE 'sql-console%')
TO ALL;

CREATE ROW POLICY events_select_policy
ON events
FOR SELECT
USING (customer = currentUser() OR currentUser() LIKE 'sql-console%')
TO ALL;

CREATE ROW POLICY requests_summary_policy
ON requests_summary
FOR SELECT
USING (customer = currentUser() OR currentUser() LIKE 'sql-console%')
TO ALL;

CREATE ROW POLICY requests_policy
ON requests
FOR SELECT
USING (customer = currentUser() OR currentUser() LIKE 'sql-console%')
TO ALL;

CREATE ROLE PUBLIC_ROLE
GRANT SELECT ON requests TO PUBLIC_ROLE;
GRANT SELECT ON requests_summary TO PUBLIC_ROLE;
GRANT SELECT ON customers TO PUBLIC_ROLE;
GRANT SELECT ON testruns TO PUBLIC_ROLE;
GRANT INSERT (id, num_users, worker_count, username, locustfile, profile, arguments) ON testruns TO PUBLIC_ROLE;
GRANT UPDATE (end_time, requests, resp_time_avg, rps_avg, fail_ratio, exit_code) ON testruns TO PUBLIC_ROLE;
GRANT SELECT ON number_of_users TO PUBLIC_ROLE;
GRANT INSERT (time, run_id, user_count) ON number_of_users TO PUBLIC_ROLE;
GRANT SELECT ON events TO PUBLIC_ROLE;
GRANT INSERT (time, text, run_id) ON events TO PUBLIC_ROLE;
GRANT INSERT (time,run_id,greenlet_id,loadgen,name,request_type,response_time,success,response_length,exception,pid,url,context) ON requests TO PUBLIC_ROLE;

-- this is necessary for the exporter to write stats to the testrun
-- but is this safe? should possibly investigate alternatives
GRANT CREATE TEMPORARY TABLE ON *.* TO PUBLIC_ROLE
