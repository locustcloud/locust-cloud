FROM locustio/locust:latest

RUN pip install locust-cloud "psycopg[binary,pool]"

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
