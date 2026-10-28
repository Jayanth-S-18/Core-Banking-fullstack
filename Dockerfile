FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev
COPY backend backend
COPY frontend frontend
WORKDIR /app/backend
ENV PORT=4000
EXPOSE 4000
CMD ["node", "server.js"]
