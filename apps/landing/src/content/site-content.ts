/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Locale, SiteContent } from '@/types/content';

const RELEASES_URL = 'https://github.com/cofy-x/deck/releases';
const GITHUB_URL = 'https://github.com/cofy-x/deck';
const DOCS_URL = 'https://github.com/cofy-x/deck/tree/main/docs';

export const SITE_CONTENT: Record<Locale, SiteContent> = {
  en: {
    localeButton: '中文',
    header: {
      primaryAction: { label: 'Download', href: RELEASES_URL, variant: 'primary' },
    },
    nav: [
      { href: '#demo', label: 'Demo' },
      { href: '#capabilities', label: 'Capabilities' },
      { href: '#architecture', label: 'Architecture' },
      { href: '#quick-start', label: 'Quick Start' },
      { href: '#roadmap', label: 'Roadmap' },
      { href: '#community', label: 'Community' },
    ],
    hero: {
      badge: 'LOCAL-FIRST AI OPERATIONS',
      title: 'Deck is the local cockpit for autonomous AI agents.',
      description:
        'Run AI workloads in secure Docker sandboxes, inspect every step in a live desktop, and keep full control over tooling, data, and runtime permissions.',
      actions: [
        { label: 'Download', href: RELEASES_URL, variant: 'primary' },
        { label: 'GitHub', href: GITHUB_URL, variant: 'secondary' },
        { label: 'Docs', href: DOCS_URL, variant: 'secondary' },
      ],
      trustChips: [
        'Open Source (Apache-2.0)',
        'Local-first orchestration',
        'Docker sandbox runtime',
      ],
    },
    demo: {
      title: 'Watch Deck in action',
      description:
        'The desktop cockpit combines chat control and live sandbox execution in a single workspace.',
      imageAlt: 'Deck desktop demo showing chat and sandbox panes',
    },
    capabilities: {
      title: 'Why teams pick Deck',
      description:
        'Built for developers who want powerful automation without giving up runtime safety or observability.',
      items: [
        {
          icon: 'shield',
          title: 'Secure local sandboxes',
          description:
            'Isolated Docker environments keep experiments contained while your source and credentials stay under your control.',
        },
        {
          icon: 'monitor',
          title: 'Live desktop visibility',
          description:
            'Observe what the agent does in real time through noVNC desktop streaming and command-level traceability.',
        },
        {
          icon: 'automation',
          title: 'AI-native execution flow',
          description:
            'OpenCode integration enables multi-turn tool usage, diffs, reasoning traces, and permission-gated actions.',
        },
        {
          icon: 'bridge',
          title: 'Unified bridge ecosystem',
          description:
            'Coordinate workflows from WhatsApp, Telegram, Slack, Feishu, Discord, DingTalk, and Email with Pilot.',
        },
      ],
    },
    architecture: {
      title: 'Architecture at a glance',
      description:
        'Deck keeps orchestration local by default while still supporting bridge-based operational channels.',
      steps: [
        {
          title: 'Deck Client',
          description: 'A Tauri + React desktop cockpit for session control and visualization.',
        },
        {
          title: 'Sandbox Runtime',
          description:
            'Docker-hosted Linux desktop with daemon, computer-use plugin, and OpenCode runtime.',
        },
        {
          title: 'Pilot Bridge Suite',
          description: 'Host, bridge, and server components for messaging-driven automation.',
        },
      ],
    },
    quickStart: {
      title: 'Quick start',
      description:
        'Get a running sandbox in minutes. This mirrors the primary setup flow from the repository README.',
      steps: [
        {
          title: 'Pull sandbox image',
          command:
            'docker pull ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest\ndocker tag ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest deck/desktop-sandbox-ai:latest',
        },
        {
          title: 'Install the desktop app',
          command: 'Download deck.app from GitHub Releases and move it to /Applications.',
        },
        {
          title: 'Start your first sandbox',
          command:
            'Open Deck, choose the Local profile, and click "Start Sandbox" to begin the first session.',
          note: 'For macOS Gatekeeper warnings, check install notes in README.',
        },
      ],
    },
    roadmap: {
      title: 'Roadmap highlights',
      description:
        'Current focus is stable local operations, then deeper bridge-client convergence for v0.1.',
      groups: [
        {
          title: 'Now',
          items: [
            'Stable desktop cockpit for local and remote workflows.',
            'Session reliability and sandbox startup improvements.',
            'Faster sandbox image boot and runtime diagnostics.',
          ],
        },
        {
          title: 'Next',
          items: [
            'Pilot integration directly inside the client.',
            'Unified orchestration for desktop and bridge sessions.',
            'Multi-session and multi-sandbox management.',
          ],
        },
        {
          title: 'Future',
          items: [
            'Linux and Windows desktop distribution.',
            'Plugin extension system for custom sandbox runtimes.',
            'Collaboration surfaces for team-level operations.',
          ],
        },
      ],
    },
    community: {
      title: 'Build with the community',
      description:
        'Follow releases, join discussions, and share workflow ideas with maintainers and contributors.',
      links: [
        { label: 'GitHub Repository', href: GITHUB_URL },
        { label: 'Discussions', href: 'https://github.com/cofy-x/deck/discussions' },
        { label: 'Issues', href: 'https://github.com/cofy-x/deck/issues' },
      ],
    },
    footer: 'Deck is open source under Apache-2.0.',
  },
  'zh-CN': {
    localeButton: 'EN',
    header: {
      primaryAction: { label: '下载', href: RELEASES_URL, variant: 'primary' },
    },
    nav: [
      { href: '#demo', label: '演示' },
      { href: '#capabilities', label: '能力' },
      { href: '#architecture', label: '架构' },
      { href: '#quick-start', label: '快速开始' },
      { href: '#roadmap', label: '路线图' },
      { href: '#community', label: '社区' },
    ],
    hero: {
      badge: '本地优先 AI 运维',
      title: 'Deck 是面向自治 AI Agent 的本地控制台。',
      description:
        '在安全的 Docker 沙箱中运行 AI 任务，通过实时桌面观察执行过程，并且对工具、数据和权限保持完全掌控。',
      actions: [
        { label: '下载', href: RELEASES_URL, variant: 'primary' },
        { label: 'GitHub', href: GITHUB_URL, variant: 'secondary' },
        { label: '文档', href: DOCS_URL, variant: 'secondary' },
      ],
      trustChips: ['Apache-2.0 开源', '本地优先编排', 'Docker 沙箱运行时'],
    },
    demo: {
      title: 'Deck 实际运行效果',
      description: '桌面控制台把聊天控制与沙箱实时执行整合在同一工作区。',
      imageAlt: 'Deck 桌面演示，左侧聊天右侧沙箱',
    },
    capabilities: {
      title: '为什么选择 Deck',
      description:
        '为希望提升自动化效率，同时保持运行安全与可观测性的开发团队设计。',
      items: [
        {
          icon: 'shield',
          title: '安全的本地沙箱',
          description:
            '通过隔离 Docker 环境承载试验流程，源码与凭据仍留在可控边界内。',
        },
        {
          icon: 'monitor',
          title: '可视化实时观察',
          description:
            '通过 noVNC 桌面流和命令级追踪实时查看 Agent 每一步动作。',
        },
        {
          icon: 'automation',
          title: 'AI 原生执行链路',
          description:
            '内置 OpenCode，多轮工具调用、Diff、思考轨迹与权限门控一体化。',
        },
        {
          icon: 'bridge',
          title: '统一消息桥接',
          description:
            '通过 Pilot 接入 WhatsApp、Telegram、Slack、飞书、Discord、钉钉、邮件等渠道。',
        },
      ],
    },
    architecture: {
      title: '架构总览',
      description: 'Deck 默认本地编排，同时支持通过桥接通道扩展自动化触达。',
      steps: [
        {
          title: 'Deck Client',
          description: '基于 Tauri + React 的桌面控制台，负责会话控制与可视化。',
        },
        {
          title: 'Sandbox Runtime',
          description: '运行在 Docker 的 Linux 桌面环境，集成 daemon、computer-use 与 OpenCode。',
        },
        {
          title: 'Pilot Bridge Suite',
          description: '通过 host / bridge / server 组件承接消息驱动的编排流程。',
        },
      ],
    },
    quickStart: {
      title: '快速开始',
      description: '几分钟内启动第一个沙箱，流程与仓库 README 保持一致。',
      steps: [
        {
          title: '拉取沙箱镜像',
          command:
            'docker pull ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest\ndocker tag ghcr.io/cofy-x/deck/desktop-sandbox-ai:latest deck/desktop-sandbox-ai:latest',
        },
        {
          title: '安装桌面应用',
          command: '从 GitHub Releases 下载 deck.app 并移动到 /Applications。',
        },
        {
          title: '启动第一个沙箱',
          command:
            '打开 Deck，选择内置 Local 配置，点击 “Start Sandbox” 开始会话。',
          note: '若遇到 macOS 安全限制，请参考 README 的安装说明。',
        },
      ],
    },
    roadmap: {
      title: '路线图重点',
      description: '当前聚焦本地运行稳定性，随后推进桥接能力与客户端的深度融合。',
      groups: [
        {
          title: '当前',
          items: [
            '稳定的本地与远程沙箱工作流。',
            '会话控制与启动可靠性持续优化。',
            '镜像启动速度与运行诊断能力增强。',
          ],
        },
        {
          title: '下一步',
          items: [
            'Pilot 能力直接整合进客户端。',
            '桌面与桥接统一编排入口。',
            '多会话、多沙箱管理。',
          ],
        },
        {
          title: '长期',
          items: [
            '支持 Linux 与 Windows 桌面发行。',
            '可扩展插件机制。',
            '团队协作与共享运行场景。',
          ],
        },
      ],
    },
    community: {
      title: '与社区共建',
      description: '关注版本更新、参与讨论，并与维护者共同迭代工作流实践。',
      links: [
        { label: 'GitHub 仓库', href: GITHUB_URL },
        { label: 'Discussions', href: 'https://github.com/cofy-x/deck/discussions' },
        { label: 'Issues', href: 'https://github.com/cofy-x/deck/issues' },
      ],
    },
    footer: 'Deck 采用 Apache-2.0 开源协议。',
  },
};
