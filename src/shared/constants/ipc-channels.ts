// IPC Channel names
export const IPC_CHANNELS = {
  // Terminal channels
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DESTROY: 'terminal:destroy',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_OUTPUT: 'terminal:output',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_LIST: 'terminal:list',
  TERMINAL_INVOKE_CLAUDE: 'terminal:invoke-claude',
  TERMINAL_TITLE_CHANGE: 'terminal:title-change',

  // Project channels
  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SET_ACTIVE: 'project:set-active',
  PROJECT_OPEN_FOLDER: 'project:open-folder',
  PROJECT_CHECK_FOLDER: 'project:check-folder',

  // Git channels
  GIT_STATUS: 'git:status',
  GIT_INIT: 'git:init',
  GIT_ADD_REMOTE: 'git:add-remote',
  GIT_PUSH: 'git:push',

  // GitHub channels
  GITHUB_AUTH_STATUS: 'github:auth-status',
  GITHUB_LOGIN: 'github:login',
  GITHUB_LOGOUT: 'github:logout',
  GITHUB_CREATE_REPO: 'github:create-repo',

  // Session channels
  SESSION_SAVE: 'session:save',
  SESSION_RESTORE: 'session:restore',

  // App channels
  APP_GET_PATH: 'app:get-path',

  // Notification channels
  NOTIFICATION_GET_SETTINGS: 'notification:get-settings',
  NOTIFICATION_SET_SETTINGS: 'notification:set-settings',
  NOTIFICATION_SET_TELEGRAM: 'notification:set-telegram',
  NOTIFICATION_SET_DISCORD: 'notification:set-discord',
  NOTIFICATION_GET_TELEGRAM_STATUS: 'notification:get-telegram-status',
  NOTIFICATION_GET_DISCORD_STATUS: 'notification:get-discord-status',
  NOTIFICATION_TEST_TELEGRAM: 'notification:test-telegram',
  NOTIFICATION_TEST_DISCORD: 'notification:test-discord',
  NOTIFICATION_CLEAR_TELEGRAM: 'notification:clear-telegram',
  NOTIFICATION_CLEAR_DISCORD: 'notification:clear-discord',
  NOTIFICATION_EVENT: 'notification:event',

  // YOLO Mode channels
  YOLO_MODE_GET: 'yolo:get',
  YOLO_MODE_SET: 'yolo:set',

  // Clipboard channels
  CLIPBOARD_SAVE_IMAGE: 'clipboard:save-image'
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
