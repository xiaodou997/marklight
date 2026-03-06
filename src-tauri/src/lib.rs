use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu, CheckMenuItem};
use tauri::{Emitter, WebviewUrl, WebviewWindowBuilder, Manager};
use std::fs;
use std::path::Path;
use std::time::SystemTime;
use notify::{Watcher, RecursiveMode, Config};

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

#[tauri::command]
fn get_file_modified_time(path: String) -> Result<u64, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let duration = modified.duration_since(SystemTime::UNIX_EPOCH).map_err(|e| e.to_string())?;
    Ok(duration.as_secs())
}

/// 保存图片到指定目录的 assets 子目录中
#[tauri::command]
fn save_image(dir: String, filename: String, data: Vec<u8>) -> Result<String, String> {
    let assets_dir = Path::new(&dir).join("assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| format!("创建 assets 目录失败: {}", e))?;
    }
    let file_path = assets_dir.join(&filename);
    fs::write(&file_path, data).map_err(|e| format!("保存图片失败: {}", e))?;
    Ok(format!("assets/{}", filename))
}

/// 获取文件的绝对路径
#[tauri::command]
fn resolve_image_path(file_dir: String, relative_path: String) -> Result<String, String> {
    let absolute_path = Path::new(&file_dir).join(&relative_path);
    absolute_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "无法解析图片路径".to_string())
}

