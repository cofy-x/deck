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

# 2. Combined Install Layer
RUN apt-get update && apt-get install -y \
    # Basic tools
    wget \
    git \
    vim \
    curl \
    # Desktop environment
    xfce4 \
    xfce4-terminal \
    dbus-x11 \
    # Font support
    xfonts-base \
    xfonts-100dpi \
    xfonts-75dpi \
    xfonts-scalable \
    # VNC components
    x11vnc \
    novnc \
    supervisor \
    # SSH server
    openssh-server \
    # System tools
    net-tools \
    locales \
    # X11 components
    xvfb \
    x11-utils \
    x11-xserver-utils \
    # Screenshot tools
    gnome-screenshot \
    scrot \
    imagemagick \
    # Automation tools
    xdotool \
    xautomation \
    wmctrl \
    # Development dependencies
    build-essential \
    libx11-dev \
    libxext-dev \
    libxtst-dev \
    libxinerama-dev \
    libx11-xcb-dev \
    libxkbcommon-dev \
    libxkbcommon-x11-dev \
    libxcb-xkb-dev \
    libpng-dev \
    # Additional useful tools
    htop \
    tree \
    nano \
    sudo \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# 3. Environment Configuration
ENV DISPLAY=:1 \
    VNC_PORT=5901 \
    NO_VNC_PORT=6080 \
    VNC_RESOLUTION=1280x720 \
    DBUS_SESSION_BUS_ADDRESS=unix:path=/var/run/dbus/user_bus_socket \
    DBUS_SYSTEM_BUS_ADDRESS=unix:path=/var/run/dbus/user_bus_socket \
    VNC_USER=deck \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

# 4. User and Sudo Configuration
RUN locale-gen en_US.UTF-8 && \
    # Use the variable for user creation
    useradd -m -s /bin/bash ${VNC_USER} && \
    echo "${VNC_USER}:${VNC_USER}" | chpasswd && \
    usermod -aG sudo ${VNC_USER} && \
    echo "${VNC_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/91-deck && \
    chmod 0440 /etc/sudoers.d/91-deck && \
    # Create Directories
    mkdir -p /var/run/sshd /var/run/dbus /var/run/supervisor /var/log/supervisor /home/${VNC_USER}/.vnc && \
    # Create X11 Unix Socket Directory
    mkdir -p /tmp/.X11-unix && \
    chmod 1777 /tmp/.X11-unix && \
    chown root:root /tmp/.X11-unix && \
    # Create Runtime Directory
    mkdir -p /tmp/runtime-${VNC_USER} \
             /home/${VNC_USER}/.config \
             /home/${VNC_USER}/.cache \
             /home/${VNC_USER}/.local/share && \
    chmod 700 /tmp/runtime-${VNC_USER} && \
    # SSH Configuration
    sed -i 's/^AcceptEnv/#AcceptEnv/g' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config && \
    sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd && \
    # D-Bus Configuration
    dbus-uuidgen > /var/lib/dbus/machine-id && \
    # Permissions Configuration
    chown root:root /var/run/sshd && \
    chmod 755 /var/run/sshd && \
    chown -R ${VNC_USER}:${VNC_USER} \
        /home/${VNC_USER} \
        /tmp/runtime-${VNC_USER} \
        /var/run/dbus \
        /var/log/supervisor \
        /var/run/supervisor \
        /etc/supervisor/conf.d

# 5. NoVNC Configuration
RUN ln -sf /usr/share/novnc/vnc.html /usr/share/novnc/index.html

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /home/${VNC_USER}

EXPOSE 22 5901 6080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

