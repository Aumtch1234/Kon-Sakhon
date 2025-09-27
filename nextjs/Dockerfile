# ใช้ Debian-based image แทน Alpine
FROM node:20-bullseye

WORKDIR /src

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
