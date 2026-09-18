FROM node:22-bookworm-slim

WORKDIR /app

COPY . .

RUN npm ci
RUN npm run build -w @aepick/kiosk

ENV NODE_ENV=production
EXPOSE 8787

CMD ["npm", "run", "-w", "server", "start"]