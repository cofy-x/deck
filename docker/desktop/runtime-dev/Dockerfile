# Inherit from your newly created base image
FROM deck/desktop-runtime-base:24.04-aliyun-amd64

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    zsh \
    autojump \
    python3-pip \
    python3-dev \
    python3-full \
    pipx \
    fonts-liberation \
    libu2f-udev \
    libxdg-basedir1 \
    xdg-utils \
    libnss3 \
    libgbm1 \
    libasound2t64 \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm google-chrome-stable_current_amd64.deb \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN chsh -s /usr/bin/zsh ${VNC_USER}

# Create a desktop shortcut
COPY config/google-chrome.desktop /tmp/google-chrome.desktop
COPY config/google-chrome-alias.sh /tmp/google-chrome-alias.sh

RUN mkdir -p /home/${VNC_USER}/Desktop && \
    install -m 0755 /tmp/google-chrome.desktop /home/${VNC_USER}/Desktop/google-chrome.desktop && \
    install -m 0644 /tmp/google-chrome.desktop /usr/share/applications/google-chrome.desktop && \
    chown -R ${VNC_USER}:${VNC_USER} /home/${VNC_USER}/Desktop && \
    install -m 0644 /tmp/google-chrome-alias.sh /etc/profile.d/deck-google-chrome.sh && \
    rm -f /tmp/google-chrome.desktop /tmp/google-chrome-alias.sh && \
    printf '\n[ -f /etc/profile.d/deck-google-chrome.sh ] && . /etc/profile.d/deck-google-chrome.sh\n' >> /etc/zsh/zshrc && \
    printf '\n[ -f /etc/profile.d/deck-google-chrome.sh ] && . /etc/profile.d/deck-google-chrome.sh\n' >> /etc/bash.bashrc

COPY config/chrome-policy-managed.json /tmp/chrome-policy-managed.json

RUN install -d -m 0755 /etc/opt/chrome/policies/managed && \
    install -m 0644 /tmp/chrome-policy-managed.json /etc/opt/chrome/policies/managed/deck-sandbox.json && \
    rm -f /tmp/chrome-policy-managed.json

ENV DECK_LAUNCHER_TRUST_FIX_PATTERNS="/usr/share/applications/google-chrome.desktop"

COPY scripts/deck-fix-desktop-launchers.sh /usr/local/bin/deck-fix-desktop-launchers
COPY scripts/deck-patch-xinitrc-launchers.sh /usr/local/bin/deck-patch-xinitrc-launchers
COPY config/deck-fix-desktop-launchers.desktop /tmp/deck-fix-desktop-launchers.desktop

RUN mkdir -p /etc/xdg/autostart && \
    install -m 0644 /tmp/deck-fix-desktop-launchers.desktop /etc/xdg/autostart/deck-fix-desktop-launchers.desktop && \
    rm -f /tmp/deck-fix-desktop-launchers.desktop && \
    chmod 0755 /usr/local/bin/deck-fix-desktop-launchers /usr/local/bin/deck-patch-xinitrc-launchers && \
    /usr/local/bin/deck-patch-xinitrc-launchers && \
    grep -q 'deck-fix-desktop-launchers' /etc/xdg/xfce4/xinitrc

# Install Go
ENV GO_VERSION=1.25.6
RUN wget -q https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz && \
    rm -rf /usr/local/go && tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz && \
    rm go${GO_VERSION}.linux-amd64.tar.gz
ENV PATH="/usr/local/go/bin:${PATH}"

# Switch to the user
USER ${VNC_USER}
WORKDIR /home/${VNC_USER}

# Install Poetry
RUN pipx install poetry
ENV PATH="/home/${VNC_USER}/.local/bin:${PATH}"

# Install Node.js
ENV NVM_DIR=/home/${VNC_USER}/.nvm
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

ENV PATH="/usr/local/go/bin:/home/${VNC_USER}/.local/bin:${NVM_DIR}/versions/node/${NODE_VERSION}/bin:${PATH}"

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
📺  VNC/NoVNC:  5901 / 6080\n\
🏠  Workspace:  /home/%s\n\
========================================================\n\n' \
"${VNC_USER}" "${NODE_VERSION}" "${GO_VERSION}" "${VNC_USER}" > /etc/motd
