# Usa la imagen oficial de Node.js 22
FROM node:22.14.0

# Instala poppler-utils para manipulación de PDFs
RUN apt-get update && apt-get install -y poppler-utils && rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala las dependencias
RUN npm install --omit=dev

# Copia el resto del código fuente
COPY . .

# Expone el puerto (ajusta si usas otro)
EXPOSE 3000

# Variable de entorno para producción
ENV NODE_ENV=production

# Comando para iniciar la app
CMD [ "npm", "start" ]