# Build Stage - Force this to run natively on the server's CPU
FROM --platform=$BUILDPLATFORM node:18-alpine AS build
WORKDIR /app

# Install dependencies (respects your .dockerignore)
COPY package*.json ./
RUN npm install

# Copy source and build (Native ARM64 speed prevents esbuild crash)
COPY . .
RUN npm run build

# Production Stage - Nginx is architecture-agnostic
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
