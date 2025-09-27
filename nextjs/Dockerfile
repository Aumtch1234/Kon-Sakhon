# 1️⃣ Build stage
FROM node:20-bullseye AS builder
WORKDIR /app

# ติดตั้ง dependencies
COPY package*.json ./
RUN npm install

# คัดลอกโค้ดทั้งหมดและ build
COPY . .
RUN npm run build

# 2️⃣ Production stage
FROM node:20-bullseye AS runner
WORKDIR /app

# ✅ copy package.json และ node_modules มาจาก builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# ✅ copy build ที่จำเป็น
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start"]
