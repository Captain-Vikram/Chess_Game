# Build Stage
# We add --platform=$BUILDPLATFORM to run the build step natively on your server's 
# ARM64 CPU, which prevents the esbuild/QEMU crash you saw earlier.
FROM --platform=$BUILDPLATFORM node:18-alpine AS build

WORKDIR /app

# Only copy package files first to take advantage of Docker's layer caching
COPY package*.json ./
RUN npm install

# Copy the rest of the project files
COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy the static files from the build stage to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
