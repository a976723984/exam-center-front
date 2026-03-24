(() => {
    if (!window.ApiClient) return;

    const MODAL_ID = "authPopupBackdrop";
    let initialized = false;
    let wechatPollTimer = 0;
    let wechatQrState = "";
    let phoneSmsCooldownTimer = 0;
    let wechatSmsCooldownTimer = 0;

    function escapeHtml(text) {
        return String(text || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function ensureModal() {
        let backdrop = document.getElementById(MODAL_ID);
        if (backdrop) return backdrop;

        backdrop = document.createElement("div");
        backdrop.id = MODAL_ID;
        backdrop.className = "auth-popup-backdrop d-none";
        backdrop.innerHTML = `
            <div class="auth-popup-card" role="dialog" aria-modal="true" aria-labelledby="authPopupTitle">
                <div class="d-flex align-items-center mb-2">
                    <h3 id="authPopupTitle" class="h6 mb-0">登录</h3>
                </div>
                <div id="authPopupMsg" class="alert alert-success py-2 mb-2 d-none"></div>
                <div class="auth-tabs" role="tablist" aria-label="登录方式">
                    <button class="auth-tab-btn active" type="button" data-auth-tab="phoneLogin">
                        <i class="bi bi-phone me-1"></i><span>手机号</span>
                    </button>
                    <button class="auth-tab-btn" type="button" data-auth-tab="wechatLogin">
                        <i class="bi bi-wechat me-1"></i><span>微信扫码</span>
                    </button>
                </div>

                <div class="auth-tab-panel mt-2" data-auth-panel="phoneLogin">
                    <form id="authPopupPhoneLoginForm" class="d-grid gap-2 mt-2">
                        <input id="authPopupPhone" class="form-control" placeholder="手机号" required maxlength="11">
                        <div class="d-flex gap-2">
                            <input id="authPopupPhoneCode" class="form-control" placeholder="短信验证码" maxlength="6">
                            <button id="authPopupSendSmsBtn" class="btn btn-outline-secondary flex-shrink-0" type="button" disabled>获取验证码</button>
                        </div>
                        <button id="authPopupPhoneLoginBtn" class="btn btn-primary" type="submit">登录</button>
                    </form>
                </div>

                <div class="auth-tab-panel d-none mt-2" data-auth-panel="wechatLogin">
                    <div class="d-grid gap-2 mt-2">
                        <div id="authPopupWechatQrBox" class="small text-secondary auth-wechat-box">二维码加载中...</div>
                        <div id="authPopupWechatHint" class="small text-secondary">请使用微信扫码并在微信内确认登录。</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        return backdrop;
    }

    function setMsg(text, type = "success") {
        const msg = document.getElementById("authPopupMsg");
        if (!msg) return;
        msg.textContent = text;
        msg.className = `alert alert-${type} py-2 mb-2`;
        msg.classList.remove("d-none");
    }

    function clearMsg() {
        const msg = document.getElementById("authPopupMsg");
        if (!msg) return;
        msg.classList.add("d-none");
        msg.textContent = "";
    }

    function setBtnLoading(button, loading, text = "处理中...") {
        if (!button) return;
        if (loading) {
            if (!button.dataset.rawText) button.dataset.rawText = button.textContent;
            button.disabled = true;
            button.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${escapeHtml(text)}`;
            return;
        }
        button.disabled = false;
        if (button.dataset.rawText) button.textContent = button.dataset.rawText;
    }

    function activateTab(name) {
        document.querySelectorAll("#" + MODAL_ID + " [data-auth-tab]").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-auth-tab") === name);
        });
        document.querySelectorAll("#" + MODAL_ID + " [data-auth-panel]").forEach((panel) => {
            panel.classList.toggle("d-none", panel.getAttribute("data-auth-panel") !== name);
        });
        if (name !== "wechatLogin") {
            stopWechatPolling();
        }
    }

    function stopWechatPolling() {
        if (wechatPollTimer) {
            clearInterval(wechatPollTimer);
            wechatPollTimer = 0;
        }
    }

    function stopCooldown(timerRefName) {
        if (timerRefName === "phone" && phoneSmsCooldownTimer) {
            clearInterval(phoneSmsCooldownTimer);
            phoneSmsCooldownTimer = 0;
        }
        if (timerRefName === "wechat" && wechatSmsCooldownTimer) {
            clearInterval(wechatSmsCooldownTimer);
            wechatSmsCooldownTimer = 0;
        }
    }

    function startSmsCooldown(button, timerRefName, seconds = 60) {
        stopCooldown(timerRefName);
        let left = seconds;
        button.disabled = true;
        button.textContent = `${left}s后重试`;
        const tick = () => {
            left -= 1;
            if (left <= 0) {
                stopCooldown(timerRefName);
                button.textContent = "获取验证码";
                button.disabled = false;
                return;
            }
            button.textContent = `${left}s后重试`;
        };
        if (timerRefName === "phone") {
            phoneSmsCooldownTimer = setInterval(tick, 1000);
        } else {
            wechatSmsCooldownTimer = setInterval(tick, 1000);
        }
    }

    async function pollWechatStatus(state, redirectFile) {
        stopWechatPolling();
        wechatQrState = state;
        wechatPollTimer = setInterval(async () => {
            try {
                const data = await ApiClient.requestJson(`/auth/wechat/status?state=${encodeURIComponent(state)}`);
                if (data?.accessToken && data?.user) {
                    stopWechatPolling();
                    await onAuthSuccess(data, redirectFile);
                    return;
                }
                if (data?.scanned) {
                    setMsg("扫码成功，等待微信确认登录...", "info");
                }
            } catch {
                // ignore polling errors
            }
        }, 2000);
    }

    async function ensureWechatQrReady() {
        const qrBox = document.getElementById("authPopupWechatQrBox");
        if (!qrBox) return;
        qrBox.textContent = "二维码加载中...";
        try {
            const data = await ApiClient.requestJson("/auth/wechat/qr");
            const qrUrl = String(data?.qrUrl || "").trim();
            if (!qrUrl) throw new Error("未获取到二维码地址");
            qrBox.innerHTML = `
                <div class="text-center">
                    <img src="${escapeHtml(qrUrl)}" alt="微信扫码登录二维码" style="max-width:220px;width:100%;height:auto;border-radius:8px;">
                </div>
                <div class="small mt-2">
                    若二维码未显示，请<a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener noreferrer">点击这里打开</a>
                </div>
            `;
            return data;
        } catch (error) {
            qrBox.innerHTML = `<span class="text-danger">${escapeHtml(error.message || "二维码加载失败")}</span>`;
            throw error;
        }
    }

    async function onAuthSuccess(data, redirectFile) {
        ApiClient.setSession(data.accessToken, data.user);
        if (typeof ApiClient.startUsagePing === "function") ApiClient.startUsagePing();
        if (!data.user?.phone && window.PhoneBindModal) {
            await PhoneBindModal.ensureBound();
        }
        setMsg("登录成功", "success");
        setTimeout(() => {
            close();
            const target = redirectFile || (location.pathname.split(/[\\/]/).pop() || "index.html");
            location.href = `./${target}`;
        }, 250);
    }

    function bindEvents() {
        if (initialized) return;
        initialized = true;
        const backdrop = ensureModal();
        let redirectFile = "";

        document.querySelectorAll("#" + MODAL_ID + " [data-auth-tab]").forEach((btn) => {
            btn.addEventListener("click", () => activateTab(btn.getAttribute("data-auth-tab")));
        });

        const phoneEl = document.getElementById("authPopupPhone");
        const codeEl = document.getElementById("authPopupPhoneCode");
        const sendSmsBtn = document.getElementById("authPopupSendSmsBtn");
        phoneEl?.addEventListener("input", () => {
            if (phoneSmsCooldownTimer) return;
            sendSmsBtn.disabled = !/^1\d{10}$/.test((phoneEl.value || "").trim());
        });
        sendSmsBtn?.addEventListener("click", async () => {
            const phone = (phoneEl?.value || "").trim();
            if (!/^1\d{10}$/.test(phone)) {
                setMsg("请输入正确手机号", "danger");
                return;
            }
            sendSmsBtn.disabled = true;
            try {
                const data = await ApiClient.requestJson("/auth/sms/send", {
                    method: "POST",
                    body: JSON.stringify({ phone, purpose: "PHONE_LOGIN" }),
                });
                setMsg(data.message || "验证码已发送", "success");
                startSmsCooldown(sendSmsBtn, "phone", 60);
            } catch (error) {
                setMsg(error.message || "发送失败", "danger");
                sendSmsBtn.disabled = false;
            }
        });

        document.getElementById("authPopupPhoneLoginForm")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const btn = document.getElementById("authPopupPhoneLoginBtn");
            const phone = (phoneEl?.value || "").trim();
            const code = (codeEl?.value || "").trim();
            if (!phone || !code) {
                setMsg("请输入手机号和验证码", "danger");
                return;
            }
            setBtnLoading(btn, true, "登录中...");
            try {
                const data = await ApiClient.requestJson("/auth/login-by-phone", {
                    method: "POST",
                    body: JSON.stringify({ phone, code }),
                });
                await onAuthSuccess(data, redirectFile);
            } catch (error) {
                setMsg(error.message || "登录失败", "danger");
            } finally {
                setBtnLoading(btn, false);
            }
        });

        window.AuthModal = {
            open(options = {}) {
                redirectFile = String(options.redirect || options.redirectFile || "").trim();
                clearMsg();
                activateTab("phoneLogin");
                stopWechatPolling();
                wechatQrState = "";
                const qrBox = document.getElementById("authPopupWechatQrBox");
                if (qrBox) qrBox.textContent = "二维码加载中...";
                backdrop.classList.remove("d-none");
                return true;
            },
            close,
        };

        // 当用户切到微信扫码页时自动拉取二维码并轮询
        const wechatTabBtn = document.querySelector(`#${MODAL_ID} [data-auth-tab="wechatLogin"]`);
        wechatTabBtn?.addEventListener("click", async () => {
            try {
                const qrData = await ensureWechatQrReady();
                if (qrData?.state) {
                    await pollWechatStatus(qrData.state, redirectFile);
                    setMsg("请使用微信扫码登录", "info");
                }
            } catch {
                // error already shown
            }
        });
    }

    function open(options = {}) {
        bindEvents();
        return window.AuthModal.open(options);
    }

    function close() {
        stopWechatPolling();
        const backdrop = document.getElementById(MODAL_ID);
        backdrop?.classList.add("d-none");
    }

    function parseRedirectFromHref(href) {
        if (!href) return "";
        try {
            const raw = href.includes("://") ? new URL(href).search : (href.split("?")[1] || "");
            const params = new URLSearchParams(raw);
            return params.get("redirect") || "";
        } catch {
            return "";
        }
    }

    document.addEventListener("click", (event) => {
        const anchor = event.target.closest("a[href]");
        if (!anchor) return;
        const href = String(anchor.getAttribute("href") || "").trim();
        if (!href) return;
        if (!href.includes("login.html")) return;
        if (location.pathname.endsWith("/login.html") || location.pathname.endsWith("\\login.html")) return;
        event.preventDefault();
        open({ redirect: parseRedirectFromHref(href) || location.pathname.split(/[\\/]/).pop() || "index.html" });
    });

    window.AuthModal = {
        open,
        close,
    };
})();
