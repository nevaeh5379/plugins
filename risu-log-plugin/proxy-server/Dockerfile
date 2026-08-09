FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app
COPY package.json server.mjs ./

ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787

USER node
CMD ["node", "server.mjs"]
