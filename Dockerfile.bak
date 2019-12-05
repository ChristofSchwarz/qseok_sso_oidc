FROM node:alpine AS base
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm install
RUN rm .env
EXPOSE 3000
CMD ["node", "app.js"]
