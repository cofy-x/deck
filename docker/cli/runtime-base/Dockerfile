ARG TARGETARCH=amd64
FROM ubuntu:24.04

ARG MIRROR_SOURCE=aliyun
ENV DEBIAN_FRONTEND=noninteractive

# 1. Optimized Mirror Selection
RUN cp /etc/apt/sources.list /etc/apt/sources.list.backup && \
    if [ "$MIRROR_SOURCE" = "aliyun" ]; then MIRROR="mirrors.aliyun.com"; \
    elif [ "$MIRROR_SOURCE" = "ustc" ]; then MIRROR="mirrors.ustc.edu.cn"; \
    elif [ "$MIRROR_SOURCE" = "tuna" ]; then MIRROR="mirrors.tuna.tsinghua.edu.cn"; \
    else MIRROR="archive.ubuntu.com"; fi && \
    sed -i "s|archive.ubuntu.com|$MIRROR|g" /etc/apt/sources.list && \
    sed -i "s|security.ubuntu.com|$MIRROR|g" /etc/apt/sources.list && \
    sed -i "s|ports.ubuntu.com|$MIRROR|g" /etc/apt/sources.list

# 2. Basic Tools(Only for CLI)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    git \
    vim \
    curl \
    sudo \
    locales \
    ca-certificates \
    zsh \
    autojump \
    python3-pip \
    python3-dev \
    python3-full \
    pipx \
    build-essential \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 3. Install Go
ENV GO_VERSION=1.25.6
RUN wget -q https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz && \
    rm -rf /usr/local/go && tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz && \
    rm go${GO_VERSION}.linux-amd64.tar.gz
ENV PATH="/usr/local/go/bin:${PATH}"

# 4. Create User
ENV DECK_USER=deck LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
RUN locale-gen en_US.UTF-8 && \
    useradd -m -s /usr/bin/zsh ${DECK_USER} && \
    echo "${DECK_USER}:${DECK_USER}" | chpasswd && \
    usermod -aG sudo ${DECK_USER} && \
    echo "${DECK_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-deck && \
    chmod 0440 /etc/sudoers.d/91-deck

USER ${DECK_USER}
WORKDIR /home/${DECK_USER}

# Install Poetry
RUN pipx install poetry
ENV PATH="/home/${DECK_USER}/.local/bin:${PATH}"

# Install Node.js
ENV NVM_DIR=/home/${DECK_USER}/.nvm
ENV NODE_VERSION=v24.13.0
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
    . "$NVM_DIR/nvm.sh" && \
    nvm install ${NODE_VERSION} && \
    nvm use ${NODE_VERSION} && \
    nvm alias default ${NODE_VERSION} && \
    npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com
ENV PATH="${NVM_DIR}/versions/node/${NODE_VERSION}/bin:${PATH}"

# Install Oh-My-Zsh & plugins
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended && \
    git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions && \
    git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

# Environment variables
RUN sed -i 's/plugins=(git)/plugins=(git zsh-autosuggestions zsh-syntax-highlighting autojump)/' ~/.zshrc && \
    printf '\n# --- Development Env Config ---\n\
export NVM_DIR="$HOME/.nvm"\n\
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\n\
[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"\n\
export PATH=$PATH:/usr/local/go/bin:$HOME/.local/bin\n\
export GOPROXY=https://goproxy.cn,direct\n\
. /usr/share/autojump/autojump.sh\n' >> ~/.zshrc

RUN /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/cofy-x/pokefetch/main/install.sh)"

ENV PATH="/usr/local/go/bin:/home/${DECK_USER}/.local/bin:${NVM_DIR}/versions/node/${NODE_VERSION}/bin:${PATH}"

RUN node --version && go version && python3 --version && poetry --version

# Switch back to root user
USER root

RUN rm -rf /etc/update-motd.d/* /etc/legal /etc/motd && \
    printf '\n\
========================================================\n\
🚀  DECK INDUSTRIAL DEV-STATION READY\n\
========================================================\n\
👤  User:       %s\n\
🔧  Node.js:    %s\n\
🐹  Go:         %s\n\
🐍  Python:     3.10\n\
🏠  Workspace:  /home/%s\n\
========================================================\n\n' \
"${DECK_USER}" "${NODE_VERSION}" "${GO_VERSION}" "${DECK_USER}" > /etc/motd