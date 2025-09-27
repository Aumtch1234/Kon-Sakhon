FROM node:20-bullseye AS builder
WORKDIR /src

# ติดตั้ง dependencies ก่อน
COPY package*.json ./
RUN npm install

# คัดลอกโค้ดทั้งหมด
COPY . .

RUN npm run build

# Production stage
FROM node:20-bullseye AS runner
WORKDIR /src

COPY package*.json ./

# ติดตั้งเฉพาะ production dependencies (เล็ก เร็ว ปลอดภัย)
RUN npm install --omit=dev

# คัดลอกไฟล์ build ที่จำเป็นเท่านั้น
COPY --from=builder /src/.next ./.next
COPY --from=builder /src/public ./public
COPY --from=builder /src/next.config.mjs ./next.config.mjs

EXPOSE 3000

# รันแอปแบบ production
CMD ["npm", "run", "start"]
