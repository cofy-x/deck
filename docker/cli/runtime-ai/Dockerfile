ARG RUNTIME_VERSION=latest
FROM deck/cli-runtime-base:${RUNTIME_VERSION}

USER root

# 1. Install heavy NPM tools (versions are pinned)
ENV OPENCODE_VERSION=1.1.51 \
    CODEX_VERSION=0.97.0 \
    GEMINI_VERSION=0.27.0

RUN npm i -g opencode-ai@${OPENCODE_VERSION} \
    @openai/codex@${CODEX_VERSION} \
    @google/gemini-cli@${GEMINI_VERSION} && \
    npm cache clean --force

# 2. Install Claude Code (pinned or handled carefully)
RUN curl -fsSL https://claude.ai/install.sh | bash && \
    mv /root/.local/share/claude /usr/local/share/ && \
    rm -f /usr/local/bin/claude && \
    ln -s /usr/local/share/claude/versions/$(ls /usr/local/share/claude/versions | head -n 1) /usr/local/bin/claude && \
    chmod -R 755 /usr/local/share/claude && \
    chmod +x /usr/local/bin/claude

ENV PATH="/usr/local/bin:${PATH}"

USER ${DECK_USER}
WORKDIR /home/${DECK_USER}