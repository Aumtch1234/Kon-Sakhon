# ---------- STAGE 1: Build ----------
FROM node:20-bullseye AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# ✅ สร้าง build production ของ Next.js
RUN npm run build

# ---------- STAGE 2: Run ----------
FROM node:20-bullseye

WORKDIR /app

# ✅ Copy เฉพาะไฟล์ที่ build แล้ว + node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000

# ✅ รันแบบ production (เร็ว เสถียรกว่า dev)
CMD ["npm", "start"]
