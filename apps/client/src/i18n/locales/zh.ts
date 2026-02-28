/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export const zh: Record<string, string> = {
  // ---------------------------------------------------------------------------
  // Common
  // ---------------------------------------------------------------------------
  'common.save': '保存',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.clear': '清除',
  'common.submit': '提交',
  'common.create': '创建',
  'common.retry': '重试',
  'common.send': '发送',
  'common.stop': '停止',
  'common.refresh': '刷新',
  'common.connect': '连接',
  'common.disconnect': '断开',
  'common.delete': '删除',
  'common.remote': '远程',
  'common.local': '本地',
  'common.error': '错误',
  'common.loading': '加载中...',
  'common.copied': '已复制',
  'common.copy_path': '复制路径',
  'common.settings': '设置',
  'common.free': '免费',
  'common.custom': '自定义',
  'common.paused': '已暂停',

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  'layout.open_project': '打开项目',
  'layout.no_project': '未选择项目',
  'layout.detecting_project': '正在识别项目...',
  'layout.detecting_project_hint': '沙盒已运行，正在识别工作目录...',
  'layout.project_path_copied': '项目路径已复制',
  'layout.project_path_copy_failed': '复制项目路径失败',
  'layout.switch_connection': '切换连接配置',
  'layout.connection_profiles': '连接配置',
  'layout.remote_controls': '远程控制',
  'layout.sandbox_controls': '沙盒控制',
  'layout.stop_sandbox': '停止沙盒',
  'layout.start_sandbox': '启动沙盒',
  'layout.disconnect_remote': '断开远程连接',
  'layout.connect_remote': '连接远程',
  'layout.open_settings': '打开设置',
  'layout.sandbox_state_changing': '沙盒状态正在变更...',

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------
  'chat.title': '对话',
  'chat.welcome_title': '欢迎使用 Deck AI',
  'chat.welcome_description': '启动沙盒后即可开始对话。',
  'chat.welcome_connection': '当前连接：{name}',
  'chat.welcome_auth_error_hint': '请先在设置中更新 OpenCode 凭证，再重试连接。',
  'chat.new_session': '新建',
  'chat.archive_session': '归档会话',
  'chat.untitled_session': '未命名会话',
  'chat.placeholder_disabled': '请先启动沙盒以开始对话...',
  'chat.placeholder_active': '输入消息... (@ 提及，/ 命令)',
  'chat.attach_file': '附加文件',
  'chat.file_too_large': '文件过大：{name}（最大 10MB）',
  'chat.total_size_exceeded': '附件总大小超过 50MB',

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  'message.image': '图片',
  'message.file': '文件',
  'message.open_file': '打开文件',
  'message.retry_attempt': '第 {n} 次重试',
  'message.open_attachment_in_viewer': '在查看器中打开附件',
  'message.cannot_retry': '当前无法重试此消息',
  'message.retry_with_model': '使用当前模型重试此消息',
  'message.collapse_child_steps': '折叠所有子步骤',
  'message.expand_child_steps': '展开所有子步骤',
  'message.session_compacted': '会话已压缩',
  'message.session_compacted_auto': '会话已自动压缩',
  'message.files_changed': '{count} 个文件已更改',
  'message.subtask_unavailable': '子任务会话不可用',

  // ---------------------------------------------------------------------------
  // Subtask workflow
  // ---------------------------------------------------------------------------
  'subtask.loading': '加载步骤中...',
  'subtask.no_steps': '没有记录的步骤',
  'subtask.no_visible_steps': '没有可见的步骤',

  // ---------------------------------------------------------------------------
  // Permission dialog
  // ---------------------------------------------------------------------------
  'permission.title': '需要权限',
  'permission.description': 'AI 代理正在请求执行某项操作的权限。',
  'permission.label': '权限：',
  'permission.patterns': '模式：',
  'permission.details': '详情：',
  'permission.reject': '拒绝',
  'permission.allow_once': '允许一次',
  'permission.always_allow': '始终允许',

  // ---------------------------------------------------------------------------
  // Question dialog
  // ---------------------------------------------------------------------------
  'question.default_header': '问题',
  'question.custom_label': '或输入自定义答案：',
  'question.custom_placeholder': '自定义答案...',
  'question.skip': '跳过',

  // ---------------------------------------------------------------------------
  // MCP dialog
  // ---------------------------------------------------------------------------
  'mcp.title': 'MCP 服务器',
  'mcp.description': '启用或禁用模型上下文协议服务器。',
  'mcp.no_servers': '未配置 MCP 服务器。',
  'mcp.status_connected': '已连接',
  'mcp.status_disabled': '已禁用',
  'mcp.status_needs_auth': '需要认证',
  'mcp.status_failed': '失败',

  // ---------------------------------------------------------------------------
  // File picker
  // ---------------------------------------------------------------------------
  'file_picker.title': '搜索文件',
  'file_picker.description': '在项目中搜索文件和目录。',
  'file_picker.placeholder': '输入以搜索文件...',
  'file_picker.empty_prompt': '输入关键词开始搜索。',
  'file_picker.no_results': '未找到文件。',

  // ---------------------------------------------------------------------------
  // Command popover
  // ---------------------------------------------------------------------------
  'command.section_header': '命令',

  // ---------------------------------------------------------------------------
  // Client commands
  // ---------------------------------------------------------------------------
  'command.new': '新建会话',
  'command.desktop': '打开桌面面板',
  'command.open': '搜索文件、命令和会话',
  'command.terminal': '打开终端',
  'command.model': '选择其他模型',
  'command.mcp': '切换 MCP',
  'command.agent': '切换代理',
  'command.opencode': '打开 OpenCode 网页界面',

  // ---------------------------------------------------------------------------
  // Config / Settings
  // ---------------------------------------------------------------------------
  'config.settings_title': '设置',
  'config.settings_description': '配置 AI 代理模型、提供商和常规偏好设置。',
  'config.manage_models': '管理模型',
  'config.manage_models_description':
    '切换模型的可见性。仅已连接提供商的可见模型可在对话模型选择器中使用。',
  'config.no_models_available': '暂无可用模型。请先连接提供商。',
  'config.search_models': '搜索模型...',
  'config.no_models_match': '没有匹配的模型。',
  'config.providers': '提供商',
  'config.connections': '连接',
  'config.general': '通用',
  'config.developer': '开发者',
  'config.snapshot': '快照',
  'config.snapshot_description': '自动保存会话状态快照',
  'config.share': '分享',
  'config.share_description': '会话分享行为',
  'config.share_manual': '手动',
  'config.share_auto': '自动',
  'config.share_disabled': '禁用',
  'config.auto_compaction': '自动压缩',
  'config.auto_compaction_description': '自动压缩较长的会话',
  'config.debug_mode': '调试模式',
  'config.debug_mode_description': '在查看器面板中显示 API 请求/响应日志',
  'config.language': '语言',
  'config.language_description': '界面显示语言',

  // ---------------------------------------------------------------------------
  // Connection manager
  // ---------------------------------------------------------------------------
  'connection.description': '管理多个本地/远程目标并即时切换。',
  'connection.add_remote': '添加远程',
  'connection.credentials_title': '凭证（仅会话期间有效）',
  'connection.credentials_description':
    '凭证仅存储在内存中，应用重启后将被清除。',
  'connection.opencode_username': 'OpenCode 用户名',
  'connection.opencode_password': 'OpenCode 密码',
  'connection.daemon_token': 'Daemon 令牌 (X-Deck-Token)',
  'connection.placeholder_username': 'opencode',
  'connection.placeholder_password': '••••••••',
  'connection.placeholder_optional': '可选',

  // ---------------------------------------------------------------------------
  // Remote connection dialog
  // ---------------------------------------------------------------------------
  'remote_dialog.add_title': '添加远程连接',
  'remote_dialog.edit_title': '编辑远程连接',
  'remote_dialog.description':
    '配置 OpenCode 端点。Daemon/noVNC/Web Terminal 覆盖设置为可选。',
  'remote_dialog.profile_name': '配置名称',
  'remote_dialog.opencode_base_url': 'OpenCode 基础 URL',
  'remote_dialog.daemon_base_url': 'Daemon 基础 URL（可选）',
  'remote_dialog.novnc_url': 'noVNC URL（可选）',
  'remote_dialog.web_terminal_url': 'Web Terminal URL（可选）',
  'remote_dialog.placeholder_name': '我的远程沙盒',
  'remote_dialog.placeholder_opencode':
    'https://sandbox.example.com:4096',
  'remote_dialog.placeholder_daemon':
    'https://sandbox.example.com:2280',
  'remote_dialog.placeholder_novnc':
    'https://sandbox.example.com:6080/vnc.html?autoconnect=true&resize=scale',
  'remote_dialog.placeholder_terminal':
    'https://sandbox.example.com:22222',
  'remote_dialog.invalid_settings': '连接设置无效',

  // ---------------------------------------------------------------------------
  // Provider list
  // ---------------------------------------------------------------------------
  'provider.search': '搜索提供商...',
  'provider.no_providers': '暂无可用提供商',
  'provider.no_match': '没有匹配的提供商。',
  'provider.no_active_models': '没有活跃的模型',

  // ---------------------------------------------------------------------------
  // Provider auth dialog
  // ---------------------------------------------------------------------------
  'provider_auth.title': '连接到 {name}',
  'provider_auth.description': '向 {name} 进行身份验证以使用其模型。',
  'provider_auth.api_key': 'API 密钥',
  'provider_auth.api_key_placeholder': '输入你的 API 密钥...',
  'provider_auth.authorize_oauth': '通过 OAuth 授权',
  'provider_auth.key_has_spaces': 'API 密钥包含空格',
  'provider_auth.key_too_short': 'API 密钥过短',
  'provider_auth.openai_prefix': 'OpenAI 密钥以 "sk-" 开头',
  'provider_auth.env_hint':
    '您也可以通过沙盒中提供商的环境变量设置 API 密钥。',

  // ---------------------------------------------------------------------------
  // Custom provider dialog
  // ---------------------------------------------------------------------------
  'custom_provider.title': '自定义提供商',
  'custom_provider.description': '配置 OpenAI 兼容的提供商。',
  'custom_provider.docs_link': '提供商文档',
  'custom_provider.provider_id': '提供商 ID',
  'custom_provider.provider_id_hint': '使用小写字母、数字、连字符或下划线。',
  'custom_provider.display_name': '显示名称',
  'custom_provider.base_url': '基础 URL',
  'custom_provider.api_key': 'API 密钥',
  'custom_provider.api_key_hint': '可选。如果您通过 Headers 管理认证，可留空。',
  'custom_provider.models': '模型',
  'custom_provider.add_model': '添加模型',
  'custom_provider.headers': 'Headers（可选）',
  'custom_provider.add_header': '添加 Header',
  'custom_provider.placeholder_id': 'myprovider',
  'custom_provider.placeholder_name': 'My AI Provider',
  'custom_provider.placeholder_url': 'https://api.myprovider.com/v1',

  // ---------------------------------------------------------------------------
  // Agent selector
  // ---------------------------------------------------------------------------
  'agent.default_label': '代理',
  'agent.search': '搜索代理...',
  'agent.no_agents': '未找到代理。',

  // ---------------------------------------------------------------------------
  // Model selector
  // ---------------------------------------------------------------------------
  'model.select': '选择模型',
  'model.search': '搜索模型...',
  'model.no_models': '未找到模型。',
  'model.cap_reasoning': '推理',
  'model.cap_attachments': '附件',
  'model.cap_temperature': '温度',
  'model.cap_toolcall': '工具调用',
  'model.manage': '管理模型...',

  // ---------------------------------------------------------------------------
  // Sandbox
  // ---------------------------------------------------------------------------
  'sandbox.status_idle': '未启动',
  'sandbox.status_checking': '检查中...',
  'sandbox.status_connecting': '连接中...',
  'sandbox.status_pulling': '拉取镜像中...',
  'sandbox.status_starting': '启动中...',
  'sandbox.status_running': '运行中',
  'sandbox.status_stopping': '停止中...',
  'sandbox.status_error': '错误',

  'sandbox.brain_idle': '空闲',
  'sandbox.brain_thinking': '思考中',
  'sandbox.brain_executing': '执行中',
  'sandbox.brain_busy': '忙碌',
  'sandbox.brain_retry': '重试中',

  // ---------------------------------------------------------------------------
  // Sandbox view
  // ---------------------------------------------------------------------------
  'sandbox.remote_error': '远程连接错误',
  'sandbox.sandbox_error': '沙盒错误',
  'sandbox.unknown_error': '发生未知错误。',
  'sandbox.retry_connection': '重试连接',
  'sandbox.connecting_remote': '正在连接远程沙盒...',
  'sandbox.connecting_remote_desc': '正在验证远程 OpenCode 服务并准备控制台。',
  'sandbox.building': '正在拉取沙盒镜像...',
  'sandbox.building_desc': '正在下载容器镜像。首次运行可能需要几分钟。',
  'sandbox.cancel_pull': '取消',
  'sandbox.pull_layers': '{done}/{total} 层',
  'sandbox.view_pull_logs': '查看日志',
  'sandbox.pull_log_title': '镜像拉取日志',
  'sandbox.pull_log_waiting': '等待拉取输出...',
  'sandbox.starting_ai': '正在启动 AI 助手...',
  'sandbox.starting_ai_desc': '正在初始化桌面环境和 AI 服务。',
  'sandbox.remote_title': '远程 AI 沙盒',
  'sandbox.local_title': 'AI 桌面沙盒',
  'sandbox.remote_description': '连接到远程 OpenCode + 桌面沙盒服务。',
  'sandbox.local_description':
    '启动安全的 Linux 桌面环境，AI 代理可以在其中浏览网页、编写代码并代替您运行应用程序。',
  'sandbox.start_from_chat_hint':
    '请在左侧 Chat 中点击“启动沙盒”，或使用右上角状态控制。',
  'sandbox.connect_from_chat_hint':
    '请在左侧 Chat 中点击“连接远程”，或使用右上角状态控制。',
  'sandbox.retry_from_chat_hint':
    '请在左侧 Chat 中重试，或使用右上角状态控制。',
  'sandbox.open_log_dir': '打开日志目录',
  'sandbox.start_sandbox': '启动沙盒',
  'sandbox.connect_remote': '连接远程',
  'sandbox.boot_failed': '桌面启动失败',
  'sandbox.boot_error_default': '启动桌面服务时发生错误。',
  'sandbox.services_inactive': '桌面服务未激活',
  'sandbox.services_inactive_desc':
    '此远程沙盒已连接，但桌面服务尚未运行。',
  'sandbox.start_desktop_services': '启动桌面服务',
  'sandbox.iframe_title': 'Deck 桌面',
  'sandbox.reload': '重新加载',

  // ---------------------------------------------------------------------------
  // Sandbox boot stages
  // ---------------------------------------------------------------------------
  'sandbox.boot_daemon_title': '正在连接 Daemon...',
  'sandbox.boot_daemon_desc':
    '等待沙盒 daemon (PID 1) 变为健康状态。',
  'sandbox.boot_computeruse_title': '正在启动桌面服务...',
  'sandbox.boot_computeruse_desc':
    '正在沙盒内初始化 Xvfb、Xfce4、x11vnc 和 noVNC。',
  'sandbox.boot_novnc_title': '正在准备显示...',
  'sandbox.boot_novnc_desc':
    '桌面服务已启动。等待 VNC 显示变为可访问状态。',
  'sandbox.error_daemon': 'Daemon 不可达。请检查端点和令牌设置。',
  'sandbox.error_computeruse':
    '启动桌面服务（computer-use）失败。请检查容器日志。',
  'sandbox.error_novnc':
    '桌面服务已启动但 noVNC 不可达。请尝试刷新。',

  // ---------------------------------------------------------------------------
  // Viewer
  // ---------------------------------------------------------------------------
  'viewer.type_markdown': 'Markdown',
  'viewer.type_code': '代码',
  'viewer.type_diff': '差异',
  'viewer.type_image': '图片',
  'viewer.copy_content': '复制内容',
  'viewer.copy_failed': '复制内容失败',
  'viewer.back_to_desktop': '返回桌面',
  'viewer.close_viewer': '关闭查看器',
  'viewer.idle_hint': '对话产物会显示在这里。',
  'viewer.computer_use_detected_title': '检测到 GUI 操作',
  'viewer.computer_use_detected_desc':
    '工具“{tool}”正在运行。可打开 Desktop 进行观察或干预。',
  'viewer.open_desktop_action': '打开 Desktop',

  // ---------------------------------------------------------------------------
  // Right panel
  // ---------------------------------------------------------------------------
  'panel.desktop': '桌面',
  'panel.viewer': '查看器',
  'panel.log': '日志',
  'panel.opencode': 'OpenCode',
  'panel.terminal': '终端',
  'panel.expand': '展开面板',
  'panel.collapse': '折叠面板',
  'panel.bridge_starting':
    '正在为远程 Basic Auth 启动安全的 OpenCode 网页桥接...',
  'panel.bridge_error': '启动本地 OpenCode 网页桥接失败。',
  'panel.bridge_not_ready': 'OpenCode 网页桥接 URL 尚未就绪。',
  'panel.remote_terminal_unsupported':
    '当前版本不支持远程终端。请使用桌面视图或连接本地沙盒配置。',

  // ---------------------------------------------------------------------------
  // Project picker
  // ---------------------------------------------------------------------------
  'project.title': '打开项目',
  'project.description':
    '从 {root} 搜索，使用方向键移动，按 Tab 键进入子目录。',
  'project.search_placeholder': '搜索目录...',
  'project.no_directories': '未找到目录',

  // ---------------------------------------------------------------------------
  // Server status bar
  // ---------------------------------------------------------------------------
  'status.mcp': 'MCP',
  'status.lsp': 'LSP',
  'status.formatter': '格式化器',
  'status.mcp_servers': 'MCP 服务器',
  'status.no_mcp_servers': '无 MCP 服务器',
  'status.active_count': '{label}：{total} 个中有 {count} 个活跃',

  // ---------------------------------------------------------------------------
  // Log viewer
  // ---------------------------------------------------------------------------
  'log.title': '日志',
  'log.filter.api': 'API',
  'log.filter.sse': 'SSE',
  'log.filter.error': '错误',
  'log.filter.system': '系统',
  'log.pause': '暂停',
  'log.resume': '继续',
  'log.pause_logging': '暂停日志记录',
  'log.resume_logging': '继续日志记录',
  'log.clear': '清除',
  'log.clear_log': '清除日志',
  'log.no_entries': '暂无日志记录。',
  'log.pinned': '已固定',
  'log.live': '实时',
  'log.latest': '最新',
  'log.unpin': '取消固定',
  'log.pin_to_top': '固定到顶部',
  'log.url_label': 'URL：',
  'log.request_body': '请求体：',
  'log.response_body': '响应体：',
  'log.error_label': '错误：',
  'log.copy_url': '复制 URL',
  'log.copy_request': '复制请求体',
  'log.copy_response': '复制响应体',
  'log.copy_error': '复制错误',
  'log.open_in_viewer': '在查看器中打开',

  // ---------------------------------------------------------------------------
  // Relative time
  // ---------------------------------------------------------------------------
  'time.just_now': '刚刚',
  'time.minutes_ago': '{n} 分钟前',
  'time.hours_ago': '{n} 小时前',
  'time.days_ago': '{n} 天前',

  // ---------------------------------------------------------------------------
  // Update check
  // ---------------------------------------------------------------------------
  'update.available_title': '发现新版本',
  'update.available_description':
    '新版本 v{version} 已发布，可前往下载。',
  'update.download': '下载',
  'update.dismiss': '忽略',
  'update.check': '检查更新',
  'update.checking': '检查中...',
  'update.up_to_date': '当前已是最新版本。',
  'update.check_failed': '检查更新失败。',
  'update.current_version': '版本',
  'update.new_version_badge': 'v{version} 可更新',

  // ---------------------------------------------------------------------------
  // About section (settings)
  // ---------------------------------------------------------------------------
  'config.about': '关于',

  // ---------------------------------------------------------------------------
  // Connection store
  // ---------------------------------------------------------------------------
  'store.local_sandbox': '本地沙盒',
};
