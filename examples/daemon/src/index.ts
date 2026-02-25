/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  DaemonClient,
  GitCommitRequest,
  GitAddRequest,
  GitCloneRequest,
  GitCheckoutRequest,
  GitBranchRequest,
  GitRepoRequest,
  MouseClickRequest,
  MouseMoveRequest,
  MouseDragRequest,
  MouseScrollRequest,
  KeyboardTypeRequest,
  KeyboardPressRequest,
  KeyboardHotkeyRequest,
  BrowserOpenRequest,
  ExecuteRequest,
  CreateSessionRequest,
  SessionExecuteRequest,
  ReplaceRequest,
} from '@cofy-x/client-daemon';

const daemonUrl = process.env.DECK_DAEMON_URL || 'http://localhost:2280';

const client = new DaemonClient({ BASE: daemonUrl });

export async function get_version() {
  return await client.info.getVersion();
}

export async function get_work_dir() {
  return await client.info.getWorkDir();
}

export async function get_home_dir() {
  return await client.info.getUserHomeDir();
}

export async function get_ports() {
  return await client.port.getPorts();
}

export async function execute_command(
  command: string,
  cwd?: string,
  timeout?: number,
) {
  const request: ExecuteRequest = { command, cwd, timeout };
  return await client.process.executeCommand(request);
}

export async function create_session(sessionId: string) {
  const request: CreateSessionRequest = { sessionId: sessionId };
  return await client.process.createSession(request);
}

export async function session_execute(
  sessionId: string,
  command: string,
  async?: boolean,
) {
  const request: SessionExecuteRequest = { command, async };
  return await client.process.sessionExecuteCommand(sessionId, request);
}

export async function get_session_command_logs(
  sessionId: string,
  commandId: string,
) {
  return await client.process.getSessionCommandLogs(sessionId, commandId);
}

export async function list_sessions() {
  return await client.process.listSessions();
}

export async function delete_session(sessionId: string) {
  return await client.process.deleteSession(sessionId);
}

export async function list_files(path?: string) {
  return await client.fileSystem.listFiles(path);
}

export async function file_info(path: string) {
  return await client.fileSystem.getFileInfo(path);
}

export async function create_folder(path: string, mode?: string) {
  return await client.fileSystem.createFolder(path, mode || '0755');
}

export async function download_file(path: string): Promise<string> {
  const blob = await client.fileSystem.downloadFile(path);
  return await blob.text();
}

export async function upload_file(path: string, content: string) {
  const blob = new Blob([content]);
  return await client.fileSystem.uploadFile(path, blob);
}

export async function delete_file(path: string, recursive?: boolean) {
  return await client.fileSystem.deleteFile(path, recursive);
}

export async function move_file(source: string, destination: string) {
  return await client.fileSystem.moveFile(source, destination);
}

export async function search_files(path: string, pattern: string) {
  return await client.fileSystem.searchFiles(path, pattern);
}

export async function find_in_files(path: string, pattern: string) {
  return await client.fileSystem.findInFiles(path, pattern);
}

export async function replace_in_files(
  pattern: string,
  newValue: string,
  files: string[],
) {
  const request: ReplaceRequest = { pattern, newValue: newValue, files };
  return await client.fileSystem.replaceInFiles(request);
}

export async function git_clone(
  url: string,
  path: string,
  branch?: string,
  username?: string,
  password?: string,
) {
  const request: GitCloneRequest = { url, path, branch, username, password };
  return await client.git.cloneRepository(request);
}

export async function git_status(path: string) {
  return await client.git.getStatus(path);
}

export async function git_add(path: string, files: string[]) {
  const request: GitAddRequest = { path, files };
  return await client.git.addFiles(request);
}

export async function git_commit(
  path: string,
  message: string,
  author: string,
  email: string,
  allow_empty?: boolean,
) {
  const request: GitCommitRequest = {
    path,
    message,
    author,
    email,
    allow_empty,
  };
  return await client.git.commitChanges(request);
}

export async function git_branches(path: string) {
  return await client.git.listBranches(path);
}

export async function git_checkout(path: string, branch: string) {
  const request: GitCheckoutRequest = { path, branch };
  return await client.git.checkoutBranch(request);
}

export async function git_create_branch(path: string, name: string) {
  const request: GitBranchRequest = { path, name };
  return await client.git.createBranch(request);
}

export async function git_pull(
  path: string,
  username?: string,
  password?: string,
) {
  const request: GitRepoRequest = { path, username, password };
  return await client.git.pullChanges(request);
}

export async function git_push(
  path: string,
  username?: string,
  password?: string,
) {
  const request: GitRepoRequest = { path, username, password };
  return await client.git.pushChanges(request);
}

export async function screenshot(
  format?: 'png' | 'jpeg',
  quality?: number,
  scale?: number,
  showCursor?: boolean,
) {
  return await client.computerUse.takeCompressedScreenshot(
    showCursor,
    format,
    quality,
    scale,
  );
}

export async function mouse_click(
  x: number,
  y: number,
  button?: 'left' | 'right' | 'middle',
  double?: boolean,
) {
  const request: MouseClickRequest = { x, y, button, double };
  return await client.computerUse.click(request);
}

export async function mouse_move(x: number, y: number) {
  const request: MouseMoveRequest = { x, y };
  return await client.computerUse.moveMouse(request);
}

export async function mouse_drag(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  button?: 'left' | 'right' | 'middle',
) {
  const request: MouseDragRequest = { startX, startY, endX, endY, button };
  return await client.computerUse.drag(request);
}

export async function mouse_scroll(
  x: number,
  y: number,
  direction: 'up' | 'down',
  amount?: number,
) {
  const request: MouseScrollRequest = { x, y, direction, amount };
  return await client.computerUse.scroll(request);
}

export async function keyboard_type(text: string, delay?: number) {
  const request: KeyboardTypeRequest = { text, delay };
  return await client.computerUse.typeText(request);
}

export async function keyboard_press(key: string, modifiers?: string[]) {
  const request: KeyboardPressRequest = { key, modifiers };
  return await client.computerUse.pressKey(request);
}

export async function keyboard_hotkey(keys: string) {
  const request: KeyboardHotkeyRequest = { keys };
  return await client.computerUse.pressHotkey(request);
}

export async function open_browser(url: string, incognito?: boolean) {
  const request: BrowserOpenRequest = { url, incognito };
  return await client.computerUse.openBrowser(request);
}

export async function get_display_info() {
  return await client.computerUse.getDisplayInfo();
}

export async function get_windows() {
  return await client.computerUse.getWindows();
}
