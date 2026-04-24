use crate::models::{AppOpenPathsPayload, WorkspaceChangedPayload};
use tauri::{AppHandle, Emitter, Runtime, WebviewWindow};

pub const MENU_EVENT: &str = "menu-event";
pub const WINDOW_CLOSE_REQUESTED_EVENT: &str = "window-close-requested";
pub const APP_OPEN_PATHS_EVENT: &str = "app-open-paths";
pub const WORKSPACE_CHANGED_EVENT: &str = "workspace-changed";

pub fn emit_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: String) {
    let _ = app.emit(MENU_EVENT, menu_id);
}

pub fn emit_window_close_requested<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.emit(WINDOW_CLOSE_REQUESTED_EVENT, ());
}

pub fn emit_app_open_paths<R: Runtime>(app: &AppHandle<R>, payload: AppOpenPathsPayload) {
    let _ = app.emit(APP_OPEN_PATHS_EVENT, payload);
}

pub fn emit_workspace_changed<R: Runtime>(app: &AppHandle<R>, payload: WorkspaceChangedPayload) {
    let _ = app.emit(WORKSPACE_CHANGED_EVENT, payload);
}
