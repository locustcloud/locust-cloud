FROM locustio/locust:master

COPY dist /dist

RUN pip install /dist/*

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
