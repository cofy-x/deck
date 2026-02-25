# Build arguments for architecture
ARG TARGETARCH=amd64
FROM deck-computer-use-${TARGETARCH}:build AS computer-use-plugin

# Now inherit from the STABLE desktop runtime ai image
FROM deck/desktop-runtime-ai:latest

USER root

# Copy stable OpenCode config and built-in skills first for better layer reuse.
RUN install -d -m 0755 -o ${VNC_USER} -g ${VNC_USER} /home/${VNC_USER}/.config/opencode/skills
COPY --chown=${VNC_USER}:${VNC_USER} docker/desktop/sandbox-ai/config/opencode.json /home/${VNC_USER}/.config/opencode/opencode.json
COPY --chown=${VNC_USER}:${VNC_USER} skills/deck-cli /home/${VNC_USER}/.config/opencode/skills/deck-cli

# Copy desktop wallpaper and XFCE desktop defaults in stable layers.
RUN install -d -m 0755 \
    /usr/local/share/wallpapers/deck \
    /home/${VNC_USER}/.config/xfce4/xfconf/xfce-perchannel-xml \
    /etc/xdg/xfce4/xfconf/xfce-perchannel-xml
COPY docker/desktop/sandbox-ai/assets/wallpapers/deck-desktop.png /usr/local/share/wallpapers/deck/deck-desktop.png
COPY --chown=${VNC_USER}:${VNC_USER} docker/desktop/sandbox-ai/config/xfce4-desktop.xml /home/${VNC_USER}/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml
COPY docker/desktop/sandbox-ai/config/xfce4-desktop.xml /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml
RUN chmod 0644 /usr/local/share/wallpapers/deck/deck-desktop.png && \
    chmod 0644 /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml && \
    chown -R ${VNC_USER}:${VNC_USER} /home/${VNC_USER}/.config/xfce4

# COPY frequently changing binaries at the VERY END
COPY --from=computer-use-plugin /app/deck-computer-use /usr/local/bin/computer-use
COPY dist/linux_amd64/daemon /usr/local/bin/deck-daemon
COPY dist/linux_amd64/cli /usr/local/bin/deck

# Final permission adjustments are fast
RUN ln -s /usr/local/bin/computer-use /usr/local/lib/deck-computer-use && \
    chown ${VNC_USER}:${VNC_USER} /usr/local/bin/computer-use && \
    chown ${VNC_USER}:${VNC_USER} /usr/local/bin/deck-daemon && \
    chown ${VNC_USER}:${VNC_USER} /usr/local/bin/deck

# Switch to the user
USER ${VNC_USER}

ENTRYPOINT ["/usr/local/bin/deck-daemon"]
