use notify::{RecursiveMode, RecommendedWatcher, Watcher};
use std::path::Path;

/// 监听指定目录
#[tauri::command]
pub fn watch_directory(
    state: tauri::State<std::sync::Mutex<RecommendedWatcher>>,
    path: String,
) -> Result<(), String> {
    let mut watcher = state.lock().map_err(|e| e.to_string())?;
    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 取消监听指定目录
#[tauri::command]
pub fn unwatch_directory(
    state: tauri::State<std::sync::Mutex<RecommendedWatcher>>,
    path: String,
) -> Result<(), String> {
    let mut watcher = state.lock().map_err(|e| e.to_string())?;
    watcher
        .unwatch(Path::new(&path))
        .map_err(|e| e.to_string())?;
    Ok(())
}
