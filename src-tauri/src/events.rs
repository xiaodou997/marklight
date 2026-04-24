use tauri::{AppHandle, Emitter, Runtime, WebviewWindow};

pub const MENU_EVENT: &str = "menu-event";
pub const WINDOW_CLOSE_REQUESTED_EVENT: &str = "window-close-requested";
pub const STARTUP_FILE_EVENT: &str = "open-startup-file";
pub const FILE_CHANGED_EVENT: &str = "file-changed";
pub const TAURI_OPEN_EVENT: &str = "tauri://open";

#[derive(Clone, serde::Serialize)]
pub struct FileChangePayload {
    pub kind: String,
    pub paths: Vec<String>,
}

pub fn emit_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: String) {
    let _ = app.emit(MENU_EVENT, menu_id);
}

pub fn emit_window_close_requested<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.emit(WINDOW_CLOSE_REQUESTED_EVENT, ());
}

pub fn emit_startup_file<R: Runtime>(app: &AppHandle<R>, path: String) {
    let _ = app.emit(STARTUP_FILE_EVENT, path);
}

pub fn emit_file_changed<R: Runtime>(app: &AppHandle<R>, payload: FileChangePayload) {
    let _ = app.emit(FILE_CHANGED_EVENT, payload);
}

pub fn emit_tauri_open<R: Runtime>(app: &AppHandle<R>, paths: Vec<String>) {
    let _ = app.emit(TAURI_OPEN_EVENT, paths);
}
