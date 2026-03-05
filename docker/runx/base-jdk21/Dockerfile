FROM ubuntu:24.04

ARG TARGETARCH=amd64
ARG MIRROR_SOURCE=aliyun
ENV DEBIAN_FRONTEND=noninteractive

# 1. Mirror Selection
RUN cp /etc/apt/sources.list /etc/apt/sources.list.backup && \
    if [ "$MIRROR_SOURCE" = "aliyun" ]; then MIRROR="mirrors.aliyun.com"; \
    elif [ "$MIRROR_SOURCE" = "ustc" ]; then MIRROR="mirrors.ustc.edu.cn"; \
    elif [ "$MIRROR_SOURCE" = "tuna" ]; then MIRROR="mirrors.tuna.tsinghua.edu.cn"; \
    else MIRROR="archive.ubuntu.com"; fi && \
    sed -i "s|archive.ubuntu.com|$MIRROR|g" /etc/apt/sources.list && \
    sed -i "s|security.ubuntu.com|$MIRROR|g" /etc/apt/sources.list && \
    sed -i "s|ports.ubuntu.com|$MIRROR|g" /etc/apt/sources.list

# 2. Install runtime essentials (SSH + Python + JDK21)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    vim \
    sudo \
    net-tools \
    locales \
    ca-certificates \
    zsh \
    autojump \
    openssh-server \
    supervisor \
    python3 \
    python3-pip \
    python3-dev \
    python3-full \
    pipx \
    openjdk-21-jdk \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# 3. Environment and user settings
ENV APP_USER=admin \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

RUN locale-gen en_US.UTF-8 && \
    useradd -m -s /bin/bash ${APP_USER} && \
    echo "${APP_USER}:${APP_USER}" | chpasswd && \
    usermod -aG sudo ${APP_USER} && \
    echo "${APP_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-admin && \
    chmod 0440 /etc/sudoers.d/91-admin && \
    mkdir -p /var/run/sshd /var/run/supervisor /var/log/supervisor && \
    sed -i 's/^AcceptEnv/#AcceptEnv/g' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed 's@session\\s*required\\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd && \
    chmod 755 /var/run/sshd && \
    chown -R ${APP_USER}:${APP_USER} /home/${APP_USER} /var/log/supervisor /var/run/supervisor /etc/supervisor/conf.d

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /home/${APP_USER}
EXPOSE 22

USER root

RUN java -version && python3 --version

# 4. Shell setup (zsh + oh-my-zsh)
RUN chsh -s /usr/bin/zsh ${APP_USER}

USER ${APP_USER}

RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended && \
    git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions && \
    git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

RUN sed -i 's/plugins=(git)/plugins=(git zsh-autosuggestions zsh-syntax-highlighting autojump)/' ~/.zshrc && \
    printf '\n# --- Development Env Config ---\n\
export PATH=$PATH:$HOME/.local/bin\n\
. /usr/share/autojump/autojump.sh\n' >> ~/.zshrc

USER root

# 5. Login banner (replace default Ubuntu motd noise)
RUN rm -rf /etc/update-motd.d/* /etc/legal /etc/motd && \
    printf '%b' "\n\
\033[1;36m========================================================\033[0m\n\
\033[1;32m  DECK RUNX BASE JDK21 CONTAINER READY\033[0m\n\
\033[1;36m========================================================\033[0m\n\
  \033[1;33mUser:\033[0m      ${APP_USER}\n\
  \033[1;33mSSH Port:\033[0m  22\n\
  \033[1;33mJava:\033[0m      OpenJDK 21\n\
  \033[1;33mPython:\033[0m    Python 3\n\
  \033[1;33mShell:\033[0m     zsh (oh-my-zsh)\n\
\033[1;36m========================================================\033[0m\n\n" > /etc/motd

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
