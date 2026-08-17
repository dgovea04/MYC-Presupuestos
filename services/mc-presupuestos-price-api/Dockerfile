FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY services/mc-presupuestos-price-api ./services/mc-presupuestos-price-api

ENV NODE_ENV=production
ENV PRICE_API_PORT=8787
EXPOSE 8787

CMD ["npm", "run", "price-api:dev"]
