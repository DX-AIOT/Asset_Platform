FROM node:20-alpine AS dev
WORKDIR /app

COPY . .

RUN npm ci

# Fix npm workspace hoisting: typeorm stays in apps/api but @nestjs/typeorm lands in root
RUN if [ ! -d /app/node_modules/typeorm ] && [ -d /app/apps/api/node_modules/typeorm ]; then \
      ln -s /app/apps/api/node_modules/typeorm /app/node_modules/typeorm; \
    fi && \
    if [ ! -d /app/node_modules/pg ] && [ -d /app/apps/api/node_modules/pg ]; then \
      ln -s /app/apps/api/node_modules/pg /app/node_modules/pg; \
    fi

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace=apps/api"]
