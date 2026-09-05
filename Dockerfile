FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV PORT=8081
EXPOSE 8081
CMD ["node", "index.js"]
