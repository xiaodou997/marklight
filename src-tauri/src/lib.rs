mod commands;
mod error;
mod events;
mod menu;
mod models;
mod state;

use commands::*;
use events::emit_app_open_paths;
use models::{AppOpenPathsPayload, AppOpenSource};
use state::{LoadedWindows, StartupOpenRequests, WindowOpenRequests, WorkspaceWatcherState};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

#[tauri::command]
fn consume_startup_open_request(
    state: tauri::State<'_, StartupOpenRequests>,
) -> Result<Option<AppOpenPathsPayload>, error::AppError> {
    state.take()
}

#[tauri::command]
fn notify_frontend_ready(
    loaded_windows: tauri::State<'_, LoadedWindows>,
    startup_requests: tauri::State<'_, StartupOpenRequests>,
    window: tauri::WebviewWindow,
) -> Result<Option<AppOpenPathsPayload>, error::AppError> {
    loaded_windows.mark_loaded(window.label().to_string())?;
    startup_requests.take()
}

#[tauri::command]
fn refresh_native_menu_shortcuts(
    app: tauri::AppHandle,
    shortcuts: HashMap<String, String>,
) -> Result<(), error::AppError> {
    menu::setup_menu(&app, &shortcuts).map_err(error::AppError::from)
}

fn supported_open_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("md" | "markdown" | "txt")
    )
}

fn normalize_open_path(value: &str, cwd: Option<&str>) -> Option<String> {
    if value.starts_with('-') {
        return None;
    }

    let path = PathBuf::from(value);
    if !supported_open_path(&path) {
        return None;
    }

    let path = if path.is_absolute() {
        path
    } else if let Some(cwd) = cwd {
        PathBuf::from(cwd).join(path)
    } else {
        path
    };
    path.to_str().map(|value| value.to_string())
}

fn open_paths_from_args<I, S>(args: I, cwd: Option<&str>) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .filter_map(|arg| normalize_open_path(arg.as_ref(), cwd))
        .collect()
}

fn dispatch_or_store_open_request(app: &tauri::AppHandle, payload: AppOpenPathsPayload) {
    let has_loaded_window = app
        .try_state::<LoadedWindows>()
        .and_then(|state| state.has_loaded_window().ok())
        .unwrap_or(false);

    if has_loaded_window {
        emit_app_open_paths(app, payload);
    } else if let Some(state) = app.try_state::<StartupOpenRequests>() {
        let _ = state.replace(payload);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths = open_paths_from_args(args, Some(&cwd));
            if !paths.is_empty() {
                dispatch_or_store_open_request(
                    app,
                    AppOpenPathsPayload {
                        paths,
                        source: AppOpenSource::SingleInstance,
                    },
                );
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE
                        | StateFlags::POSITION
                        | StateFlags::MAXIMIZED
                        | StateFlags::FULLSCREEN,
                )
                .map_label(|label| {
                    if label.starts_with("main-") {
                        "secondary"
                    } else {
                        label
                    }
                })
                .build(),
        )
        .setup(|app| {
            app.manage(StartupOpenRequests::default());
            app.manage(WindowOpenRequests::default());
            app.manage(LoadedWindows::default());
            app.manage(WorkspaceWatcherState::new(&app.handle())?);

            {
                use tauri_plugin_cli::CliExt;
                if let Ok(matches) = app.cli().matches() {
                    if let Some(file_arg) = matches.args.get("file") {
                        if let Some(file_path) = file_arg.value.as_str() {
                            if let Some(file_path) = normalize_open_path(file_path, None) {
                                if let Some(state) = app.try_state::<StartupOpenRequests>() {
                                    let _ = state.replace(AppOpenPathsPayload {
                                        paths: vec![file_path],
                                        source: AppOpenSource::Cli,
                                    });
                                }
                            } else if let Some(state) = app.try_state::<StartupOpenRequests>() {
                                let _ = state.replace(AppOpenPathsPayload {
                                    paths: vec![file_path.to_string()],
                                    source: AppOpenSource::Cli,
                                });
                            };
                        }
                    }
                }
            }

            menu::setup_menu(&app.handle(), &HashMap::new()).map_err(error::AppError::from)?;
            menu::attach_menu_events(&app.handle());

            if let Some(main_window) = app.get_webview_window("main") {
                #[cfg(any(target_os = "windows", target_os = "linux"))]
                main_window
                    .set_decorations(false)
                    .map_err(error::AppError::from)?;

                #[cfg(target_os = "macos")]
                apply_macos_window_background(&main_window, "#ffffff")?;

                #[cfg(debug_assertions)]
                if std::env::var_os("MARKLIGHT_OPEN_DEVTOOLS").is_some() {
                    main_window.open_devtools();
                }

                attach_close_interceptor(&main_window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_document,
            save_document,
            list_workspace_entries,
            create_workspace_entry,
            rename_workspace_entry,
            trash_workspace_entry,
            watch_workspace,
            unwatch_workspace,
            import_document_image,
            resolve_document_image_path,
            fetch_remote_image,
            open_editor_window,
            consume_window_open_request,
            consume_startup_open_request,
            notify_frontend_ready,
            refresh_native_menu_shortcuts,
            print_document,
            reveal_in_finder,
            set_window_background_color
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = &event {
                let paths = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter_map(|path| path.to_str().map(|value| value.to_string()))
                    .collect::<Vec<_>>();

                if !paths.is_empty() {
                    dispatch_or_store_open_request(
                        app_handle,
                        AppOpenPathsPayload {
                            paths,
                            source: AppOpenSource::OsOpen,
                        },
                    );
                }
            }
        });
}
