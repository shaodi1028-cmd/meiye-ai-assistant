FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
ENV MEIYE_DB_PATH=/data/db.json
ENV MEIYE_DB_SEED_PATH=/app/data/db.json
ENV MEIYE_BACKUP_DIR=/data/backups

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /data/backups \
  && cp data/db.json /data/db.json

EXPOSE 4173

CMD ["npm", "run", "start"]
