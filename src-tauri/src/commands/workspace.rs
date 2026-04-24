use crate::error::AppError;
use crate::models::{
    PathResult, WorkspaceEntryCreateKind, WorkspaceEntryDto, WorkspaceEntryHandle,
    WorkspaceEntryKind,
};
use crate::state::WorkspaceWatcherState;
use std::fs;
use std::path::Path;
use tauri::State;

const MARKDOWN_EXTENSIONS: [&str; 2] = ["md", "markdown"];
const TEXT_EXTENSIONS: [&str; 1] = ["txt"];
const IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

#[tauri::command]
pub fn list_workspace_entries(root_path: String) -> Result<Vec<WorkspaceEntryDto>, AppError> {
    let entries = fs::read_dir(&root_path)?;
    let mut workspace_entries = Vec::new();

    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        let metadata = entry.metadata()?;

        let Some(path_str) = path.to_str() else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().to_string();

        let kind = if metadata.is_dir() {
            WorkspaceEntryKind::Directory
        } else if let Some(kind) = file_kind_from_path(&path) {
            kind
        } else {
            continue;
        };

        workspace_entries.push(WorkspaceEntryDto {
            name,
            path: path_str.to_string(),
            kind,
        });
    }

    workspace_entries.sort_by(|left, right| match (&left.kind, &right.kind) {
        (WorkspaceEntryKind::Directory, WorkspaceEntryKind::Directory)
        | (WorkspaceEntryKind::Markdown, WorkspaceEntryKind::Markdown)
        | (WorkspaceEntryKind::Text, WorkspaceEntryKind::Text)
        | (WorkspaceEntryKind::Image, WorkspaceEntryKind::Image) => {
            left.name.to_lowercase().cmp(&right.name.to_lowercase())
        }
        (WorkspaceEntryKind::Directory, _) => std::cmp::Ordering::Less,
        (_, WorkspaceEntryKind::Directory) => std::cmp::Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    });

    Ok(workspace_entries)
}

#[tauri::command]
pub fn create_workspace_entry(
    parent_path: String,
    kind: WorkspaceEntryCreateKind,
    name: String,
) -> Result<WorkspaceEntryHandle, AppError> {
    validate_workspace_name(&name)?;
    let path = Path::new(&parent_path).join(&name);
    if path.exists() {
        return Err(AppError::validation("目标名称已存在"));
    }

    match kind {
        WorkspaceEntryCreateKind::File => {
            fs::write(&path, [])?;
        }
        WorkspaceEntryCreateKind::Folder => {
            fs::create_dir(&path)?;
        }
    }

    Ok(WorkspaceEntryHandle {
        path: path.to_string_lossy().to_string(),
        kind,
    })
}

#[tauri::command]
pub fn rename_workspace_entry(path: String, new_name: String) -> Result<PathResult, AppError> {
    validate_workspace_name(&new_name)?;
    let current_path = Path::new(&path);
    let parent = current_path
        .parent()
        .ok_or_else(|| AppError::validation("无法获取父目录"))?;
    let next_path = parent.join(new_name);
    if next_path.exists() {
        return Err(AppError::validation("目标名称已存在"));
    }

    fs::rename(current_path, &next_path)?;

    Ok(PathResult {
        path: next_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn trash_workspace_entry(path: String) -> Result<(), AppError> {
    trash::delete(path).map_err(|error| AppError::Io(error.to_string()))
}

#[tauri::command]
pub fn watch_workspace(
    state: State<'_, WorkspaceWatcherState>,
    root_path: String,
) -> Result<(), AppError> {
    state.watch(root_path)
}

#[tauri::command]
pub fn unwatch_workspace(
    state: State<'_, WorkspaceWatcherState>,
    root_path: String,
) -> Result<(), AppError> {
    state.unwatch(root_path)
}

fn file_kind_from_path(path: &Path) -> Option<WorkspaceEntryKind> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())?;

    if MARKDOWN_EXTENSIONS.contains(&extension.as_str()) {
        return Some(WorkspaceEntryKind::Markdown);
    }
    if TEXT_EXTENSIONS.contains(&extension.as_str()) {
        return Some(WorkspaceEntryKind::Text);
    }
    if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Some(WorkspaceEntryKind::Image);
    }

    None
}

fn validate_workspace_name(name: &str) -> Result<(), AppError> {
    if name.trim().is_empty() {
        return Err(AppError::validation("名称不能为空"));
    }
    if name == "." || name == ".." || name.contains('/') || name.contains('\\') {
        return Err(AppError::validation("名称包含非法路径字符"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{create_workspace_entry, list_workspace_entries, rename_workspace_entry};
    use crate::models::{WorkspaceEntryCreateKind, WorkspaceEntryKind};
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn test_dir() -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let seq = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir =
            std::env::temp_dir().join(format!("marklight-workspace-test-{}-{}", millis, seq));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn list_workspace_entries_filters_to_supported_types() {
        let dir = test_dir();
        fs::write(dir.join("a.md"), b"# demo").unwrap();
        fs::write(dir.join("b.txt"), b"plain").unwrap();
        fs::write(dir.join("c.svg"), b"<svg />").unwrap();
        fs::write(dir.join("skip.pdf"), b"%PDF").unwrap();
        fs::create_dir(dir.join("notes")).unwrap();

        let entries = list_workspace_entries(dir.to_string_lossy().to_string()).unwrap();

        assert_eq!(entries.len(), 4);
        assert_eq!(entries[0].kind, WorkspaceEntryKind::Directory);
        assert_eq!(entries[1].kind, WorkspaceEntryKind::Markdown);
        assert_eq!(entries[2].kind, WorkspaceEntryKind::Text);
        assert_eq!(entries[3].kind, WorkspaceEntryKind::Image);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn create_and_rename_workspace_entries_validate_names() {
        let dir = test_dir();

        let created = create_workspace_entry(
            dir.to_string_lossy().to_string(),
            WorkspaceEntryCreateKind::File,
            "demo.md".to_string(),
        )
        .unwrap();
        assert!(created.path.ends_with("demo.md"));

        let renamed = rename_workspace_entry(created.path, "renamed.md".to_string()).unwrap();
        assert!(renamed.path.ends_with("renamed.md"));

        let invalid = create_workspace_entry(
            dir.to_string_lossy().to_string(),
            WorkspaceEntryCreateKind::Folder,
            "../bad".to_string(),
        );
        assert!(invalid.is_err());

        let _ = fs::remove_dir_all(dir);
    }
}
