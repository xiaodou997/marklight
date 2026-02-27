use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu, CheckMenuItem};
use tauri::Emitter;
use std::fs;

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path_buf = entry.path();
            let metadata = entry.metadata().ok();
            files.push(FileInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path_buf.to_string_lossy().to_string(),
                is_dir: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                is_md: path_buf.extension().map(|e| e == "md" || e == "markdown").unwrap_or(false),
            });
        }
    }
    // 排序：文件夹在前，然后按名称排序
    files.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    Ok(files)
}

#[derive(serde::Serialize, Clone)]
struct FileInfo {
    name: String,
    path: String,
    is_dir: bool,
    is_md: bool,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle();
            
            // 应用菜单 (MarkLight)
            let app_menu = Submenu::with_items(
                handle, "MarkLight", true,
                &[
                    &PredefinedMenuItem::about(handle, None, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::services(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, None)?,
                    &PredefinedMenuItem::hide_others(handle, None)?,
                    &PredefinedMenuItem::show_all(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::quit(handle, None)?,
                ],
            )?;

            // 文件菜单
            let file_menu = Submenu::with_items(
                handle, "文件", true,
                &[
                    &MenuItem::with_id(handle, "new", "新建", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(handle, "open", "打开...", true, Some("CmdOrCtrl+O"))?,
                    &MenuItem::with_id(handle, "open_folder", "打开文件夹...", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "save", "保存", true, Some("CmdOrCtrl+S"))?,
                    &MenuItem::with_id(handle, "save_as", "另存为...", true, Some("CmdOrCtrl+Shift+S"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "export_html", "导出为 HTML", true, None::<&str>)?,
                    &MenuItem::with_id(handle, "export_wechat", "微信导出", true, Some("CmdOrCtrl+E"))?,
                ],
            )?;

            // 编辑菜单
            let edit_menu = Submenu::with_items(
                handle, "编辑", true,
                &[
                    &PredefinedMenuItem::undo(handle, Some("撤销"))?,
                    &PredefinedMenuItem::redo(handle, Some("重做"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, Some("剪切"))?,
                    &PredefinedMenuItem::copy(handle, Some("复制"))?,
                    &PredefinedMenuItem::paste(handle, Some("粘贴"))?,
                    &PredefinedMenuItem::select_all(handle, Some("全选"))?,
                ],
            )?;

            // 视图菜单
            let view_menu = Submenu::with_items(
                handle, "视图", true,
                &[
                    &CheckMenuItem::with_id(handle, "toggle_sidebar", "侧边栏", true, true, Some("CmdOrCtrl+\\"))?,
                    &MenuItem::with_id(handle, "sidebar_outline", "  └ 大纲", true, Some("CmdOrCtrl+1"))?,
                    &MenuItem::with_id(handle, "sidebar_files", "  └ 文件树", true, Some("CmdOrCtrl+2"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &CheckMenuItem::with_id(handle, "toggle_source", "源码模式", true, false, Some("CmdOrCtrl+/"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::fullscreen(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "settings", "设置...", true, Some("CmdOrCtrl+,"))?,
                ],
            )?;

            let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &view_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                match event.id().as_ref() {
                    "new" => { let _ = app.emit("menu-event", "new"); }
                    "open" => { let _ = app.emit("menu-event", "open"); }
                    "open_folder" => { let _ = app.emit("menu-event", "open_folder"); }
                    "save" => { let _ = app.emit("menu-event", "save"); }
                    "save_as" => { let _ = app.emit("menu-event", "save_as"); }
                    "export_html" => { let _ = app.emit("menu-event", "export_html"); }
                    "export_wechat" => { let _ = app.emit("menu-event", "export_wechat"); }
                    "undo" => { let _ = app.emit("menu-event", "undo"); }
                    "redo" => { let _ = app.emit("menu-event", "redo"); }
                    "cut" => { let _ = app.emit("menu-event", "cut"); }
                    "copy" => { let _ = app.emit("menu-event", "copy"); }
                    "paste" => { let _ = app.emit("menu-event", "paste"); }
                    "select_all" => { let _ = app.emit("menu-event", "select_all"); }
                    "toggle_sidebar" => { let _ = app.emit("menu-event", "toggle_sidebar"); }
                    "sidebar_outline" => { let _ = app.emit("menu-event", "sidebar_outline"); }
                    "sidebar_files" => { let _ = app.emit("menu-event", "sidebar_files"); }
                    "toggle_source" => { let _ = app.emit("menu-event", "toggle_source"); }
                    "settings" => { let _ = app.emit("menu-event", "settings"); }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, save_file, list_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
