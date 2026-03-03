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
        'Deck gives you a closed-loop workflow: run AI tasks in secure local sandboxes, observe live desktop execution, then hand off instantly to Editor, OpenCode, or Terminal.',
      actions: [
        { label: 'Download', href: RELEASES_URL, variant: 'primary' },
        { label: 'GitHub', href: GITHUB_URL, variant: 'secondary' },
        { label: 'Docs', href: DOCS_URL, variant: 'secondary' },
      ],
      trustChips: [
        'Secure local sandboxes',
        'Live execution visibility',
        'One-click handoff (Editor/OpenCode/Terminal)',
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
          title: 'One-click workspace handoff',
          description:
            'Continue from observation to action by opening the same workspace in Editor (VS Code/Cursor), OpenCode, or Terminal directly from the top bar.',
        },
        {
          icon: 'bridge',
          title: 'Local/remote profile orchestration',
          description:
            'Manage multiple connection profiles and switch between local and remote targets without changing your operating flow.',
        },
      ],
    },
    architecture: {
      title: 'Architecture at a glance',
      description:
        'Deck keeps orchestration local by default while still supporting optional multi-channel automation extensions.',
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
          title: 'Pilot Automation Suite (Optional)',
          description:
            'Host, server, and bridge components extend cockpit workflows to multi-channel and headless orchestration when needed, and currently run as an optional ecosystem suite.',
        },
      ],
    },
    quickStart: {
      title: 'Quick start',
      description:
        'Get a running sandbox in minutes. This mirrors the primary setup flow from the repository README.',
      steps: [
        {
          title: 'Install the desktop app',
          command:
            'Download the macOS DMG from GitHub Releases, open it, and drag deck.app to /Applications.',
          note:
            'Desktop downloads are currently macOS. Windows and Linux builds are on the roadmap.',
        },
        {
          title: 'Start your first sandbox',
          command:
            'Open Deck, choose the Local profile, click "Start Sandbox", then select your working directory from "Open Project". After startup, continue from the top bar with Editor, OpenCode, or Terminal.',
          note:
            'Editor (VS Code/Cursor) and Terminal are available for Local Sandbox. OpenCode is available for any running connection (Local/Remote).',
        },
      ],
    },
    roadmap: {
      title: 'Roadmap highlights',
      description:
        'Current focus is stable local operations, then stronger cockpit-to-Pilot workflow continuity for v0.1.',
      groups: [
        {
          title: 'Now',
          items: [
            'Stable desktop cockpit for local and remote workflows.',
            'Handoff continuity polish across Desktop, Editor, OpenCode, and Terminal.',
            'Session reliability and sandbox startup improvements.',
            'Faster sandbox image boot and runtime diagnostics.',
          ],
        },
        {
          title: 'Next',
          items: [
            'Cockpit-to-Pilot workflow continuity improvements.',
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
        'Deck 提供闭环工作流：在安全本地沙箱运行 AI 任务、实时观察桌面执行，再从顶部栏一键接力到编辑器、OpenCode 或终端。',
      actions: [
        { label: '下载', href: RELEASES_URL, variant: 'primary' },
        { label: 'GitHub', href: GITHUB_URL, variant: 'secondary' },
        { label: '文档', href: DOCS_URL, variant: 'secondary' },
      ],
      trustChips: ['安全本地沙箱', '实时执行可观测', '一键接力（编辑器/OpenCode/终端）'],
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
          title: '一键工作区接力',
          description:
            '可从顶部栏在同一工作区进入编辑器（VS Code/Cursor）、OpenCode 或终端，从观察无缝切到操作。',
        },
        {
          icon: 'bridge',
          title: '本地/远程配置编排',
          description:
            '管理多个连接配置，在本地与远程目标间快速切换，并保持一致操作流程。',
        },
      ],
    },
    architecture: {
      title: '架构总览',
      description: 'Deck 默认本地编排，同时支持按需扩展到可选的多渠道自动化能力。',
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
          title: 'Pilot 自动化套件（可选）',
          description:
            '通过 host / server / bridge 组件在需要时扩展驾驶舱工作流，承接多渠道与无头编排，当前以可选生态套件方式运行。',
        },
      ],
    },
    quickStart: {
      title: '快速开始',
      description: '几分钟内启动第一个沙箱，流程与仓库 README 保持一致。',
      steps: [
        {
          title: '安装桌面应用',
          command:
            '从 GitHub Releases 下载 macOS DMG，打开后将 deck.app 拖入 /Applications。',
          note: '当前桌面安装包为 macOS，Windows 与 Linux 版本已在路线图中。',
        },
        {
          title: '启动第一个沙箱',
          command:
            '打开 Deck，选择内置 Local 配置，点击 “Start Sandbox”，并通过 “Open Project” 选择工作目录。启动后可从顶部栏进入编辑器、OpenCode 或终端。',
          note:
            '编辑器（VS Code/Cursor）与终端仅在本地沙箱可用；OpenCode 在任意运行中的连接可用（本地/远程）。',
        },
      ],
    },
    roadmap: {
      title: '路线图重点',
      description: '当前聚焦本地运行稳定性，随后推进驾驶舱与 Pilot 的流程连续性。',
      groups: [
        {
          title: '当前',
          items: [
            '稳定的本地与远程沙箱工作流。',
            '持续优化桌面、编辑器、OpenCode 与终端之间的接力连续性。',
            '会话控制与启动可靠性持续优化。',
            '镜像启动速度与运行诊断能力增强。',
          ],
        },
        {
          title: '下一步',
          items: [
            '增强驾驶舱到 Pilot 的流程连续性。',
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
