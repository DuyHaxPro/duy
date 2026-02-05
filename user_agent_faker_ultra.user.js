// ==UserScript==
// @name         UA Faker Ultra Light (APK Fix)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Bản siêu tối giản, tự động đổi UA ngay lập tức, không cần UI để tránh lỗi trên APK.
// @author       Manus
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // DANH SÁCH USER AGENT (Bạn có thể thêm/sửa ở đây)
    const uaList = [
        "Mozilla/5.0 (Linux; Android 10; RMX2030 Build/QKQ1.200209.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.83 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SD1A.210817.036) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.152 Mobile Safari/537.36"
    ];

    // Chọn ngẫu nhiên 1 cái mỗi khi mở trang (hoặc cố định cái đầu tiên)
    const selectedUA = uaList[0]; 

    const script = document.createElement('script');
    script.textContent = `
        (function() {
            const targetUA = "${selectedUA}";
            const spoof = {
                get userAgent() { return targetUA; },
                get appVersion() { return targetUA.replace("Mozilla/", ""); },
                get platform() { return "Linux armv8l"; },
                get vendor() { return "Google Inc."; },
                get deviceMemory() { return 8; },
                get hardwareConcurrency() { return 8; }
            };
            
            // Ghi đè navigator cũ
            Object.defineProperty(window, 'navigator', {
                value: Object.create(navigator, Object.getOwnPropertyDescriptors(spoof)),
                configurable: false,
                writable: false
            });

            // Chặn UserAgentData mới
            if (navigator.userAgentData) {
                Object.defineProperty(navigator, 'userAgentData', {
                    get: () => undefined,
                    configurable: true
                });
            }
            
            console.log("UA Spoofed to: " + targetUA);
        })();
    `;
    
    // Chèn script vào vị trí đầu tiên của tài liệu
    (document.head || document.documentElement).appendChild(script);
    script.remove();

})();
