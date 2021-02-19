FROM node:15

RUN apt-get update \
 && apt-get install -y inotify-tools \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://deno.land/x/install/install.sh | DENO_INSTALL=/usr/local sh \
 && mkdir /app && chown node:node /app

USER node
WORKDIR /app

ENV BACKUP_DIR /backup
ENV OUTPUT_FILE /dist/config.json

COPY Makefile parser.ts build.ts ./
RUN make install

ENTRYPOINT [ "make" ]
