FROM deck/desktop-runtime-dev:latest
LABEL description="Stable AI tool dependencies"

USER root

# Install OpenCode only (default runtime for apps/client local sandbox)
ENV OPENCODE_VERSION=1.2.6

RUN npm i -g opencode-ai@${OPENCODE_VERSION} && \
    npm cache clean --force

ENV PATH="/usr/local/bin:${PATH}"

# Do Not Change the User to the VNC User
