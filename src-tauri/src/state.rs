use crate::error::AppError;
use crate::events::emit_workspace_changed;
use crate::models::{AppOpenPathsPayload, WorkspaceChangeKind, WorkspaceChangedPayload};
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::AppHandle;

#[derive(Default)]
pub struct StartupOpenRequests(pub Mutex<Option<AppOpenPathsPayload>>);

impl StartupOpenRequests {
    pub fn replace(&self, payload: AppOpenPathsPayload) -> Result<(), AppError> {
        *self
            .0
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))? = Some(payload);
        Ok(())
    }

    pub fn take(&self) -> Result<Option<AppOpenPathsPayload>, AppError> {
        let payload = self
            .0
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?
            .take();
        Ok(payload)
    }
}

#[derive(Default)]
pub struct WindowOpenRequests(pub Mutex<HashMap<String, AppOpenPathsPayload>>);

impl WindowOpenRequests {
    pub fn insert(&self, window_label: String, payload: AppOpenPathsPayload) -> Result<(), AppError> {
        self.0
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?
            .insert(window_label, payload);
        Ok(())
    }

    pub fn take(&self, window_label: &str) -> Result<Option<AppOpenPathsPayload>, AppError> {
        let payload = self
            .0
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?
            .remove(window_label);
        Ok(payload)
    }
}

#[derive(Default)]
pub struct LoadedWindows(pub Mutex<HashSet<String>>);

impl LoadedWindows {
    pub fn mark_loaded(&self, label: String) -> Result<(), AppError> {
        self.0
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?
            .insert(label);
        Ok(())
    }

    pub fn has_loaded_window(&self) -> Result<bool, AppError> {
        let has_loaded = !self
            .0
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?
            .is_empty();
        Ok(has_loaded)
    }
}

pub struct WorkspaceWatcherState {
    watcher: Mutex<RecommendedWatcher>,
    watched_roots: Arc<Mutex<HashSet<PathBuf>>>,
}

impl WorkspaceWatcherState {
    pub fn new<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<Self, AppError> {
        let watched_roots = Arc::new(Mutex::new(HashSet::new()));
        let (tx, rx) = mpsc::channel();
        let watcher = RecommendedWatcher::new(tx, Config::default())?;

        spawn_workspace_event_loop(app.clone(), rx, watched_roots.clone());

        Ok(Self {
            watcher: Mutex::new(watcher),
            watched_roots,
        })
    }

    pub fn watch(&self, root_path: String) -> Result<(), AppError> {
        let root = PathBuf::from(&root_path);
        let mut watched_roots = self
            .watched_roots
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?;
        if !watched_roots.insert(root.clone()) {
            return Ok(());
        }

        let mut watcher = self
            .watcher
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?;
        watcher.watch(root.as_path(), RecursiveMode::Recursive)?;
        Ok(())
    }

    pub fn unwatch(&self, root_path: String) -> Result<(), AppError> {
        let root = PathBuf::from(&root_path);
        let mut watched_roots = self
            .watched_roots
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?;
        if !watched_roots.remove(&root) {
            return Ok(());
        }

        let mut watcher = self
            .watcher
            .lock()
            .map_err(|error| AppError::Native(error.to_string()))?;
        watcher.unwatch(root.as_path())?;
        Ok(())
    }
}

fn spawn_workspace_event_loop<R: tauri::Runtime>(
    app: AppHandle<R>,
    rx: Receiver<Result<Event, notify::Error>>,
    watched_roots: Arc<Mutex<HashSet<PathBuf>>>,
) {
    std::thread::spawn(move || loop {
        let first_event = match rx.recv() {
            Ok(event) => event,
            Err(_) => break,
        };
        let mut events = vec![first_event];

        loop {
            match rx.recv_timeout(Duration::from_millis(250)) {
                Ok(event) => events.push(event),
                Err(mpsc::RecvTimeoutError::Timeout) => break,
                Err(mpsc::RecvTimeoutError::Disconnected) => return,
            }
        }

        let roots_snapshot = match watched_roots.lock() {
            Ok(roots) => roots.clone(),
            Err(_) => continue,
        };

        for payload in aggregate_workspace_events(&roots_snapshot, events) {
            emit_workspace_changed(&app, payload);
        }
    });
}

fn event_kind_to_workspace_kind(event_kind: &EventKind) -> WorkspaceChangeKind {
    match event_kind {
        EventKind::Create(_) => WorkspaceChangeKind::Create,
        EventKind::Modify(_) => WorkspaceChangeKind::Modify,
        EventKind::Remove(_) => WorkspaceChangeKind::Remove,
        _ => WorkspaceChangeKind::Other,
    }
}

fn aggregate_workspace_events(
    watched_roots: &HashSet<PathBuf>,
    events: Vec<Result<Event, notify::Error>>,
) -> Vec<WorkspaceChangedPayload> {
    let mut grouped = BTreeMap::<(String, WorkspaceChangeKind), BTreeSet<String>>::new();

    for event_result in events {
        let event = match event_result {
            Ok(event) => event,
            Err(_) => continue,
        };
        let kind = event_kind_to_workspace_kind(&event.kind);

        for root in watched_roots {
            let matched_paths = event
                .paths
                .iter()
                .filter(|path| path.starts_with(root))
                .filter_map(|path| path_to_string(path.as_path()))
                .collect::<Vec<_>>();
            if matched_paths.is_empty() {
                continue;
            }

            let Some(root_path) = path_to_string(root.as_path()) else {
                continue;
            };
            let entry = grouped.entry((root_path, kind.clone())).or_default();
            entry.extend(matched_paths);
        }
    }

    grouped
        .into_iter()
        .map(|((root_path, kind), paths)| WorkspaceChangedPayload {
            root_path,
            kind,
            paths: paths.into_iter().collect(),
        })
        .collect()
}

fn path_to_string(path: &Path) -> Option<String> {
    path.to_str().map(|value| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::aggregate_workspace_events;
    use crate::models::WorkspaceChangeKind;
    use notify::{Event, EventKind};
    use std::collections::HashSet;
    use std::path::PathBuf;

    #[test]
    fn aggregates_workspace_changes_by_root_and_kind() {
        let roots = HashSet::from([
            PathBuf::from("/tmp/project-a"),
            PathBuf::from("/tmp/project-b"),
        ]);
        let events = vec![
            Ok(Event {
                kind: EventKind::Modify(notify::event::ModifyKind::Any),
                paths: vec![
                    PathBuf::from("/tmp/project-a/demo.md"),
                    PathBuf::from("/tmp/project-a/assets/logo.png"),
                ],
                attrs: Default::default(),
            }),
            Ok(Event {
                kind: EventKind::Remove(notify::event::RemoveKind::Any),
                paths: vec![PathBuf::from("/tmp/project-b/old.md")],
                attrs: Default::default(),
            }),
        ];

        let payloads = aggregate_workspace_events(&roots, events);

        assert_eq!(payloads.len(), 2);
        assert_eq!(payloads[0].root_path, "/tmp/project-a");
        assert_eq!(payloads[0].kind, WorkspaceChangeKind::Modify);
        assert_eq!(
            payloads[0].paths,
            vec![
                "/tmp/project-a/assets/logo.png".to_string(),
                "/tmp/project-a/demo.md".to_string()
            ]
        );
        assert_eq!(payloads[1].root_path, "/tmp/project-b");
        assert_eq!(payloads[1].kind, WorkspaceChangeKind::Remove);
        assert_eq!(payloads[1].paths, vec!["/tmp/project-b/old.md".to_string()]);
    }
}
