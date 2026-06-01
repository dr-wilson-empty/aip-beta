# did:aip driver image for the DIF Universal Resolver.
#
# Multi-stage: compile TypeScript in the builder, ship only production deps +
# the compiled dist in the runtime image. `--ignore-scripts` keeps the install
# hermetic (no native build toolchain needed): our prod deps (express,
# @aipagents/did-resolver -> @solana/web3.js, bs58) all work without any
# postinstall/native compilation.

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    DRIVER_PORT=8080 \
    SOLANA_RPC_URL=https://api.devnet.solana.com \
    SOLANA_NETWORK=solana:devnet
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
EXPOSE 8080
USER node
# Uses Node core http (no curl/wget, no extra deps) so it works on alpine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.DRIVER_PORT||8080)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/server.js"]
