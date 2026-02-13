use std::io::Write;
use std::process::Command;
use tempfile::NamedTempFile;

use crate::printer::PrintResult;

/// Print plain text to the system's default printer (silent, no dialog)
/// Uses platform-specific commands: lp on macOS/Linux, notepad /p on Windows
pub fn print_to_system_printer(text: &str) -> Result<PrintResult, String> {
    // Create a temporary file with the text content
    let mut temp_file = NamedTempFile::new()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    temp_file.write_all(text.as_bytes())
        .map_err(|e| format!("Failed to write to temp file: {}", e))?;
    
    let file_path = temp_file.path().to_string_lossy().to_string();
    
    #[cfg(target_os = "windows")]
    {
        // Windows: Use PowerShell to print silently
        let output = Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    "Get-Content '{}' | Out-Printer",
                    file_path.replace("'", "''")
                )
            ])
            .output()
            .map_err(|e| format!("Failed to execute print command: {}", e))?;
        
        if output.status.success() {
            Ok(PrintResult {
                success: true,
                message: "Printed to default system printer".to_string(),
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Print failed: {}", stderr))
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS: Use lp command
        let output = Command::new("lp")
            .arg(&file_path)
            .output()
            .map_err(|e| format!("Failed to execute lp command: {}", e))?;
        
        if output.status.success() {
            Ok(PrintResult {
                success: true,
                message: "Printed to default system printer".to_string(),
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Print failed: {}", stderr))
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Linux: Use lp or lpr command
        let output = Command::new("lp")
            .arg(&file_path)
            .output()
            .or_else(|_| {
                Command::new("lpr")
                    .arg(&file_path)
                    .output()
            })
            .map_err(|e| format!("Failed to execute print command: {}", e))?;
        
        if output.status.success() {
            Ok(PrintResult {
                success: true,
                message: "Printed to default system printer".to_string(),
            })
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Print failed: {}", stderr))
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Silent printing not supported on this platform".to_string())
    }
}
