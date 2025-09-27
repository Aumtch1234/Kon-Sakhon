FROM node:20-bullseye AS builder
WORKDIR /app

# ติดตั้ง dependencies ก่อน
COPY package*.json ./
RUN npm install

# คัดลอกโค้ดทั้งหมด
COPY . .

RUN npm run build

# Production stage
FROM node:20-bullseye AS runner
WORKDIR /app

COPY package*.json ./

# ติดตั้งเฉพาะ production dependencies (เล็ก เร็ว ปลอดภัย)
RUN npm install --omit=dev

# คัดลอกไฟล์ build ที่จำเป็นเท่านั้น
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

# รันแอปแบบ production
CMD ["npm", "run", "start"]
