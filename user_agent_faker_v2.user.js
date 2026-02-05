// ==UserScript==
// @name         Auto User Agent Faker PRO
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Fake User Agent mạnh mẽ với giao diện điều khiển trực quan
// @author       Manus
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-start
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // Lấy giá trị đã lưu
    let savedUA = GM_getValue("custom_user_agent", "");

    // Hàm ghi đè User Agent (Dùng cơ chế defineProperty mạnh mẽ hơn)
    function spoofUA(uaString) {
        if (!uaString) return;

        const overwrite = (obj, prop, value) => {
            try {
                Object.defineProperty(obj, prop, {
                    get: () => value,
                    set: (v) => {},
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {}
        };

        // Ghi đè các thuộc tính chính
        overwrite(navigator, 'userAgent', uaString);
        overwrite(navigator, 'appVersion', uaString.replace("Mozilla/", ""));
        
        // Giả lập Platform dựa trên UA
        let platform = "Win32";
        if (uaString.includes("Android")) platform = "Linux armv8l";
        else if (uaString.includes("iPhone") || uaString.includes("iPad")) platform = "iPhone";
        else if (uaString.includes("Mac")) platform = "MacIntel";
        else if (uaString.includes("Linux")) platform = "Linux x86_64";
        
        overwrite(navigator, 'platform', platform);

        // Vô hiệu hóa UserAgentData (để tránh bị lộ trên Chrome mới)
        if (navigator.userAgentData) {
            overwrite(navigator, 'userAgentData', undefined);
        }
    }

    // Thực thi ghi đè ngay lập tức
    if (savedUA) {
        spoofUA(savedUA);
    }

    // --- PHẦN GIAO DIỆN (UI) ---
    function initUI() {
        // Tránh tạo UI nhiều lần
        if (document.getElementById('ua-manager-root')) return;

        const root = document.createElement('div');
        root.id = 'ua-manager-root';
        const shadow = root.attachShadow({mode: 'open'});

        const style = document.createElement('style');
        style.textContent = `
            #toggle-btn {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 45px;
                height: 45px;
                background: #007bff;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 999999;
                font-weight: bold;
                font-family: sans-serif;
                user-select: none;
                transition: transform 0.2s;
            }
            #toggle-btn:hover { transform: scale(1.1); background: #0056b3; }
            
            #panel {
                position: fixed;
                bottom: 75px;
                right: 20px;
                width: 300px;
                background: #ffffff;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                z-index: 999999;
                display: none;
                flex-direction: column;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                border: 1px solid #eee;
            }
            .header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .header h3 { margin: 0; font-size: 16px; color: #333; }
            .content { padding: 15px; max-height: 400px; overflow-y: auto; }
            .field { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-size: 12px; color: #666; font-weight: bold; }
            select, textarea {
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 13px;
                box-sizing: border-box;
            }
            textarea { height: 80px; resize: vertical; }
            .btn-group { display: flex; gap: 10px; }
            button {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
                transition: opacity 0.2s;
            }
            .btn-save { background: #28a745; color: white; }
            .btn-reset { background: #dc3545; color: white; }
            button:hover { opacity: 0.9; }
            .status { margin-top: 10px; font-size: 11px; color: #888; text-align: center; }
        `;

        const panel = document.createElement('div');
        panel.id = 'panel';
        
        const UA_PRESETS = [
            { name: "Mặc định trình duyệt", value: "" },
            { name: "Android 10 - RMX2030", value: "Mozilla/5.0 (Linux; Android 10; RMX2030 Build/QKQ1.200209.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.83 Mobile Safari/537.36" },
            { name: "iPhone iOS 14", value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/107.0.310639584 Mobile/15E148 Safari/604.1" },
            { name: "Windows Chrome 120", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
            { name: "Mac Safari", value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15" }
        ];

        panel.innerHTML = `
            <div class="header">
                <h3>UA Faker Control</h3>
                <span id="close-btn" style="cursor:pointer; font-size:20px;">&times;</span>
            </div>
            <div class="content">
                <div class="field">
                    <label>Chọn nhanh mẫu:</label>
                    <select id="ua-select">
                        ${UA_PRESETS.map(p => `<option value="${p.value}" ${p.value === savedUA ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="field">
                    <label>User Agent String:</label>
                    <textarea id="ua-input" placeholder="Dán User Agent vào đây...">${savedUA}</textarea>
                </div>
                <div class="btn-group">
                    <button id="save-btn" class="btn-save">Lưu & Reload</button>
                    <button id="reset-btn" class="btn-reset">Xóa hết</button>
                </div>
                <div class="status">
                    Trạng thái: <b>${savedUA ? 'Đang Fake' : 'Mặc định'}</b>
                </div>
            </div>
        `;

        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'toggle-btn';
        toggleBtn.innerHTML = 'UA';

        shadow.appendChild(style);
        shadow.appendChild(toggleBtn);
        shadow.appendChild(panel);
        document.body.appendChild(root);

        // Sự kiện
        toggleBtn.onclick = () => {
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        };

        shadow.getElementById('close-btn').onclick = () => {
            panel.style.display = 'none';
        };

        shadow.getElementById('ua-select').onchange = (e) => {
            shadow.getElementById('ua-input').value = e.target.value;
        };

        shadow.getElementById('save-btn').onclick = () => {
            const val = shadow.getElementById('ua-input').value.trim();
            GM_setValue("custom_user_agent", val);
            location.reload();
        };

        shadow.getElementById('reset-btn').onclick = () => {
            GM_setValue("custom_user_agent", "");
            location.reload();
        };
    }

    // Khởi tạo UI khi trang sẵn sàng
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initUI();
    } else {
        window.addEventListener('DOMContentLoaded', initUI);
    }

    // Thêm menu chuột phải của Tampermonkey
    GM_registerMenuCommand("Mở bảng điều khiển UA", () => {
        const root = document.getElementById('ua-manager-root');
        if (root && root.shadowRoot) {
            root.shadowRoot.getElementById('panel').style.display = 'flex';
        }
    });
})();
