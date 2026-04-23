mod commands;
mod menu;

use commands::*;
use notify::{Config, EventKind, RecommendedWatcher, Watcher};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Default)]
struct StartupOpenFile(Mutex<Option<String>>);

#[tauri::command]
fn consume_startup_open_file(state: tauri::State<'_, StartupOpenFile>) -> Option<String> {
    state.0.lock().ok()?.take()
}

/// 前端就绪后调用此命令。Rust 收到通知后，将等待中的启动文件推送给该窗口。
/// 作为 on_page_load 的额外保险机制。
#[tauri::command]
fn notify_frontend_ready(app: tauri::AppHandle, state: tauri::State<'_, StartupOpenFile>) {
    eprintln!("[marklight] notify_frontend_ready called");
    if let Ok(mut guard) = state.0.lock() {
        eprintln!(
            "[marklight] StartupOpenFile at notify_frontend_ready = {:?}",
            *guard
        );
        if let Some(path) = guard.take() {
            eprintln!(
                "[marklight] Pushing startup file via notify_frontend_ready: {}",
                path
            );
            let _ = app.emit("open-startup-file", path);
        }
    }
}

#[tauri::command]
fn refresh_menu_shortcuts(
    app: tauri::AppHandle,
    shortcuts: HashMap<String, String>,
) -> Result<(), String> {
    menu::setup_menu(&app, &shortcuts).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_cli::init())
        // ── 方案一（最可靠）：webview 页面加载完成时主动推送等待中的文件 ──
        // on_page_load 在 webview JS 执行完毕后触发，此时前端监听器已注册。
        // 无论 RunEvent::Opened 和 webview 加载孰先孰后，这里都能兜底。
        .on_page_load(|webview, payload| {
            use tauri::webview::PageLoadEvent;
            // PageLoadEvent::Finished 在 HTML 加载完即触发，早于 Vue onMounted 和事件监听器注册。
            // 因此这里只做诊断日志，不发送事件（监听器还没就绪）。
            // 实际推送由 notify_frontend_ready 完成（在监听器注册后由前端主动调用）。
            if payload.event() == PageLoadEvent::Finished {
                eprintln!(
                    "[marklight] on_page_load::Finished for url={}",
                    payload.url()
                );
                if let Some(state) = webview.app_handle().try_state::<StartupOpenFile>() {
                    if let Ok(guard) = state.0.lock() {
                        eprintln!("[marklight] StartupOpenFile at page_load = {:?}", *guard);
                    }
                }
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(StartupOpenFile::default());
            app.manage(PendingWindowOpenFiles::default());

            // 所有平台均支持命令行参数打开文件（macOS 用于 dev 模式调试）
            // 生产环境 macOS 通过 RunEvent::Opened 处理，CLI 参数作为补充
            {
                use tauri_plugin_cli::CliExt;
                if let Ok(matches) = app.cli().matches() {
                    if let Some(file_arg) = matches.args.get("file") {
                        if let Some(file_path) = file_arg.value.as_str() {
                            if let Some(state) = app.try_state::<StartupOpenFile>() {
                                if let Ok(mut startup_file) = state.0.lock() {
                                    *startup_file = Some(file_path.to_string());
                                }
                            }
                        }
                    }
                }
            }

            // 设置文件监听器
            let (tx, rx) = std::sync::mpsc::channel();
            let watcher = RecommendedWatcher::new(tx, Config::default())
                .map_err(|e: notify::Error| e.to_string())?;

            // 在后台线程处理监听事件，携带变更路径和类型
            std::thread::spawn(move || {
                use std::time::{Duration, Instant};
                let mut last_emit = Instant::now() - Duration::from_secs(1);

                for res in rx {
                    match res {
                        Ok(event) => {
                            let now = Instant::now();
                            if now.duration_since(last_emit) < Duration::from_millis(300) {
                                continue;
                            }
                            last_emit = now;

                            let kind = match event.kind {
                                EventKind::Create(_) => "create",
                                EventKind::Modify(_) => "modify",
                                EventKind::Remove(_) => "remove",
                                _ => "other",
                            };
                            let paths: Vec<String> = event
                                .paths
                                .iter()
                                .map(|p| p.to_string_lossy().to_string())
                                .collect();

                            #[derive(Clone, serde::Serialize)]
                            struct FileChangePayload {
                                kind: String,
                                paths: Vec<String>,
                            }

                            let _ = handle.emit(
                                "file-changed",
                                FileChangePayload {
                                    kind: kind.to_string(),
                                    paths,
                                },
                            );
                        }
                        Err(e) => println!("watch error: {:?}", e),
                    }
                }
            });

            app.manage(std::sync::Mutex::new(watcher));

            menu::setup_menu(&app.handle(), &HashMap::new()).map_err(|e| e.to_string())?;
            menu::attach_menu_events(&app.handle());

            if let Some(main_window) = app.get_webview_window("main") {
                #[cfg(any(target_os = "windows", target_os = "linux"))]
                main_window.set_decorations(false).map_err(|e| e.to_string())?;

                #[cfg(target_os = "macos")]
                apply_macos_window_background(&main_window, "#ffffff")?;

                attach_close_interceptor(&main_window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            save_file,
            list_directory,
            save_image,
            resolve_image_path,
            fetch_remote_image,
            open_new_window,
            print_document,
            rename_file,
            delete_file,
            create_file,
            create_folder,
            reveal_in_finder,
            consume_pending_window_open_file,
            get_file_modified_time,
            watch_directory,
            unwatch_directory,
            read_config,
            write_config,
            refresh_menu_shortcuts,
            consume_startup_open_file,
            notify_frontend_ready,
            set_window_background_color
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            // ── 方案二：macOS RunEvent::Opened ──
            // 热启动（App 已运行）时直接广播给已就绪的前端。
            // 冷启动时存入 StartupOpenFile，由 on_page_load 在页面加载后推送。
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = &event {
                eprintln!("[marklight] RunEvent::Opened fired, {} URL(s)", urls.len());
                let mut paths: Vec<String> = Vec::new();
                for url in urls {
                    eprintln!("[marklight]   url = {}", url);
                    if let Ok(pb) = url.to_file_path() {
                        if let Some(s) = pb.to_str() {
                            paths.push(s.to_string());
                        }
                    }
                }

                if let Some(first_path) = paths.first().cloned() {
                    // 存入 StartupOpenFile（冷启动时 on_page_load 会在页面加载后推送）
                    if let Some(state) = app_handle.try_state::<StartupOpenFile>() {
                        if let Ok(mut startup_file) = state.0.lock() {
                            if startup_file.is_none() {
                                eprintln!("[marklight] Storing startup file: {}", first_path);
                                *startup_file = Some(first_path);
                            }
                        }
                    }
                    // 热启动时前端已就绪，直接广播
                    eprintln!("[marklight] Broadcasting tauri://open");
                    let _ = app_handle.emit("tauri://open", paths);
                }
            }
        });
}
