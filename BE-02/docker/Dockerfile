FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY libs ./libs
COPY services ./services
COPY proto ./proto
RUN npm ci
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/libs ./libs
COPY --from=build /app/services ./services
COPY --from=build /app/proto ./proto
ARG SERVICE
ENV SERVICE_NAME=${SERVICE}
EXPOSE 3000 50051
CMD ["sh", "-c", "node services/${SERVICE}/dist/main.js"]
