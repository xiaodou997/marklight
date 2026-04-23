use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use trash;

#[derive(serde::Serialize, Clone)]
pub struct FileInfo {
    name: String,
    path: String,
    is_dir: bool,
    is_md: bool,
    is_txt: bool,
    is_image: bool,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    atomic_write(Path::new(&path), content.as_bytes())
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();

    // 定义支持的扩展名
    let md_exts = ["md", "markdown"];
    let txt_exts = ["txt"];
    let img_exts = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

    for entry in entries {
        if let Ok(entry) = entry {
            let path_buf = entry.path();
            let metadata = entry.metadata().ok();
            let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);

            if is_dir {
                files.push(FileInfo {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: path_buf.to_string_lossy().to_string(),
                    is_dir: true,
                    is_md: false,
                    is_txt: false,
                    is_image: false,
                });
                continue;
            }

            let ext = path_buf
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();

            let is_md = md_exts.contains(&ext.as_str());
            let is_txt = txt_exts.contains(&ext.as_str());
            let is_image = img_exts.contains(&ext.as_str());

            // 只添加支持的文件类型
            if is_md || is_txt || is_image {
                files.push(FileInfo {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: path_buf.to_string_lossy().to_string(),
                    is_dir: false,
                    is_md,
                    is_txt,
                    is_image,
                });
            }
        }
    }
    // 排序：文件夹在前，然后按名称排序
    files.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(files)
}

#[tauri::command]
pub fn get_file_modified_time(path: String) -> Result<u64, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = metadata.modified().map_err(|e| e.to_string())?;
    let duration = modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| e.to_string())?;
    Ok(duration.as_millis() as u64)
}

#[tauri::command]
pub fn rename_file(old_path: String, new_name: String) -> Result<String, String> {
    validate_name(&new_name)?;
    let old_path = Path::new(&old_path);
    let parent = old_path.parent().ok_or("无法获取父目录")?;
    let new_path = parent.join(&new_name);
    if new_path.exists() {
        return Err("目标名称已存在".to_string());
    }
    fs::rename(old_path, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(dir: String, name: String) -> Result<String, String> {
    validate_name(&name)?;
    let path = Path::new(&dir).join(&name);
    if path.exists() {
        return Err("文件已存在".to_string());
    }
    atomic_write(&path, b"")?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_folder(dir: String, name: String) -> Result<String, String> {
    validate_name(&name)?;
    let path = Path::new(&dir).join(&name);
    if path.exists() {
        return Err("文件夹已存在".to_string());
    }
    fs::create_dir(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn validate_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("名称不能为空".to_string());
    }
    if name == "." || name == ".." || name.contains('/') || name.contains('\\') {
        return Err("名称包含非法路径字符".to_string());
    }
    Ok(())
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("无法获取父目录")?;
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let tmp_path = temp_path(path);
    {
        let mut file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
        file.write_all(content).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    fs::rename(&tmp_path, path).map_err(|e| e.to_string())
}

fn temp_path(path: &Path) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("marklight");
    path.with_file_name(format!(".{}.{}.tmp", file_name, millis))
}
