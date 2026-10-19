export const WORKSPACE_MARKER = '__BLOOP_RELEASE_WORKSPACE__';

/** Preserve JavaScript string escaping when a portable bundle moves to another directory. */
export function workspaceTemplate(text, originalPath) {
  return text.replaceAll(JSON.stringify(originalPath), JSON.stringify(WORKSPACE_MARKER));
}
export function bindWorkspace(template, workspace) {
  return template.replaceAll(JSON.stringify(WORKSPACE_MARKER), JSON.stringify(workspace));
}
