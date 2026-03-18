const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const wechatStartBtn = document.getElementById("wechatStartBtn");
const wechatQrBox = document.getElementById("wechatQrBox");
const wechatSessionToken = document.getElementById("wechatSessionToken");
const wechatPhone = document.getElementById("wechatPhone");
const sendSmsBtn = document.getElementById("sendSmsBtn");
const wechatVerifyForm = document.getElementById("wechatVerifyForm");
const wechatQrModalBackdrop = document.getElementById("wechatQrModalBackdrop");
const closeWechatQrModalBtn = document.getElementById("closeWechatQrModalBtn");
const wechatBindModalBackdrop = document.getElementById("wechatBindModalBackdrop");
const closeWechatBindModalBtn = document.getElementById("closeWechatBindModalBtn");
const msg = document.getElementById("msg");
const tabButtons = Array.from(document.querySelectorAll("[data-auth-tab]"));
const tabPanels = Array.from(document.querySelectorAll("[data-auth-panel]"));

let currentWechatState = "";
let pollTimer = 0;

function activateTab(tabName) {
    tabButtons.forEach((btn) => {
        const active = btn.getAttribute("data-auth-tab") === tabName;
        btn.classList.toggle("active", active);
    });
    tabPanels.forEach((panel) => {
        const showPanel = panel.getAttribute("data-auth-panel") === tabName;
        panel.classList.toggle("d-none", !showPanel);
    });
}

function openModal(el) {
    el?.classList.remove("d-none");
}

function closeModal(el) {
    el?.classList.add("d-none");
}

function show(text, type = "success") {
    if (type === "danger" && window.AppDialog && typeof AppDialog.error === "function") {
        AppDialog.error(text);
        return;
    }
    msg.textContent = text;
    msg.className = `alert alert-${type} mt-3 py-2 mb-0`;
    msg.classList.remove("d-none");
}

function setBtnLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
        if (!button.dataset.rawText) button.dataset.rawText = button.textContent;
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${text || "处理中..."}`;
        return;
    }
    button.disabled = false;
    if (button.dataset.rawText) button.textContent = button.dataset.rawText;
}

function getRedirectTarget() {
    const params = new URLSearchParams(location.search);
    const redirect = params.get("redirect") || "index.html";
    return `./${redirect}`;
}

async function handleAuthSuccess(data) {
    ApiClient.setSession(data.accessToken, data.user);
    if (!data.user?.phone && window.PhoneBindModal) {
        await PhoneBindModal.ensureBound();
    }
    show("登录成功，正在跳转...");
    setTimeout(() => {
        location.href = getRedirectTarget();
    }, 300);
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = document.getElementById("loginBtn");
    setBtnLoading(btn, true, "登录中...");
    try {
        const payload = {
            username: document.getElementById("loginUsername").value.trim(),
            password: document.getElementById("loginPassword").value,
        };
        const data = await ApiClient.requestJson("/auth/login", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await handleAuthSuccess(data);
    } catch (error) {
        show(error.message, "danger");
    } finally {
        setBtnLoading(btn, false);
    }
});

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("registerPassword").value;
    const passwordConfirm = document.getElementById("registerPasswordConfirm").value;
    if (password !== passwordConfirm) {
        show("两次输入的密码不一致", "danger");
        return;
    }
    const btn = document.getElementById("registerBtn");
    setBtnLoading(btn, true, "注册中...");
    try {
        const payload = {
            username: document.getElementById("registerUsername").value.trim(),
            password,
            phone: "",
        };
        const data = await ApiClient.requestJson("/auth/register", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        await handleAuthSuccess(data);
    } catch (error) {
        show(error.message, "danger");
    } finally {
        setBtnLoading(btn, false);
    }
});

function stopWechatPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = 0;
    }
}

async function pollWechatStatus(state) {
    stopWechatPolling();
    pollTimer = setInterval(async () => {
        try {
            const data = await ApiClient.requestJson(`/auth/wechat/status?state=${encodeURIComponent(state)}`);
            if (data?.sessionToken) {
                wechatSessionToken.value = data.sessionToken;
            }
            if (data?.scanned) {
                stopWechatPolling();
                closeModal(wechatQrModalBackdrop);
                openModal(wechatBindModalBackdrop);
                show("扫码成功，请完成手机号验证码绑定", "info");
                return;
            }
            if (data?.phoneVerified) {
                stopWechatPolling();
            }
        } catch {
            // ignore polling errors
        }
    }, 2000);
}

wechatStartBtn.addEventListener("click", async () => {
    setBtnLoading(wechatStartBtn, true, "生成中...");
    try {
        const data = await ApiClient.requestJson("/auth/wechat/qr");
        currentWechatState = data.state;
        wechatQrBox.innerHTML = `<a href="${data.qrUrl}" target="_blank" rel="noopener noreferrer">点击打开微信扫码页面</a><div class="small text-secondary mt-2">状态轮询中，请扫码后返回本页继续短信验证</div>`;
        openModal(wechatQrModalBackdrop);
        await pollWechatStatus(currentWechatState);
        show("请在新窗口完成微信扫码", "info");
    } catch (error) {
        show(error.message, "danger");
    } finally {
        setBtnLoading(wechatStartBtn, false);
    }
});

closeWechatQrModalBtn?.addEventListener("click", () => {
    closeModal(wechatQrModalBackdrop);
    stopWechatPolling();
});

closeWechatBindModalBtn?.addEventListener("click", () => {
    closeModal(wechatBindModalBackdrop);
});

wechatQrModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === wechatQrModalBackdrop) {
        closeModal(wechatQrModalBackdrop);
        stopWechatPolling();
    }
});

wechatBindModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === wechatBindModalBackdrop) {
        closeModal(wechatBindModalBackdrop);
    }
});

tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-auth-tab");
        if (tab) {
            activateTab(tab);
            if (tab === "phoneLogin") drawCaptcha();
        }
    });
});

// ---------- 手机号登录：图形验证码 ----------
const captchaCanvas = document.getElementById("captchaCanvas");
const captchaInput = document.getElementById("captchaInput");
const sendPhoneLoginSmsBtn = document.getElementById("sendPhoneLoginSmsBtn");
const phoneLoginForm = document.getElementById("phoneLoginForm");

let currentCaptchaText = "";

function drawCaptcha() {
    if (!captchaCanvas) return;
    const ctx = captchaCanvas.getContext("2d");
    const w = captchaCanvas.width;
    const h = captchaCanvas.height;
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, w, h);
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let text = "";
    for (let i = 0; i < 4; i++) {
        text += chars[Math.floor(Math.random() * chars.length)];
    }
    currentCaptchaText = text;
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
    captchaInput.value = "";
    updateSendSmsButtonState();
}

function isCaptchaVerified() {
    return captchaInput && currentCaptchaText && captchaInput.value.trim().toUpperCase() === currentCaptchaText;
}

function updateSendSmsButtonState() {
    if (sendPhoneLoginSmsBtn) {
        const phone = document.getElementById("phoneLoginPhone");
        const phoneOk = phone && /^1\d{10}$/.test(phone.value.trim());
        sendPhoneLoginSmsBtn.disabled = !phoneOk || !isCaptchaVerified();
    }
}

if (captchaCanvas) {
    captchaCanvas.addEventListener("click", drawCaptcha);
}
if (captchaInput) {
    captchaInput.addEventListener("input", updateSendSmsButtonState);
    captchaInput.addEventListener("paste", () => setTimeout(updateSendSmsButtonState, 0));
}
const phoneLoginPhoneEl = document.getElementById("phoneLoginPhone");
if (phoneLoginPhoneEl) {
    phoneLoginPhoneEl.addEventListener("input", updateSendSmsButtonState);
}

sendPhoneLoginSmsBtn?.addEventListener("click", async () => {
    const phone = document.getElementById("phoneLoginPhone").value.trim();
    if (!/^1\d{10}$/.test(phone)) return show("请输入正确的手机号", "danger");
    if (!isCaptchaVerified()) return show("请先正确输入图形验证码", "danger");
    setBtnLoading(sendPhoneLoginSmsBtn, true, "发送中...");
    try {
        const smsData = await ApiClient.requestJson("/auth/sms/send", {
            method: "POST",
            body: JSON.stringify({
                phone,
                purpose: "PHONE_LOGIN",
            }),
        });
        if (smsData.hint) {
            show((smsData.message || "提示") + "。" + smsData.hint, "warning");
        } else {
            show(smsData.message || "验证码已发送，请注意查收");
        }
        drawCaptcha();
    } catch (error) {
        show(error.message, "danger");
    } finally {
        setBtnLoading(sendPhoneLoginSmsBtn, false);
    }
});

phoneLoginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const phone = document.getElementById("phoneLoginPhone").value.trim();
    const code = document.getElementById("phoneLoginCode").value.trim();
    if (!phone || !code) {
        show("请输入手机号和短信验证码", "danger");
        return;
    }
    const btn = document.getElementById("phoneLoginBtn");
    setBtnLoading(btn, true, "登录中...");
    try {
        const data = await ApiClient.requestJson("/auth/login-by-phone", {
            method: "POST",
            body: JSON.stringify({ phone, code }),
        });
        await handleAuthSuccess(data);
    } catch (error) {
        show(error.message, "danger");
    } finally {
        setBtnLoading(btn, false);
    }
});

sendSmsBtn.addEventListener("click", async () => {
    const phone = wechatPhone.value.trim();
    if (!phone) return show("请先输入手机号", "danger");
    setBtnLoading(sendSmsBtn, true, "发送中...");
    try {
        const smsData = await ApiClient.requestJson("/auth/sms/send", {
            method: "POST",
            body: JSON.stringify({
                phone,
                purpose: "WECHAT_LOGIN",
            }),
        });
        if (smsData.hint) {
            show((smsData.message || "提示") + "。" + smsData.hint, "warning");
        } else {
            show(smsData.message || "验证码已发送，请注意查收");
        }
    } catch (error) {
        show(error.message, "danger");
    } finally {
        setBtnLoading(sendSmsBtn, false);
    }
});

wechatVerifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = document.getElementById("wechatVerifyBtn");
    setBtnLoading(btn, true, "验证中...");
    try {
        const payload = {
            sessionToken: wechatSessionToken.value.trim(),
            phone: wechatPhone.value.trim(),
            code: document.getElementById("wechatSmsCode").value.trim(),
        };
        const data = await ApiClient.requestJson("/auth/wechat/verify-phone", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        closeModal(wechatBindModalBackdrop);
        await handleAuthSuccess(data);
    } catch (error) {
        show(error.message, "danger");
    } finally {
        setBtnLoading(btn, false);
    }
});

(async () => {
    activateTab("phoneLogin");
    drawCaptcha();
    const profile = await ApiClient.validateMe();
    if (profile?.user?.id) {
        if (!profile.user.phone && window.PhoneBindModal) {
            await PhoneBindModal.ensureBound();
        }
        location.href = getRedirectTarget();
    }
})();
