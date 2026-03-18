/**
 * 未绑定手机号的登录用户：强制弹窗，短信验证后绑定。
 * 发送短信前需通过图形验证码（与手机号登录一致）。
 */
(() => {
    let root = null;
    let pendingResolve = null;
    let sendTimer = null;
    let captchaText = "";

    function showErr(text) {
        const alert = root?.querySelector("#phoneBindAlert");
        if (!alert) return;
        if (!text) {
            alert.classList.add("d-none");
            alert.textContent = "";
            return;
        }
        alert.textContent = text;
        alert.classList.remove("d-none");
        root.querySelector("#phoneBindHint")?.classList.add("d-none");
    }

    function showHint(text) {
        const el = root?.querySelector("#phoneBindHint");
        if (!el) return;
        if (!text) {
            el.classList.add("d-none");
            el.textContent = "";
            return;
        }
        el.textContent = text;
        el.classList.remove("d-none");
        root.querySelector("#phoneBindAlert")?.classList.add("d-none");
    }

    function drawCaptcha() {
        const canvas = root?.querySelector("#phoneBindCaptchaCanvas");
        const input = root?.querySelector("#phoneBindCaptchaInput");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, w, h);
        const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        let text = "";
        for (let i = 0; i < 4; i++) {
            text += chars[Math.floor(Math.random() * chars.length)];
        }
        captchaText = text;
        ctx.font = "bold 24px Arial";
        ctx.textBaseline = "middle";
        for (let i = 0; i < text.length; i++) {
            ctx.fillStyle = `hsl(${Math.random() * 120 + 200}, 50%, 30%)`;
            ctx.fillText(text[i], 12 + i * 26, h / 2);
        }
        for (let i = 0; i < 4; i++) {
            ctx.strokeStyle = "rgba(0,0,0,0.1)";
            ctx.beginPath();
            ctx.moveTo(Math.random() * w, 0);
            ctx.lineTo(Math.random() * w, h);
            ctx.stroke();
        }
        if (input) input.value = "";
        updateSendBtnState();
    }

    function isCaptchaOk() {
        const input = root?.querySelector("#phoneBindCaptchaInput");
        return input && captchaText && input.value.trim().toUpperCase() === captchaText;
    }

    function updateSendBtnState() {
        const sendBtn = root?.querySelector("#phoneBindSendBtn");
        if (!sendBtn || sendTimer != null) return;
        const phone = root.querySelector("#phoneBindInput")?.value.trim() || "";
        const phoneOk = /^1\d{10}$/.test(phone);
        sendBtn.disabled = !phoneOk || !isCaptchaOk();
    }

    function create() {
        root = document.createElement("div");
        root.className = "phone-bind-backdrop d-none";
        root.setAttribute("role", "dialog");
        root.setAttribute("aria-modal", "true");
        root.setAttribute("aria-labelledby", "phoneBindTitle");
        root.innerHTML = `
            <div class="phone-bind-card card shadow-lg border-0">
                <button type="button" id="phoneBindCloseBtn" class="phone-bind-close-btn" title="关闭并退出登录" aria-label="关闭并退出登录">
                    <i class="bi bi-x-lg"></i>
                </button>
                <div class="card-body p-4">
                    <h5 class="mb-2 pe-5" id="phoneBindTitle">
                        <i class="bi bi-phone me-2 text-primary"></i>绑定手机号
                    </h5>
                    <p class="small text-secondary mb-3">请先完成图形验证，再获取短信验证码并绑定手机号。</p>
                    <div id="phoneBindAlert" class="alert alert-danger py-2 small d-none mb-2"></div>
                    <div id="phoneBindHint" class="alert alert-warning py-2 small d-none mb-2"></div>
                    <label class="form-label small text-secondary mb-1">手机号</label>
                    <input type="tel" id="phoneBindInput" class="form-control mb-2" placeholder="11位中国大陆手机号" maxlength="11" autocomplete="tel">
                    <label class="form-label small text-secondary mb-1">图形验证码</label>
                    <div class="d-flex align-items-start gap-2 mb-2">
                        <div class="flex-shrink-0">
                            <canvas id="phoneBindCaptchaCanvas" width="120" height="40" class="border rounded" title="点击刷新"></canvas>
                        </div>
                        <input type="text" id="phoneBindCaptchaInput" class="form-control" placeholder="输入右侧字符" maxlength="4" autocomplete="off">
                    </div>
                    <label class="form-label small text-secondary mb-1">短信验证码</label>
                    <div class="d-flex gap-2 mb-3">
                        <input type="text" id="phoneBindCodeInput" class="form-control" placeholder="短信验证码" maxlength="8" autocomplete="one-time-code">
                        <button type="button" id="phoneBindSendBtn" class="btn btn-outline-secondary flex-shrink-0" style="min-width:108px">获取验证码</button>
                    </div>
                    <button type="button" id="phoneBindSubmitBtn" class="btn btn-primary w-100">
                        <i class="bi bi-check2-circle me-1"></i>确认绑定
                    </button>
                </div>
            </div>`;
        document.body.appendChild(root);

        function closeAndLogout() {
            if (sendTimer) {
                clearInterval(sendTimer);
                sendTimer = null;
            }
            pendingResolve = null;
            root.classList.add("d-none");
            document.body.classList.remove("phone-bind-open");
            ApiClient.clearSession();
            location.href = "./login.html";
        }

        root.querySelector("#phoneBindCloseBtn").addEventListener("click", closeAndLogout);

        const sendBtn = root.querySelector("#phoneBindSendBtn");
        const submitBtn = root.querySelector("#phoneBindSubmitBtn");
        const canvas = root.querySelector("#phoneBindCaptchaCanvas");

        canvas.addEventListener("click", () => drawCaptcha());
        root.querySelector("#phoneBindCaptchaInput").addEventListener("input", updateSendBtnState);
        root.querySelector("#phoneBindCaptchaInput").addEventListener("paste", () => setTimeout(updateSendBtnState, 0));
        root.querySelector("#phoneBindInput").addEventListener("input", updateSendBtnState);

        function startCooldown(sec) {
            if (sendTimer) clearInterval(sendTimer);
            let left = sec;
            sendBtn.disabled = true;
            sendBtn.textContent = `${left}s`;
            sendTimer = setInterval(() => {
                left--;
                if (left <= 0) {
                    clearInterval(sendTimer);
                    sendTimer = null;
                    updateSendBtnState();
                    sendBtn.textContent = "获取验证码";
                } else {
                    sendBtn.textContent = `${left}s`;
                }
            }, 1000);
        }

        sendBtn.addEventListener("click", async () => {
            const phone = root.querySelector("#phoneBindInput").value.trim();
            if (!/^1\d{10}$/.test(phone)) {
                showErr("请输入正确的11位手机号");
                return;
            }
            if (!isCaptchaOk()) {
                showErr("请先正确输入图形验证码");
                return;
            }
            showErr("");
            showHint("");
            sendBtn.disabled = true;
            try {
                const data = await ApiClient.requestJson("/auth/bind-phone/send-code", {
                    method: "POST",
                    body: JSON.stringify({ phone }),
                });
                showErr("");
                if (data.hint) {
                    showHint((data.message || "") + " " + data.hint);
                } else {
                    showHint(data.message || "验证码已发送，请留意手机短信");
                    setTimeout(() => showHint(""), 6000);
                }
                drawCaptcha();
                startCooldown(60);
            } catch (e) {
                showErr(e.message || "发送失败");
                drawCaptcha();
                updateSendBtnState();
                sendBtn.textContent = "获取验证码";
            }
        });

        submitBtn.addEventListener("click", async () => {
            const phone = root.querySelector("#phoneBindInput").value.trim();
            const code = root.querySelector("#phoneBindCodeInput").value.trim();
            if (!/^1\d{10}$/.test(phone)) {
                showErr("请输入正确的手机号");
                return;
            }
            if (!code) {
                showErr("请输入短信验证码");
                return;
            }
            showErr("");
            showHint("");
            submitBtn.disabled = true;
            try {
                const data = await ApiClient.requestJson("/auth/bind-phone", {
                    method: "POST",
                    body: JSON.stringify({ phone, code }),
                });
                ApiClient.setSession(data.accessToken, data.user);
                root.classList.add("d-none");
                document.body.classList.remove("phone-bind-open");
                const r = pendingResolve;
                pendingResolve = null;
                if (r) r();
            } catch (e) {
                showErr(e.message || "绑定失败");
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    function show() {
        if (!root) create();
        root.querySelector("#phoneBindInput").value = "";
        root.querySelector("#phoneBindCodeInput").value = "";
        showErr("");
        showHint("");
        const sendBtn = root.querySelector("#phoneBindSendBtn");
        if (sendTimer) {
            clearInterval(sendTimer);
            sendTimer = null;
        }
        sendBtn.textContent = "获取验证码";
        drawCaptcha();
        root.classList.remove("d-none");
        document.body.classList.add("phone-bind-open");
        root.querySelector("#phoneBindInput").focus();
    }

    async function ensureBound() {
        const token = ApiClient.getToken();
        if (!token) return;
        let profile;
        try {
            profile = await ApiClient.requestJson("/auth/me", { noRedirectOn401: true });
        } catch {
            return;
        }
        if (!profile?.user) return;
        if (profile.user.phone) {
            ApiClient.setSession(token, profile.user);
            return;
        }
        return new Promise((resolve) => {
            pendingResolve = resolve;
            show();
        });
    }

    window.PhoneBindModal = { ensureBound };
})();
