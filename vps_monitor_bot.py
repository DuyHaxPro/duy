import os
import platform
import socket
import datetime
import time
import psutil
import requests # Thêm thư viện requests
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, JobQueue

# --- Cấu hình Bot Telegram ---
# LƯU Ý: Thay thế các giá trị sau bằng BOT_TOKEN và CHAT_ID của bạn
BOT_TOKEN = "6669862304:AAEJ0ZXZnIgIO_73BBlEKqCwbFYs__BP6k0"
CHAT_ID = "1030274701" 

# --- Cấu hình Proxmox API ---
# Thay thế các giá trị sau bằng thông tin Proxmox của bạn
PROXMOX_HOST = "192.168.1.4" # Ví dụ: 192.168.1.100
PROXMOX_PORT = 8006
PROXMOX_NODE = "duyola" # Ví dụ: pve
# API Token: USER@REALM!TOKENID=UUID
PROXMOX_API_TOKEN = "root@pam!duy0394779196" 

# Danh sách các VM/CT được phép điều khiển (VMID: TYPE)
# Ví dụ: {100: "qemu", 101: "lxc"}
ALLOWED_VMS = {102} 

# --- Hàm lấy thông tin VPS (Không đổi) ---
def get_vps_info():
    """Lấy thông tin Uptime và IP Local của VPS."""
    
    # 1. Uptime
    uptime_seconds = time.time() - psutil.boot_time()
    uptime_duration = str(datetime.timedelta(seconds=int(uptime_seconds)))
    
    # 2. IP Local
    local_ip = "Không tìm thấy"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80)) 
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            pass
            
    message = (
        "💻 *Thông tin VPS Proxmox*\n\n"
        f"🟢 *Uptime (Thời gian hoạt động):* `{uptime_duration}`\n"
        f"🌐 *IP Local:* `{local_ip}`\n\n"
        "_(Thông tin được cập nhật lúc: {datetime.datetime.now().strftime('%H:%M:%S %d/%m/%Y')})_"
    )
    
    return message

# --- Hàm tương tác với Proxmox API ---
def proxmox_api_call(vmid: int, vm_type: str, action: str):
    """
    Thực hiện cuộc gọi API đến Proxmox để điều khiển VM/CT.
    action: 'reboot', 'start', 'stop', 'shutdown', 'reset'
    """
    url = f"https://{PROXMOX_HOST}:{PROXMOX_PORT}/api2/json/nodes/{PROXMOX_NODE}/{vm_type}/{vmid}/status/{action}"
    headers = {
        "Authorization": f"PVEAPIToken={PROXMOX_API_TOKEN}"
    }
    
    try:
        # Tắt kiểm tra SSL (vì Proxmox thường dùng self-signed cert)
        response = requests.post(url, headers=headers, verify=False)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        
        data = response.json()
        if 'data' in data and data['data'].startswith('UPID'):
            return True, f"Lệnh '{action}' cho VM/CT {vmid} đã được gửi thành công. Task ID: `{data['data']}`"
        else:
            return False, f"Lỗi không xác định từ Proxmox API: {data}"

    except requests.exceptions.RequestException as e:
        return False, f"Lỗi kết nối hoặc API: {e}"
    except Exception as e:
        return False, f"Lỗi chung: {e}"

# --- Hàm xử lý lệnh Telegram ---

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Xử lý lệnh /start."""
    await update.message.reply_text(
        "Chào mừng! Tôi là bot giám sát VPS của bạn.\n"
        "Sử dụng lệnh /status để kiểm tra thông tin VPS ngay lập tức.\n"
        "Sử dụng lệnh /reboot <VMID> để khởi động lại máy ảo Proxmox.\n"
        "Tôi cũng sẽ gửi thông báo tự động hàng ngày."
    )

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Xử lý lệnh /status để gửi thông tin VPS."""
    info_message = get_vps_info()
    await update.message.reply_text(info_message, parse_mode='Markdown')

