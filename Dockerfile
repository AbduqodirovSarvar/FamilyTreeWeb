# Build context: c:/Sarvar-Apps/FT/FamilyTreeUi
# docker build -t family-tree-ui .

# ───────────── Build stage ─────────────
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifests first for better layer caching.
COPY package*.json ./
RUN npm ci

# Copy the rest and build production bundle.
COPY . .
RUN npm run build -- --configuration=production

# ───────────── Runtime stage ─────────────
FROM nginx:alpine AS final

# Replace default nginx config with Angular-aware one.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled browser bundle (Angular outputs `browser/` even in SSR mode).
COPY --from=build /app/dist/FamilyTreeUi/browser /usr/share/nginx/html

# Angular's SSR mode produces `index.csr.html` for client-side rendering.
# Nginx serves static files only, so promote it to `index.html`.
RUN rm -f /usr/share/nginx/html/index.html && \
    mv /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
