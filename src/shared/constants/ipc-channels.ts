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
  TERMINAL_STATE_CHANGE: 'terminal:state-change',
  TERMINAL_DETECT_WSL: 'terminal:detect-wsl',

  // Project channels
  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_SET_ACTIVE: 'project:set-active',
  PROJECT_OPEN_FOLDER: 'project:open-folder',
  PROJECT_CHECK_FOLDER: 'project:check-folder',

  // Git channels
  GIT_STATUS: 'git:status',
  GIT_INIT: 'git:init',
  GIT_ADD_REMOTE: 'git:add-remote',
  GIT_PUSH: 'git:push',
  // Git commit workflow channels
  GIT_FILE_STATUS: 'git:file-status',
  GIT_STAGE_FILE: 'git:stage-file',
  GIT_UNSTAGE_FILE: 'git:unstage-file',
  GIT_STAGE_ALL: 'git:stage-all',
  GIT_COMMIT: 'git:commit',
  GIT_DIFF: 'git:diff',
  GIT_DISCARD: 'git:discard',
  // Git branch change event (from terminal detection or file watcher)
  GIT_BRANCH_CHANGED: 'git:branch-changed',
  // Git HEAD watcher for external terminal changes
  GIT_WATCH_PROJECT: 'git:watch-project',
  GIT_UNWATCH_PROJECT: 'git:unwatch-project',
  // Git extended operations
  GIT_PULL: 'git:pull',
  GIT_FETCH: 'git:fetch',
  GIT_BRANCHES: 'git:branches',
  GIT_CREATE_BRANCH: 'git:create-branch',
  GIT_CHECKOUT_BRANCH: 'git:checkout-branch',
  GIT_DELETE_BRANCH: 'git:delete-branch',
  GIT_MERGE: 'git:merge',
  GIT_LOG: 'git:log',
  GIT_STASH_LIST: 'git:stash-list',
  GIT_STASH_SAVE: 'git:stash-save',
  GIT_STASH_APPLY: 'git:stash-apply',
  GIT_STASH_POP: 'git:stash-pop',
  GIT_STASH_DROP: 'git:stash-drop',
  GIT_CONFIG_GET: 'git:config-get',
  GIT_CONFIG_SET: 'git:config-set',
  GIT_DIFF_BRANCH: 'git:diff-branch',
  GIT_DIFF_AGAINST_BRANCH: 'git:diff-against-branch',

  // GitHub channels
  GITHUB_AUTH_STATUS: 'github:auth-status',
  GITHUB_LOGIN: 'github:login',
  GITHUB_LOGOUT: 'github:logout',
  GITHUB_CREATE_REPO: 'github:create-repo',
  GITHUB_ISSUES_LIST: 'github:issues-list',
  GITHUB_PRS_LIST: 'github:prs-list',

  // Session channels
  SESSION_SAVE: 'session:save',
  SESSION_RESTORE: 'session:restore',

  // App channels
  APP_GET_PATH: 'app:get-path',
  APP_CHECK_FOR_UPDATES: 'app:check-for-updates',
  APP_OPEN_EXTERNAL: 'app:open-external',

  // Notification channels
  NOTIFICATION_GET_SETTINGS: 'notification:get-settings',
  NOTIFICATION_SET_SETTINGS: 'notification:set-settings',
  NOTIFICATION_SET_TELEGRAM: 'notification:set-telegram',
  NOTIFICATION_SET_DISCORD: 'notification:set-discord',
  NOTIFICATION_GET_TELEGRAM: 'notification:get-telegram',
  NOTIFICATION_GET_TELEGRAM_STATUS: 'notification:get-telegram-status',
  NOTIFICATION_GET_DISCORD_STATUS: 'notification:get-discord-status',
  NOTIFICATION_TEST_TELEGRAM: 'notification:test-telegram',
  NOTIFICATION_TEST_DISCORD: 'notification:test-discord',
  NOTIFICATION_CLEAR_TELEGRAM: 'notification:clear-telegram',
  NOTIFICATION_CLEAR_DISCORD: 'notification:clear-discord',
  NOTIFICATION_EVENT: 'notification:event',
  NOTIFICATION_SET_ACTIVE_TERMINAL: 'notification:set-active-terminal',
  NOTIFICATION_REMOTE_CONTROL_STATUS: 'notification:remote-control-status',

  // YOLO Mode channels
  YOLO_MODE_GET: 'yolo:get',
  YOLO_MODE_SET: 'yolo:set',

  // Clipboard channels
  CLIPBOARD_SAVE_IMAGE: 'clipboard:save-image',

  // Image channels
  IMAGE_OPEN: 'image:open',
  IMAGE_DELETE: 'image:delete',
  IMAGE_READ_BASE64: 'image:read-base64',
  IMAGE_LIST_SCREENSHOTS: 'image:list-screenshots',

  // File picker channels
  FILE_PICKER_OPEN: 'file-picker:open',

  // Update channels
  UPDATE_GET_STATE: 'update:get-state',
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS_CHANGED: 'update:status-changed',

  // Settings channels
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',
  // Vietnamese IME channels
  VIETNAMESE_IME_PATCH: 'vietnamese-ime:patch',
  VIETNAMESE_IME_STATUS: 'vietnamese-ime:status',

  // Windows channels
  WINDOW_GET_STATE: 'window:get-state',
  WINDOW_STATE_CHANGED: 'window:state-changed',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close'
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
