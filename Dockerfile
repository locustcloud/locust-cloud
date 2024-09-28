FROM locustio/locust:2.31.8

COPY dist /dist

RUN pip install /dist/*

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
