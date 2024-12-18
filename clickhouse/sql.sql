CREATE TABLE requests (
    time DateTime('UTC') NOT NULL,
    run_id DateTime('UTC') NOT NULL,
    customer String NOT NULL DEFAULT currentUser(),
    exception Nullable(String),
    greenlet_id Int32 NOT NULL,
    loadgen String NOT NULL,
    name String NOT NULL,
    request_type String NOT NULL,
    response_length Int32,
    response_time Float64,
    success Bool NOT NULL,
    pid Int32,
    url Nullable(String)
    context String
) ENGINE = MergeTree
ORDER BY time

CREATE TABLE requests_summary (
    bucket DateTime('UTC') NOT NULL,
    name String NOT NULL,
    run_id DateTime('UTC') NOT NULL,
    customer String NOT NULL DEFAULT currentUser(),
    request_type String NOT NULL,
    response_length_state AggregateFunction(avg, Int32),
    response_time_state AggregateFunction(avg, Float64),
    min_state AggregateFunction(min, Float64),
    max_state AggregateFunction(max, Float64),
    perc95_state AggregateFunction(quantile(0.95), Float64),
    perc99_state AggregateFunction(quantile(0.99), Float64),
    count AggregateFunction(count, Int32),
    failed_count AggregateFunction(count, Int32),
) ENGINE = AggregatingMergeTree
ORDER BY (bucket, name, run_id, customer, request_type)

CREATE MATERIALIZED VIEW requests_summary_mv
TO requests_summary
AS
SELECT
    toStartOfInterval(time, INTERVAL 1 SECOND) AS bucket,
    name,
    run_id,
    customer,
    request_type,
    avgState(response_length) AS response_length_state,
    avgState(response_time) AS response_time_state,
    minState(response_time) AS min_state,
    maxState(response_time) AS max_state,
    quantileState(0.95)(response_time) AS perc95_state,
    quantileState(0.99)(response_time) AS perc99_state,
    countState() AS count,
    countState(exception) AS failed_count
FROM requests
GROUP BY name, run_id, customer, request_type, bucket;

CREATE TABLE testruns (
    id DateTime('UTC') NOT NULL,
    num_users Int32 NOT NULL,
    worker_count Int32,
    locustfile String,
    username String,
    description String,
    end_time DateTime('UTC'),
    rps_avg Decimal,
    resp_time_avg Decimal,
    fail_ratio Float64,
    requests Int32,
    arguments String,
    exit_code Int32,
    refund Bool NOT NULL DEFAULT false,
    customer String NOT NULL DEFAULT currentUser(),
    profile String,
)
ORDER BY id

CREATE TABLE number_of_users (
    user_count Int32 NOT NULL,
    time DateTime('UTC') NOT NULL,
    run_id DateTime('UTC'),
    customer String NOT NULL DEFAULT currentUser()
)
ORDER BY time

CREATE TABLE customers (
    id String NOT NULL,
    email String NOT NULL,
    name String,
    ts_username String NOT NULL,
    ts_password String NOT NULL,
    cluster_name String NOT NULL,
    namespace String NOT NULL DEFAULT 'default',
    users_per_worker Int32 NOT NULL DEFAULT 500,
    max_workers Int32 NOT NULL DEFAULT 20,
    max_users Int32 NOT NULL DEFAULT 10000,
    max_vuh Int32 NOT NULL DEFAULT 10000,
    tier String NOT NULL DEFAULT 'FREE'
)
PRIMARY KEY (id)
ORDER BY (id, email)

CREATE TABLE events (
    time DateTime('UTC') NOT NULL,
    String String NOT NULL,
    run_id DateTime('UTC'),
    customer String NOT NULL DEFAULT currentUser()
)
ORDER BY run_id
