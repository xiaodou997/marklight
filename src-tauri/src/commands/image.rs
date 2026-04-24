use base64::{engine::general_purpose, Engine as _};
use crate::error::AppError;

/// 异步获取网络图片并返回 base64 数据 URL
#[tauri::command]
pub async fn fetch_remote_image(url: String) -> Result<String, AppError> {
    println!("[fetch_image] Fetching: {}", url);

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::Network(format!("创建客户端失败: {}", error)))?;

    let response = client
        .get(&url)
        .header("Referer", &url)
        .header(
            "Accept",
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        )
        .send()
        .await
        .map_err(|error| AppError::Network(format!("请求失败: {}", error)))?;

    let status = response.status();
    if !status.is_success() {
        return Err(AppError::Network(format!("HTTP 错误: {}", status)));
    }

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|error| AppError::Network(format!("读取响应失败: {}", error)))?;

    // 转换为 base64 data URL
    let base64_data = general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", content_type, base64_data);

    println!("[fetch_image] Success! Size: {} bytes", bytes.len());
    Ok(data_url)
}
