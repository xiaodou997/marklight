use crate::error::AppError;
use crate::models::{
    DocumentImageImportResult, DocumentImageResolveResult, DocumentOpenResult, DocumentSaveResult,
};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub fn open_document(path: String) -> Result<DocumentOpenResult, AppError> {
    let content = fs::read_to_string(&path)?;
    let last_modified_ms = read_modified_time_ms(Path::new(&path))?;

    Ok(DocumentOpenResult {
        path,
        content,
        last_modified_ms,
    })
}

#[tauri::command]
pub fn save_document(
    path: String,
    content: String,
    expected_last_modified_ms: Option<u64>,
    force: bool,
) -> Result<DocumentSaveResult, AppError> {
    let path_ref = Path::new(&path);
    if !force {
        if let Some(expected) = expected_last_modified_ms {
            if let Ok(current_modified) = read_modified_time_ms(path_ref) {
                if current_modified != expected {
                    return Err(AppError::conflict("文件已被外部修改，请重新加载或选择强制覆盖"));
                }
            }
        }
    }

    atomic_write(path_ref, content.as_bytes())?;
    let last_modified_ms = read_modified_time_ms(path_ref)?;

    Ok(DocumentSaveResult {
        path,
        last_modified_ms,
    })
}

#[tauri::command]
pub fn import_document_image(
    source_path: String,
    document_path: String,
) -> Result<DocumentImageImportResult, AppError> {
    let source = Path::new(&source_path);
    let filename = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::validation("无法解析图片文件名"))?;

    let document_dir = Path::new(&document_path)
        .parent()
        .ok_or_else(|| AppError::validation("无法获取文档目录"))?;
    let assets_dir = document_dir.join("assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir)?;
    }

    let target_path = assets_dir.join(filename);
    fs::copy(source, target_path)?;

    Ok(DocumentImageImportResult {
        relative_path: format!("assets/{}", filename),
    })
}

#[tauri::command]
pub fn resolve_document_image_path(
    document_path: String,
    relative_path: String,
) -> Result<DocumentImageResolveResult, AppError> {
    let document_dir = Path::new(&document_path)
        .parent()
        .ok_or_else(|| AppError::validation("无法获取文档目录"))?;
    let absolute_path = document_dir.join(relative_path);
    let absolute_path = absolute_path
        .to_str()
        .ok_or_else(|| AppError::validation("无法解析图片路径"))?;

    Ok(DocumentImageResolveResult {
        absolute_path: absolute_path.to_string(),
    })
}

pub(crate) fn atomic_write(path: &Path, content: &[u8]) -> Result<(), AppError> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::validation("无法获取父目录"))?;
    if !parent.exists() {
        fs::create_dir_all(parent)?;
    }

    let tmp_path = temp_path(path);
    {
        let mut file = fs::File::create(&tmp_path)?;
        file.write_all(content)?;
        file.sync_all()?;
    }

    #[cfg(target_os = "windows")]
    if path.exists() {
        fs::remove_file(path)?;
    }

    fs::rename(&tmp_path, path)?;
    Ok(())
}

fn read_modified_time_ms(path: &Path) -> Result<u64, AppError> {
    let metadata = fs::metadata(path)?;
    let modified = metadata.modified()?;
    let duration = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|error| AppError::Io(error.to_string()))?;
    Ok(duration.as_millis() as u64)
}

fn temp_path(path: &Path) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("marklight");
    path.with_file_name(format!(".{}.{}.tmp", file_name, millis))
}

#[cfg(test)]
mod tests {
    use super::{atomic_write, open_document, save_document};
    use crate::error::AppError;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::thread;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn test_dir() -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0);
        let seq = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("marklight-document-test-{}-{}", millis, seq));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn open_document_returns_content_and_mtime() {
        let dir = test_dir();
        let path = dir.join("demo.md");
        atomic_write(&path, b"# demo").unwrap();

        let result = open_document(path.to_string_lossy().to_string()).unwrap();

        assert_eq!(result.content, "# demo");
        assert!(result.last_modified_ms > 0);

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_document_reports_conflicts() {
        let dir = test_dir();
        let path = dir.join("demo.md");
        atomic_write(&path, b"first").unwrap();
        let opened = open_document(path.to_string_lossy().to_string()).unwrap();
        thread::sleep(Duration::from_millis(5));
        atomic_write(&path, b"second").unwrap();

        let error = save_document(
            opened.path.clone(),
            "third".to_string(),
            Some(opened.last_modified_ms),
            false,
        )
        .unwrap_err();

        match error {
            AppError::Conflict(_) => {}
            other => panic!("expected conflict error, got {:?}", other),
        }

        let _ = fs::remove_dir_all(dir);
    }
}
