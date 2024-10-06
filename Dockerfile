FROM locustio/locust:2.31.9.dev11 

COPY dist /dist

RUN pip install /dist/*

ADD run.sh .

ENTRYPOINT ["bash", "./run.sh"]