async def reboot_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Xử lý lệnh /reboot <VMID>."""
    
    # Chỉ cho phép người dùng có CHAT_ID khớp với CHAT_ID cấu hình sử dụng lệnh này
    if str(update.message.chat_id) != CHAT_ID:
        await update.message.reply_text("Bạn không có quyền sử dụng lệnh này.")
        return

    if not context.args:
        # Liệt kê các VM được phép điều khiển
        vm_list = "\n".join([f"- VMID `{vmid}` (Type: {vm_type.upper()})" for vmid, vm_type in ALLOWED_VMS.items()])
        if not vm_list:
            vm_list = "Không có VM/CT nào được cấu hình trong ALLOWED_VMS."

        await update.message.reply_text(
            f"Vui lòng cung cấp VMID cần khởi động lại. Ví dụ: `/reboot 100`\n\n"
            f"*Danh sách VM/CT được phép điều khiển:*\n{vm_list}",
            parse_mode='Markdown'
        )
        return

    try:
        vmid = int(context.args[0])
    except ValueError:
        await update.message.reply_text("VMID không hợp lệ. Vui lòng nhập một số nguyên.")
        return

    if vmid not in ALLOWED_VMS:
        await update.message.reply_text(f"VMID `{vmid}` không được phép điều khiển hoặc chưa được cấu hình trong ALLOWED_VMS.", parse_mode='Markdown')
        return

    vm_type = ALLOWED_VMS[vmid]
    action = "reboot" # Sử dụng reboot (yêu cầu QEMU Guest Agent cho VM)

    await update.message.reply_text(f"Đang gửi lệnh *{action.upper()}* cho VM/CT `{vmid}` (Type: {vm_type.upper()}). Vui lòng chờ...", parse_mode='Markdown')

    success, result_message = proxmox_api_call(vmid, vm_type, action)

    if success:
        await update.message.reply_text(f"✅ *Thành công:*\n{result_message}", parse_mode='Markdown')
    else:
        await update.message.reply_text(f"❌ *Thất bại:*\n{result_message}", parse_mode='Markdown')


# --- Hàm lập lịch (Scheduled Job) (Không đổi) ---

async def scheduled_status_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Gửi thông báo trạng thái VPS theo lịch."""
    job = context.job
    info_message = get_vps_info()
    
    if CHAT_ID == "YOUR_CHAT_ID_HERE":
        print("Lỗi: CHAT_ID chưa được cấu hình. Không thể gửi thông báo theo lịch.")
        return

    try:
        await context.bot.send_message(
            chat_id=CHAT_ID, 
            text=info_message, 
            parse_mode='Markdown'
        )
        print(f"Đã gửi thông báo trạng thái theo lịch lúc {datetime.datetime.now()}")
    except Exception as e:
        print(f"Lỗi khi gửi thông báo theo lịch: {e}")

# --- Hàm chính ---

def main() -> None:
    """Chạy bot."""
    
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE" or CHAT_ID == "YOUR_CHAT_ID_HERE":
        print("LỖI CẤU HÌNH: Vui lòng thay thế 'YOUR_BOT_TOKEN_HERE' và 'YOUR_CHAT_ID_HERE' trong file vps_monitor_bot.py.")
        return
    
    # Kiểm tra cấu hình Proxmox
    if PROXMOX_HOST == "YOUR_PROXMOX_IP_OR_HOSTNAME" or PROXMOX_API_TOKEN == "YOUR_API_TOKEN":
        print("CẢNH BÁO: Cấu hình Proxmox API chưa đầy đủ. Chức năng /reboot sẽ không hoạt động.")


    # Tạo Application và truyền Bot's token
    application = Application.builder().token(BOT_TOKEN).build()

    # Lấy JobQueue từ Application
    job_queue = application.job_queue

    # --- Đăng ký Handlers ---
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("reboot", reboot_command)) # Thêm lệnh mới

    # --- Lập lịch thông báo tự động (Ví dụ: 9:00 sáng hàng ngày) ---
    job_queue.run_daily(
        scheduled_status_job, 
        time=datetime.time(hour=9, minute=0, tzinfo=datetime.timezone.utc), 
        days=(0, 1, 2, 3, 4, 5, 6), # Tất cả các ngày trong tuần
        name="daily_vps_status"
    )
    
    print("Bot đang chạy...")
    # Bắt đầu Polling
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
