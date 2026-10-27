FROM node:22-alpine AS build
WORKDIR /app

# Cache dependency installation separately from UI changes.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --registry=https://registry.npmmirror.com \
    --fetch-retries=5 --fetch-timeout=120000
COPY . .
ENV GENERATE_SOURCEMAP=false
RUN npm run build

FROM nginx:stable-alpine
ENV INCALMO_API_UPSTREAM=attacker:8888
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
