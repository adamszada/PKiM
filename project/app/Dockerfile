FROM node:14-alpine

RUN apk add --no-cache python3

WORKDIR /app

ARG PYTHON_FILE
COPY $PYTHON_FILE python/send_email.py

COPY package*.json ./
COPY todo.js ./
COPY public ./public

RUN npm install

CMD [ "node", "todo.js" ]
