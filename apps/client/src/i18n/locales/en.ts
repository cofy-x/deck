/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

export const en: Record<string, string> = {
  // ---------------------------------------------------------------------------
  // Common
  // ---------------------------------------------------------------------------
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.clear': 'Clear',
  'common.submit': 'Submit',
  'common.create': 'Create',
  'common.retry': 'Retry',
  'common.send': 'Send',
  'common.stop': 'Stop',
  'common.refresh': 'Refresh',
  'common.connect': 'Connect',
  'common.disconnect': 'Disconnect',
  'common.delete': 'Delete',
  'common.remote': 'Remote',
  'common.local': 'Local',
  'common.error': 'Error',
  'common.loading': 'Loading...',
  'common.copied': 'Copied',
  'common.copy_path': 'Copy path',
  'common.settings': 'Settings',
  'common.free': 'Free',
  'common.custom': 'Custom',
  'common.paused': 'Paused',

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  'layout.open_project': 'Open Project',
  'layout.no_project': 'No project selected',
  'layout.detecting_project': 'Detecting project...',
  'layout.detecting_project_hint':
    'Sandbox is running. Detecting working directory...',
  'layout.project_path_copied': 'Project path copied',
  'layout.project_path_copy_failed': 'Failed to copy project path',
  'layout.switch_connection': 'Switch connection profile',
  'layout.connection_profiles': 'Connection profiles',
  'layout.remote_controls': 'Remote controls',
  'layout.sandbox_controls': 'Sandbox controls',
  'layout.stop_sandbox': 'Stop sandbox',
  'layout.start_sandbox': 'Start sandbox',
  'layout.disconnect_remote': 'Disconnect remote',
  'layout.connect_remote': 'Connect remote',
  'layout.open_settings': 'Open Settings',
  'layout.sandbox_state_changing': 'Sandbox state is changing...',

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------
  'chat.title': 'Chat',
  'chat.welcome_title': 'Welcome to Deck AI',
  'chat.welcome_description': 'Start the sandbox to begin chatting.',
  'chat.welcome_connection': 'Connection: {name}',
  'chat.welcome_auth_error_hint':
    'Update OpenCode credentials in Settings, then retry the connection.',
  'chat.new_session': 'New',
  'chat.archive_session': 'Archive session',
  'chat.untitled_session': 'Untitled Session',
  'chat.placeholder_disabled': 'Start the sandbox to begin chatting...',
  'chat.placeholder_active':
    'Type a message... (@ for mentions, / for commands)',
  'chat.attach_file': 'Attach file',
  'chat.file_too_large': 'File too large: {name} (max 10MB)',
  'chat.total_size_exceeded': 'Total attachment size exceeds 50MB',

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  'message.image': 'Image',
  'message.file': 'File',
  'message.open_file': 'Open file',
  'message.retry_attempt': 'Retry attempt {n}',
  'message.open_attachment_in_viewer': 'Open attachment in viewer',
  'message.cannot_retry': 'This message cannot be retried right now',
  'message.retry_with_model': 'Retry this message with current model',
  'message.collapse_child_steps': 'Collapse all child steps',
  'message.expand_child_steps': 'Expand all child steps',
  'message.session_compacted': 'Session compacted',
  'message.session_compacted_auto': 'Session compacted (auto)',
  'message.files_changed': '{count} file(s) changed',
  'message.subtask_unavailable': 'Subtask session is unavailable',

  // ---------------------------------------------------------------------------
  // Subtask workflow
  // ---------------------------------------------------------------------------
  'subtask.loading': 'Loading steps...',
  'subtask.no_steps': 'No steps recorded',
  'subtask.no_visible_steps': 'No visible steps',

  // ---------------------------------------------------------------------------
  // Permission dialog
  // ---------------------------------------------------------------------------
  'permission.title': 'Permission Required',
  'permission.description':
    'The AI agent is requesting permission to perform an action.',
  'permission.label': 'Permission:',
  'permission.patterns': 'Patterns:',
  'permission.details': 'Details:',
  'permission.reject': 'Reject',
  'permission.allow_once': 'Allow Once',
  'permission.always_allow': 'Always Allow',

  // ---------------------------------------------------------------------------
  // Question dialog
  // ---------------------------------------------------------------------------
  'question.default_header': 'Question',
  'question.custom_label': 'Or type a custom answer:',
  'question.custom_placeholder': 'Custom answer...',
  'question.skip': 'Skip',

  // ---------------------------------------------------------------------------
  // MCP dialog
  // ---------------------------------------------------------------------------
  'mcp.title': 'MCP Servers',
  'mcp.description': 'Enable or disable Model Context Protocol servers.',
  'mcp.no_servers': 'No MCP servers configured.',
  'mcp.status_connected': 'Connected',
  'mcp.status_disabled': 'Disabled',
  'mcp.status_needs_auth': 'Needs Auth',
  'mcp.status_failed': 'Failed',

  // ---------------------------------------------------------------------------
  // File picker
  // ---------------------------------------------------------------------------
  'file_picker.title': 'Search Files',
  'file_picker.description':
    'Search for files and directories in the project.',
  'file_picker.placeholder': 'Type to search files...',
  'file_picker.empty_prompt': 'Start typing to search files.',
  'file_picker.no_results': 'No files found.',

  // ---------------------------------------------------------------------------
  // Command popover
  // ---------------------------------------------------------------------------
  'command.section_header': 'Commands',

  // ---------------------------------------------------------------------------
  // Client commands
  // ---------------------------------------------------------------------------
  'command.new': 'Start a new session',
  'command.desktop': 'Open desktop panel',
  'command.open': 'Search files, commands, and sessions',
  'command.terminal': 'Open terminal',
  'command.model': 'Select a different model',
  'command.mcp': 'Toggle MCPs',
  'command.agent': 'Switch agent',
  'command.opencode': 'Open the OpenCode web interface',

  // ---------------------------------------------------------------------------
  // Config / Settings
  // ---------------------------------------------------------------------------
  'config.settings_title': 'Settings',
  'config.settings_description':
    'Configure the AI agent model, providers, and general preferences.',
  'config.manage_models': 'Manage Models',
  'config.manage_models_description':
    'Toggle models to show or hide them in the chat model selector. Only visible models from connected providers are available for selection.',
  'config.no_models_available':
    'No models available. Connect a provider first.',
  'config.search_models': 'Search models...',
  'config.no_models_match': 'No models match your search.',
  'config.providers': 'Providers',
  'config.connections': 'Connections',
  'config.general': 'General',
  'config.developer': 'Developer',
  'config.snapshot': 'Snapshot',
  'config.snapshot_description': 'Automatically snapshot session state',
  'config.share': 'Share',
  'config.share_description': 'Session sharing behavior',
  'config.share_manual': 'Manual',
  'config.share_auto': 'Auto',
  'config.share_disabled': 'Disabled',
  'config.auto_compaction': 'Auto Compaction',
  'config.auto_compaction_description': 'Automatically compact long sessions',
  'config.debug_mode': 'Debug Mode',
  'config.debug_mode_description':
    'Show API request/response log in the Viewer panel',
  'config.language': 'Language',
  'config.language_description': 'UI display language',

  // ---------------------------------------------------------------------------
  // Connection manager
  // ---------------------------------------------------------------------------
  'connection.description':
    'Keep multiple local/remote targets and switch instantly.',
  'connection.add_remote': 'Add Remote',
  'connection.credentials_title': 'Credentials (Session Only)',
  'connection.credentials_description':
    'Credentials are stored in memory only and cleared after app restart.',
  'connection.opencode_username': 'OpenCode Username',
  'connection.opencode_password': 'OpenCode Password',
  'connection.daemon_token': 'Daemon Token (X-Deck-Token)',
  'connection.placeholder_username': 'opencode',
  'connection.placeholder_password': '••••••••',
  'connection.placeholder_optional': 'Optional',

  // ---------------------------------------------------------------------------
  // Remote connection dialog
  // ---------------------------------------------------------------------------
  'remote_dialog.add_title': 'Add Remote Connection',
  'remote_dialog.edit_title': 'Edit Remote Connection',
  'remote_dialog.description':
    'Configure the OpenCode endpoint. Daemon/noVNC/Web Terminal overrides are optional.',
  'remote_dialog.profile_name': 'Profile Name',
  'remote_dialog.opencode_base_url': 'OpenCode Base URL',
  'remote_dialog.daemon_base_url': 'Daemon Base URL (optional)',
  'remote_dialog.novnc_url': 'noVNC URL (optional)',
  'remote_dialog.web_terminal_url': 'Web Terminal URL (optional)',
  'remote_dialog.placeholder_name': 'My Remote Sandbox',
  'remote_dialog.placeholder_opencode':
    'https://sandbox.example.com:4096',
  'remote_dialog.placeholder_daemon':
    'https://sandbox.example.com:2280',
  'remote_dialog.placeholder_novnc':
    'https://sandbox.example.com:6080/vnc.html?autoconnect=true&resize=scale',
  'remote_dialog.placeholder_terminal':
    'https://sandbox.example.com:22222',
  'remote_dialog.invalid_settings': 'Invalid connection settings',

  // ---------------------------------------------------------------------------
  // Provider list
  // ---------------------------------------------------------------------------
  'provider.search': 'Search providers...',
  'provider.no_providers': 'No providers available',
  'provider.no_match': 'No providers match your search.',
  'provider.no_active_models': 'No active models',

  // ---------------------------------------------------------------------------
  // Provider auth dialog
  // ---------------------------------------------------------------------------
  'provider_auth.title': 'Connect to {name}',
  'provider_auth.description':
    'Authenticate with {name} to use its models.',
  'provider_auth.api_key': 'API Key',
  'provider_auth.api_key_placeholder': 'Enter your API key...',
  'provider_auth.authorize_oauth': 'Authorize with OAuth',
  'provider_auth.key_has_spaces': 'API key contains spaces',
  'provider_auth.key_too_short': 'API key too short',
  'provider_auth.openai_prefix': 'OpenAI keys start with "sk-"',
  'provider_auth.env_hint':
    "You can also set the API key via the provider's environment variable in the sandbox.",

  // ---------------------------------------------------------------------------
  // Custom provider dialog
  // ---------------------------------------------------------------------------
  'custom_provider.title': 'Custom Provider',
  'custom_provider.description': 'Configure an OpenAI-compatible provider.',
  'custom_provider.docs_link': 'Provider docs',
  'custom_provider.provider_id': 'Provider ID',
  'custom_provider.provider_id_hint':
    'Use lowercase letters, numbers, hyphens or underscores.',
  'custom_provider.display_name': 'Display Name',
  'custom_provider.base_url': 'Base URL',
  'custom_provider.api_key': 'API Key',
  'custom_provider.api_key_hint':
    'Optional. Leave empty if you manage auth via headers.',
  'custom_provider.models': 'Models',
  'custom_provider.add_model': 'Add model',
  'custom_provider.headers': 'Headers (optional)',
  'custom_provider.add_header': 'Add header',
  'custom_provider.placeholder_id': 'myprovider',
  'custom_provider.placeholder_name': 'My AI Provider',
  'custom_provider.placeholder_url': 'https://api.myprovider.com/v1',

  // ---------------------------------------------------------------------------
  // Agent selector
  // ---------------------------------------------------------------------------
  'agent.default_label': 'Agent',
  'agent.search': 'Search agents...',
  'agent.no_agents': 'No agents found.',

  // ---------------------------------------------------------------------------
  // Model selector
  // ---------------------------------------------------------------------------
  'model.select': 'Select model',
  'model.search': 'Search models...',
  'model.no_models': 'No models found.',
  'model.cap_reasoning': 'Reasoning',
  'model.cap_attachments': 'Attachments',
  'model.cap_temperature': 'Temperature',
  'model.cap_toolcall': 'Tool calls',
  'model.manage': 'Manage models...',

  // ---------------------------------------------------------------------------
  // Sandbox
  // ---------------------------------------------------------------------------
  'sandbox.status_idle': 'Not Started',
  'sandbox.status_checking': 'Checking...',
  'sandbox.status_connecting': 'Connecting...',
  'sandbox.status_pulling': 'Pulling Image...',
  'sandbox.status_starting': 'Starting...',
  'sandbox.status_running': 'Running',
  'sandbox.status_stopping': 'Stopping...',
  'sandbox.status_error': 'Error',

  'sandbox.brain_idle': 'Idle',
  'sandbox.brain_thinking': 'Thinking',
  'sandbox.brain_executing': 'Executing',
  'sandbox.brain_busy': 'Busy',
  'sandbox.brain_retry': 'Retrying',

  // ---------------------------------------------------------------------------
  // Sandbox view
  // ---------------------------------------------------------------------------
  'sandbox.remote_error': 'Remote Connection Error',
  'sandbox.sandbox_error': 'Sandbox Error',
  'sandbox.unknown_error': 'An unknown error occurred.',
  'sandbox.retry_connection': 'Retry Connection',
  'sandbox.connecting_remote': 'Connecting Remote Sandbox...',
  'sandbox.connecting_remote_desc':
    'Verifying the remote OpenCode service and preparing the cockpit.',
  'sandbox.building': 'Pulling Sandbox Image...',
  'sandbox.building_desc':
    'Downloading the container image. This may take a few minutes on first run.',
  'sandbox.cancel_pull': 'Cancel',
  'sandbox.pull_layers': '{done}/{total} layers',
  'sandbox.view_pull_logs': 'View Logs',
  'sandbox.pull_log_title': 'Image Pull Log',
  'sandbox.pull_log_waiting': 'Waiting for pull output...',
  'sandbox.starting_ai': 'Starting AI Assistant...',
  'sandbox.starting_ai_desc':
    'Initializing the desktop environment and AI services.',
  'sandbox.remote_title': 'Remote AI Sandbox',
  'sandbox.local_title': 'AI Desktop Sandbox',
  'sandbox.remote_description':
    'Connect to a remote OpenCode + desktop sandbox service.',
  'sandbox.local_description':
    'Launch a secure Linux desktop environment where the AI agent can browse the web, write code, and run applications on your behalf.',
  'sandbox.start_from_chat_hint':
    'Use Start Sandbox in Chat (left), or use the status control in the top-right.',
  'sandbox.connect_from_chat_hint':
    'Use Connect Remote in Chat (left), or use the status control in the top-right.',
  'sandbox.retry_from_chat_hint':
    'Retry from Chat (left), or use the status control in the top-right.',
  'sandbox.open_log_dir': 'Open Log Directory',
  'sandbox.start_sandbox': 'Start Sandbox',
  'sandbox.connect_remote': 'Connect Remote',
  'sandbox.boot_failed': 'Desktop Boot Failed',
  'sandbox.boot_error_default':
    'An error occurred while starting desktop services.',
  'sandbox.services_inactive': 'Desktop Services Inactive',
  'sandbox.services_inactive_desc':
    'This remote sandbox is connected, but desktop services are not running yet.',
  'sandbox.start_desktop_services': 'Start Desktop Services',
  'sandbox.iframe_title': 'Deck Desktop',
  'sandbox.reload': 'Reload',

  // ---------------------------------------------------------------------------
  // Sandbox boot stages
  // ---------------------------------------------------------------------------
  'sandbox.boot_daemon_title': 'Connecting to Daemon...',
  'sandbox.boot_daemon_desc':
    'Waiting for the sandbox daemon (PID 1) to become healthy.',
  'sandbox.boot_computeruse_title': 'Starting Desktop Services...',
  'sandbox.boot_computeruse_desc':
    'Initializing Xvfb, Xfce4, x11vnc, and noVNC inside the sandbox.',
  'sandbox.boot_novnc_title': 'Preparing Display...',
  'sandbox.boot_novnc_desc':
    'Desktop services started. Waiting for the VNC display to become accessible.',
  'sandbox.error_daemon':
    'Daemon is not reachable. Check endpoint and token settings.',
  'sandbox.error_computeruse':
    'Failed to start desktop services (computer-use). Check container logs.',
  'sandbox.error_novnc':
    'Desktop services started but noVNC is not reachable. Try refreshing.',

  // ---------------------------------------------------------------------------
  // Viewer
  // ---------------------------------------------------------------------------
  'viewer.type_markdown': 'Markdown',
  'viewer.type_code': 'Code',
  'viewer.type_diff': 'Diff',
  'viewer.type_image': 'Image',
  'viewer.copy_content': 'Copy content',
  'viewer.copy_failed': 'Failed to copy content',
  'viewer.back_to_desktop': 'Back to Desktop',
  'viewer.close_viewer': 'Close viewer',
  'viewer.idle_hint': 'Conversation outputs appear here.',
  'viewer.computer_use_detected_title': 'GUI operation detected',
  'viewer.computer_use_detected_desc':
    'Tool "{tool}" is running. Open Desktop to observe or intervene.',
  'viewer.open_desktop_action': 'Open Desktop',

  // ---------------------------------------------------------------------------
  // Right panel
  // ---------------------------------------------------------------------------
  'panel.desktop': 'Desktop',
  'panel.viewer': 'Viewer',
  'panel.log': 'Log',
  'panel.opencode': 'OpenCode',
  'panel.terminal': 'Terminal',
  'panel.expand': 'Expand panel',
  'panel.collapse': 'Collapse panel',
  'panel.bridge_starting':
    'Starting secure OpenCode web bridge for remote Basic Auth...',
  'panel.bridge_error':
    'Failed to start the local OpenCode web bridge.',
  'panel.bridge_not_ready': 'OpenCode web bridge URL is not ready yet.',
  'panel.remote_terminal_unsupported':
    'Remote terminal is not supported in this release. Use the Desktop view or connect with a local sandbox profile.',

  // ---------------------------------------------------------------------------
  // Project picker
  // ---------------------------------------------------------------------------
  'project.title': 'Open Project',
  'project.description':
    'Search from {root}, use Arrow keys to move, then press Tab to drill into child directories.',
  'project.search_placeholder': 'Search directories...',
  'project.no_directories': 'No directories found',

  // ---------------------------------------------------------------------------
  // Server status bar
  // ---------------------------------------------------------------------------
  'status.mcp': 'MCP',
  'status.lsp': 'LSP',
  'status.formatter': 'Formatter',
  'status.mcp_servers': 'MCP Servers',
  'status.no_mcp_servers': 'No MCP servers',
  'status.active_count': '{label}: {count} of {total} active',

  // ---------------------------------------------------------------------------
  // Log viewer
  // ---------------------------------------------------------------------------
  'log.title': 'API Log',
  'log.pause': 'Pause',
  'log.resume': 'Resume',
  'log.pause_logging': 'Pause logging',
  'log.resume_logging': 'Resume logging',
  'log.clear': 'Clear',
  'log.clear_log': 'Clear log',
  'log.no_entries': 'No API requests logged yet.',
  'log.pinned': 'Pinned',
  'log.live': 'Live',
  'log.latest': 'Latest',
  'log.unpin': 'Unpin',
  'log.pin_to_top': 'Pin to top',
  'log.url_label': 'URL:',
  'log.request_body': 'Request Body:',
  'log.response_body': 'Response Body:',
  'log.error_label': 'Error:',
  'log.copy_url': 'Copy URL',
  'log.copy_request': 'Copy request body',
  'log.copy_response': 'Copy response body',
  'log.copy_error': 'Copy error',
  'log.open_in_viewer': 'Open in Viewer',

  // ---------------------------------------------------------------------------
  // Relative time
  // ---------------------------------------------------------------------------
  'time.just_now': 'just now',
  'time.minutes_ago': '{n}m ago',
  'time.hours_ago': '{n}h ago',
  'time.days_ago': '{n}d ago',

  // ---------------------------------------------------------------------------
  // Update check
  // ---------------------------------------------------------------------------
  'update.available_title': 'Update Available',
  'update.available_description':
    'New version v{version} is ready to download.',
  'update.download': 'Download',
  'update.dismiss': 'Dismiss',
  'update.check': 'Check for updates',
  'update.checking': 'Checking...',
  'update.up_to_date': 'You are on the latest version.',
  'update.check_failed': 'Failed to check for updates.',
  'update.current_version': 'Version',
  'update.new_version_badge': 'v{version} available',

  // ---------------------------------------------------------------------------
  // About section (settings)
  // ---------------------------------------------------------------------------
  'config.about': 'About',

  // ---------------------------------------------------------------------------
  // Connection store
  // ---------------------------------------------------------------------------
  'store.local_sandbox': 'Local Sandbox',
};
