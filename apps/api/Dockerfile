FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/
RUN npm ci --workspace=@dx-aiot/api --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN npm run --workspace=@dx-aiot/api build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
EXPOSE 3001
CMD ["node", "apps/api/dist/main"]

FROM node:20-alpine AS dev
WORKDIR /app
COPY . .
RUN npm ci && \
    if [ ! -d /app/node_modules/typeorm ] && [ -d /app/apps/api/node_modules/typeorm ]; then \
      ln -s /app/apps/api/node_modules/typeorm /app/node_modules/typeorm; \
    fi && \
    if [ ! -d /app/node_modules/pg ] && [ -d /app/apps/api/node_modules/pg ]; then \
      ln -s /app/apps/api/node_modules/pg /app/node_modules/pg; \
    fi
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace=@dx-aiot/api"]
