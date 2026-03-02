use rusb::{Context, DeviceHandle, UsbContext};
use serde::{Deserialize, Serialize};
use std::time::Duration;

// Xprinter M804 USB identifiers (common values - may need adjustment)
// You can find your specific VID/PID using `lsusb` on Linux or Device Manager on Windows
const XPRINTER_VID: u16 = 0x0483; // Common Xprinter VID
const XPRINTER_PID: u16 = 0x5743; // Common Xprinter PID

// Alternative VID/PID pairs for Xprinter (try these if the above don't work)
const ALT_XPRINTER_VIDS: [(u16, u16); 4] = [
    (0x0416, 0x5011), // Some Xprinter models
    (0x0493, 0x8760), // Another variant
    (0x1FC9, 0x2016), // Yet another variant
    (0x04B8, 0x0202), // Epson compatible mode
];

// ESC/POS Commands
const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;

#[derive(Debug, Serialize, Deserialize)]
pub struct PrinterInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub name: String,
    pub connected: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrintResult {
    pub success: bool,
    pub message: String,
}

/// Find the Xprinter device
fn find_printer<T: UsbContext>(context: &T) -> Option<DeviceHandle<T>> {
    // Try primary VID/PID first
    if let Some(handle) = context.open_device_with_vid_pid(XPRINTER_VID, XPRINTER_PID) {
        log::info!("Found Xprinter at VID:{:04x} PID:{:04x}", XPRINTER_VID, XPRINTER_PID);
        return Some(handle);
    }

    // Try alternative VID/PIDs
    for (vid, pid) in ALT_XPRINTER_VIDS.iter() {
        if let Some(handle) = context.open_device_with_vid_pid(*vid, *pid) {
            log::info!("Found Xprinter at VID:{:04x} PID:{:04x}", vid, pid);
            return Some(handle);
        }
    }

    // Scan all devices and look for printer class
    if let Ok(devices) = context.devices() {
        for device in devices.iter() {
            if let Ok(desc) = device.device_descriptor() {
                // USB Printer class = 0x07
                if desc.class_code() == 0x07 {
                    if let Ok(handle) = device.open() {
                        log::info!(
                            "Found USB printer at VID:{:04x} PID:{:04x}",
                            desc.vendor_id(),
                            desc.product_id()
                        );
                        return Some(handle);
                    }
                }
            }
        }
    }

    None
}

/// Find the bulk OUT endpoint for the printer
fn find_bulk_out_endpoint<T: UsbContext>(handle: &DeviceHandle<T>) -> Option<u8> {
    let device = handle.device();
    let config_desc = device.active_config_descriptor().ok()?;

    for interface in config_desc.interfaces() {
        for desc in interface.descriptors() {
            for endpoint in desc.endpoint_descriptors() {
                if endpoint.direction() == rusb::Direction::Out
                    && endpoint.transfer_type() == rusb::TransferType::Bulk
                {
                    return Some(endpoint.address());
                }
            }
        }
    }

    // Default endpoint if not found
    Some(0x01)
}

/// List available printers
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let context = Context::new().map_err(|e| format!("Failed to create USB context: {}", e))?;
    let mut printers = Vec::new();

    if let Ok(devices) = context.devices() {
        for device in devices.iter() {
            if let Ok(desc) = device.device_descriptor() {
                // Check for printer class or known VID/PIDs
                let is_printer = desc.class_code() == 0x07
                    || (desc.vendor_id() == XPRINTER_VID && desc.product_id() == XPRINTER_PID)
                    || ALT_XPRINTER_VIDS
                        .iter()
                        .any(|(v, p)| desc.vendor_id() == *v && desc.product_id() == *p);

                if is_printer {
                    let name = if let Ok(handle) = device.open() {
                        handle
                            .read_product_string_ascii(&desc)
                            .unwrap_or_else(|_| "USB Printer".to_string())
                    } else {
                        "USB Printer".to_string()
                    };

                    printers.push(PrinterInfo {
                        vendor_id: desc.vendor_id(),
                        product_id: desc.product_id(),
                        name,
                        connected: device.open().is_ok(),
                    });
                }
            }
        }
    }

    Ok(printers)
}