/// 打开新窗口
#[tauri::command]
async fn open_new_window(app: tauri::AppHandle, path: Option<String>) -> Result<(), String> {
    let window_label = format!("main-{}", std::process::id());
    let builder = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App("index.html".into())
    )
    .title("未命名")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .center();
    
    let window = builder.build().map_err(|e| e.to_string())?;
    if let Some(file_path) = path {
        window.emit("open-file-in-new-window", file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 打印当前文档
#[tauri::command]
fn print_document(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// 重命名文件或文件夹
#[tauri::command]
fn rename_file(old_path: String, new_name: String) -> Result<String, String> {
    let path = Path::new(&old_path);
    let parent = path.parent().ok_or("无法获取父目录")?;
    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err("目标名称已存在".to_string());
    }
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

/// 删除文件或文件夹（移到回收站）
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

/// 新建文件
#[tauri::command]
fn create_file(dir: String, name: String) -> Result<String, String> {
    let path = Path::new(&dir).join(&name);
    if path.exists() {
        return Err("文件已存在".to_string());
    }
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 新建文件夹
#[tauri::command]
fn create_folder(dir: String, name: String) -> Result<String, String> {
    let path = Path::new(&dir).join(&name);
    if path.exists() {
        return Err("文件夹已存在".to_string());
    }
    fs::create_dir(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// 在 Finder/资源管理器 中显示文件
#[tauri::command]
async fn reveal_in_finder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    #[cfg(target_os = "linux")]
    {
        let path_buf = Path::new(&path);
        let dir = if path_buf.is_dir() { path_buf } else { path_buf.parent().unwrap_or(Path::new("/")) };
        app.opener().open_path(dir.to_string_lossy().to_string(), None).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "linux"))]
    {
        app.opener().reveal_item_in_dir(path).map_err(|e| e.to_string())
    }
}

/// 监听指定目录
#[tauri::command]
fn watch_directory(state: tauri::State<std::sync::Mutex<notify::RecommendedWatcher>>, path: String) -> Result<(), String> {
    let mut watcher = state.lock().map_err(|e| e.to_string())?;
    // 先取消所有之前的监听（简单处理，实际可根据路径管理）
    // 注意：notify 的 RecommendedWatcher 在某些平台下 unwatch 可能需要精确路径
    // 这里我们先尝试直接添加新路径，notify 会处理重复添加
    watcher.watch(Path::new(&path), RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    Ok(())
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
            let handle = app.handle().clone();
            
            // 设置文件监听器
            let (tx, rx) = std::sync::mpsc::channel();
            let watcher = notify::RecommendedWatcher::new(tx, Config::default()).map_err(|e| e.to_string())?;
            
            // 在后台线程处理监听事件
            std::thread::spawn(move || {
                for res in rx {
                    match res {
                        Ok(_) => {
                            let _ = handle.emit("file-changed", ());
                        }
                        Err(e) => println!("watch error: {:?}", e),
                    }
                }
            });

            // 将 watcher 存储在状态中，防止被销毁
            app.manage(std::sync::Mutex::new(watcher));

            let handle = app.handle();
            // 应用菜单 (MarkLight)
            let app_menu = Submenu::with_items(
                handle, "MarkLight", true,
                &[
                    &MenuItem::with_id(handle, "about", "关于 MarkLight", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "settings", "设置...", true, Some("CmdOrCtrl+,"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::services(handle, Some("服务"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "hide", "隐藏 MarkLight", true, Some("CmdOrCtrl+H"))?,
                    &MenuItem::with_id(handle, "hide_others", "隐藏其他", true, Some("CmdOrCtrl+Alt+H"))?,
                    &MenuItem::with_id(handle, "show_all", "显示全部", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "quit", "退出 MarkLight", true, Some("CmdOrCtrl+Q"))?,
                ],
            )?;

            // 文件菜单
            let file_menu = Submenu::with_items(
                handle, "文件", true,
                &[
                    &MenuItem::with_id(handle, "new", "新建", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(handle, "new_window", "新建窗口", true, Some("CmdOrCtrl+Alt+N"))?,
                    &MenuItem::with_id(handle, "open", "打开...", true, Some("CmdOrCtrl+O"))?,
                    &MenuItem::with_id(handle, "open_folder", "打开文件夹...", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "save", "保存", true, Some("CmdOrCtrl+S"))?,
                    &MenuItem::with_id(handle, "save_as", "另存为...", true, Some("CmdOrCtrl+Shift+S"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "export_html", "导出为 HTML", true, None::<&str>)?,
                    &MenuItem::with_id(handle, "export_pdf", "导出为 PDF...", true, Some("CmdOrCtrl+Shift+P"))?,
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
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "find", "查找", true, Some("CmdOrCtrl+F"))?,
                    &MenuItem::with_id(handle, "replace", "替换", true, Some("CmdOrCtrl+H"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "command_palette", "命令面板", true, Some("CmdOrCtrl+K"))?,
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
                    &MenuItem::with_id(handle, "focus_mode", "焦点模式", true, Some("CmdOrCtrl+Shift+F"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItem::with_id(handle, "fullscreen", "全屏", true, Some("CmdOrCtrl+Ctrl+F"))?,
                ],
            )?;

            let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &view_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                match event.id().as_ref() {
                    "about" => { let _ = app.emit("menu-event", "about"); }
                    "settings" => { let _ = app.emit("menu-event", "settings"); }
                    "quit" => { let _ = app.emit("menu-event", "quit"); }
                    "new" => { let _ = app.emit("menu-event", "new"); }
                    "new_window" => { let _ = app.emit("menu-event", "new_window"); }
                    "open" => { let _ = app.emit("menu-event", "open"); }
                    "open_folder" => { let _ = app.emit("menu-event", "open_folder"); }
                    "save" => { let _ = app.emit("menu-event", "save"); }
                    "save_as" => { let _ = app.emit("menu-event", "save_as"); }
                    "export_html" => { let _ = app.emit("menu-event", "export_html"); }
                    "export_pdf" => { let _ = app.emit("menu-event", "export_pdf"); }
                    "export_wechat" => { let _ = app.emit("menu-event", "export_wechat"); }
                    "undo" => { let _ = app.emit("menu-event", "undo"); }
                    "redo" => { let _ = app.emit("menu-event", "redo"); }
                    "cut" => { let _ = app.emit("menu-event", "cut"); }
                    "copy" => { let _ = app.emit("menu-event", "copy"); }
                    "paste" => { let _ = app.emit("menu-event", "paste"); }
                    "select_all" => { let _ = app.emit("menu-event", "select_all"); }
                    "find" => { let _ = app.emit("menu-event", "find"); }
                    "replace" => { let _ = app.emit("menu-event", "replace"); }
                    "toggle_sidebar" => { let _ = app.emit("menu-event", "toggle_sidebar"); }
                    "sidebar_outline" => { let _ = app.emit("menu-event", "sidebar_outline"); }
                    "sidebar_files" => { let _ = app.emit("menu-event", "sidebar_files"); }
                    "toggle_source" => { let _ = app.emit("menu-event", "toggle_source"); }
                    "focus_mode" => { let _ = app.emit("menu-event", "focus_mode"); }
                    "fullscreen" => { let _ = app.emit("menu-event", "fullscreen"); }
                    _ => {}
                }
            });

            if let Some(main_window) = app.get_webview_window("main") {
                // Windows 和 Linux 下禁用原生边框以使用自定义标题栏
                #[cfg(any(target_os = "windows", target_os = "linux"))]
                main_window.set_decorations(false).map_err(|e| e.to_string())?;

                let window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.emit("window-close-requested", ());
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![read_file, save_file, list_directory, save_image, resolve_image_path, open_new_window, print_document, rename_file, delete_file, create_file, create_folder, reveal_in_finder, get_file_modified_time, watch_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
