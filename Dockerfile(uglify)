#########################
# Base Image
#########################
#FROM node:latest AS base
FROM node:alpine AS base

WORKDIR /usr/src/app
COPY . /usr/src/app


#########################
# Obsfucated Image
#########################
FROM base AS prod-obfuscated-img
WORKDIR /usr/src/app
RUN npm install
RUN cd /usr/src/app
RUN npm install javascript-obfuscator -g
RUN mkdir -p ./src-maps
RUN mkdir -p ./src-maps/node_modules/@qlik
RUN javascript-obfuscator app.js  --output ./app.js --dead-code-injection true --source-map true --source-map-mode separate
RUN cp -pf *.map ./src-maps/
RUN find ./src-maps -type f -not -name "*.map" | xargs rm -f
RUN rm -f *.map
RUN rm -rf ./src-maps ./src-maps.tgz
RUN rm .env
RUN find . -type f -name *.map | xargs rm -f


##################
# Production Image
##################
#FROM node:latest AS production
FROM node:alpine AS production

USER nobody

WORKDIR /usr/src/app

ARG CREATED
ARG VERSION
ARG REVISION

LABEL org.opencontainers.image.created=$CREATED
LABEL org.opencontainers.image.version=$VERSION
LABEL org.opencontainers.image.revision=$REVISION

COPY --from=prod-obfuscated-img /usr/src/app /usr/src/app

EXPOSE 3000

CMD ["node", "app.js"]
