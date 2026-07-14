# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines env vars at build time, so this must be set here (not just at
# `docker compose run`) for the browser bundle to call the right API origin.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