/// Print raw ESC/POS data to the thermal printer
pub fn print_escpos(data: Vec<u8>) -> Result<PrintResult, String> {
    let context = Context::new().map_err(|e| format!("Failed to create USB context: {}", e))?;

    let handle = find_printer(&context).ok_or("No Xprinter found. Please check USB connection.")?;

    // Try to detach kernel driver if necessary (Linux)
    #[cfg(target_os = "linux")]
    {
        if handle.kernel_driver_active(0).unwrap_or(false) {
            handle.detach_kernel_driver(0).ok();
        }
    }

    // Claim the interface
    handle
        .claim_interface(0)
        .map_err(|e| format!("Failed to claim interface: {}", e))?;

    // Find bulk OUT endpoint
    let endpoint = find_bulk_out_endpoint(&handle).unwrap_or(0x01);

    // Initialize printer first
    let init_cmd: Vec<u8> = vec![ESC, 0x40];
    handle
        .write_bulk(endpoint, &init_cmd, Duration::from_secs(2))
        .map_err(|e| format!("Failed to initialize printer: {}", e))?;

    // Write the ESC/POS data
    let timeout = Duration::from_secs(5);
    let bytes_written = handle
        .write_bulk(endpoint, &data, timeout)
        .map_err(|e| format!("Failed to write to printer: {}", e))?;

    // Release interface
    handle.release_interface(0).ok();

    Ok(PrintResult {
        success: true,
        message: format!("Printed {} bytes successfully", bytes_written),
    })
}

/// Test printer connection by printing a test page
pub fn test_printer() -> Result<PrintResult, String> {
    let context = Context::new().map_err(|e| format!("Failed to create USB context: {}", e))?;

    let handle = find_printer(&context).ok_or("No Xprinter found. Please check USB connection.")?;

    #[cfg(target_os = "linux")]
    {
        if handle.kernel_driver_active(0).unwrap_or(false) {
            handle.detach_kernel_driver(0).ok();
        }
    }

    handle
        .claim_interface(0)
        .map_err(|e| format!("Failed to claim interface: {}", e))?;

    let endpoint = find_bulk_out_endpoint(&handle).unwrap_or(0x01);
    let timeout = Duration::from_secs(5);

    // Build test page
    let mut test_data: Vec<u8> = Vec::new();

    // Initialize
    test_data.extend_from_slice(&[ESC, 0x40]);

    // Center align
    test_data.extend_from_slice(&[ESC, 0x61, 0x01]);

    // Bold on, double size
    test_data.extend_from_slice(&[ESC, 0x45, 0x01]);
    test_data.extend_from_slice(&[GS, 0x21, 0x11]);
    test_data.extend_from_slice(b"PRINTER TEST\n");

    // Normal size
    test_data.extend_from_slice(&[GS, 0x21, 0x00]);
    test_data.extend_from_slice(&[ESC, 0x45, 0x00]);

    test_data.extend_from_slice(b"\n");
    test_data.extend_from_slice(b"------------------------\n");
    test_data.extend_from_slice(b"New Era Cafeteria POS\n");
    test_data.extend_from_slice(b"Xprinter M804 Connected\n");
    test_data.extend_from_slice(b"------------------------\n");
    test_data.extend_from_slice(b"\n");
    test_data.extend_from_slice(b"If you can read this,\n");
    test_data.extend_from_slice(b"your printer is working!\n");
    test_data.extend_from_slice(b"\n\n\n");

    // Partial cut
    test_data.extend_from_slice(&[GS, 0x56, 0x01]);

    handle
        .write_bulk(endpoint, &test_data, timeout)
        .map_err(|e| format!("Failed to print test page: {}", e))?;

    handle.release_interface(0).ok();

    Ok(PrintResult {
        success: true,
        message: "Test page printed successfully".to_string(),
    })
}

/// Open the cash drawer
pub fn open_cash_drawer() -> Result<PrintResult, String> {
    let context = Context::new().map_err(|e| format!("Failed to create USB context: {}", e))?;

    let handle = find_printer(&context).ok_or("No Xprinter found. Please check USB connection.")?;

    #[cfg(target_os = "linux")]
    {
        if handle.kernel_driver_active(0).unwrap_or(false) {
            handle.detach_kernel_driver(0).ok();
        }
    }

    handle
        .claim_interface(0)
        .map_err(|e| format!("Failed to claim interface: {}", e))?;

    let endpoint = find_bulk_out_endpoint(&handle).unwrap_or(0x01);

    // Cash drawer kick command: ESC p 0 25 250
    let drawer_cmd: Vec<u8> = vec![ESC, 0x70, 0x00, 0x19, 0xFA];

    handle
        .write_bulk(endpoint, &drawer_cmd, Duration::from_secs(2))
        .map_err(|e| format!("Failed to open cash drawer: {}", e))?;

    handle.release_interface(0).ok();

    Ok(PrintResult {
        success: true,
        message: "Cash drawer opened".to_string(),
    })
}
