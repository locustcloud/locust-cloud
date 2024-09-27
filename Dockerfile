FROM locustio/locust:2.31.8.dev14

RUN pip install locust-cloud "psycopg[binary,pool]"

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
