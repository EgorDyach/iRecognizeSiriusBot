# Use the official Node.js image as a base
FROM node:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port (if your bot listens on a specific port, otherwise this can be omitted)
EXPOSE 3000

# Command to run your bot
CMD ["npm", "run", "nodemon"]
