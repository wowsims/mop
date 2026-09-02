# syntax=docker/dockerfile:1

##############################################################################
# build — heavy toolchain (Go + Node + protoc). Compiles the WASM, builds the
# Vite client, embeds it into the Go binary, and produces a single fully-static
# `wowsimmop` executable. Used only to feed the `prod` stage below.
#
#   docker build --target prod -t wowsimmop .
##############################################################################
FROM golang:1.25 AS build

# Several makefile recipes rely on bash features, so make `sh` point at bash.
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Build the server as a 100% static binary so the runtime image can be scratch.
ENV CGO_ENABLED=0

# protoc (Go proto gen) — the TS proto gen + Vite build come from node_modules.
# libprotobuf-dev provides the well-known protos (google/protobuf/descriptor.proto)
# that common.proto imports; protobuf-compiler only *recommends* it, so with
# --no-install-recommends it must be named explicitly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends protobuf-compiler libprotobuf-dev ca-certificates curl xz-utils \
 && rm -rf /var/lib/apt/lists/*

# Node, matching .nvmrc, installed from the official static tarball.
ENV NODE_VERSION=22.17.1
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz \
 && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
 && rm /tmp/node.tar.xz \
 && node --version && npm --version

# protoc-gen-go plugin used by `make proto`.
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
ENV PATH="/go/bin:${PATH}"

WORKDIR /src

# Dependency layers first, so they cache across source-only changes.
COPY go.mod go.sum ./
RUN go mod download
COPY package.json package-lock.json ./
RUN npm ci

# Build everything: proto -> wasm + client bundle -> embed -> static server.
COPY . .
RUN make wowsimmop

##############################################################################
# prod — production runtime. Empty base image: only the static binary, no
# shell, no package manager, nothing to exec into. The app is stateless and
# serves its client from files embedded in the binary, so no files are read
# from disk. See docker-compose.yml for the hardened deployment.
##############################################################################
FROM scratch AS prod

# Run as an unprivileged numeric UID/GID. scratch has no /etc/passwd, but the
# kernel only needs the numeric ids — the binary touches no files it must own.
USER 10001:10001

COPY --from=build /src/wowsimmop /wowsimmop

EXPOSE 8080

ENTRYPOINT ["/wowsimmop"]
# --usefs=false  serve the embedded client (not from disk)
# --launch=false don't try to open a browser
# --nvc          skip the outbound GitHub version check (no egress / no CA certs)
# --host=:8080   listen on all interfaces inside the container network
CMD ["--usefs=false", "--launch=false", "--nvc", "--host=:8080"]

##############################################################################
# dev — local development environment (live reload via air + Vite). This is
# the DEFAULT target, so the existing `docker build -t wowsims-mop .` workflow
# is unchanged.
##############################################################################
FROM golang:1.25 AS dev

WORKDIR /mop

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

COPY . .
COPY gitconfig /etc/gitconfig

# Install all Go dependencies
RUN apt-get update \
	&& apt-get install -y protobuf-compiler \
	&& go get -u google.golang.org/protobuf \
	&& go install google.golang.org/protobuf/cmd/protoc-gen-go@latest \
	&& curl -sSfL https://raw.githubusercontent.com/cosmtrek/air/master/install.sh | sh -s -- -b $(shell go env GOPATH)/bin

ENV NODE_VERSION=22.17.1
ENV NVM_DIR="/root/.nvm"

# Install all Frontend dependencies
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

EXPOSE 8080 3333 5173
