(() => {
    const API_BASE = "http://47.96.238.250:8081/api";
    const APP_CLIENT_VERSION = "web-1.0.0";
    const TOKEN_KEY = "exam_center_access_token";
    const USER_KEY = "exam_center_user";
    let usagePingTimer = null;
    const GLOBAL_ERROR_MODAL_ID = "globalErrorModalBackdrop";

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || "";
    }

    function setSession(token, user) {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        }
        if (user) {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        if (usagePingTimer != null) {
            clearInterval(usagePingTimer);
            usagePingTimer = null;
        }
    }

    function getUser() {
        try {
            const text = localStorage.getItem(USER_KEY);
            return text ? JSON.parse(text) : null;
        } catch {
            return null;
        }
    }

    function getDisplayName(user = null) {
        const u = user || getUser() || {};
        const rawName = typeof u.name === "string" ? u.name.trim() : "";
        if (rawName) return rawName;
        const rawUsername = typeof u.username === "string" ? u.username.trim() : "";
        if (rawUsername) return rawUsername;
        const id = u.id != null ? String(u.id).trim() : "";
        if (id) return `小白塔_${id}`;
        return "";
    }

    function toLogin(keepPath = true) {
        const isLoginPage = location.pathname.endsWith("/login.html") || location.pathname.endsWith("\\login.html");
        if (isLoginPage) return;
        const redirect = keepPath ? (location.pathname.split(/[\\/]/).pop() || "index.html") : "index.html";
        if (window.AuthModal && typeof window.AuthModal.open === "function") {
            const opened = window.AuthModal.open({ redirect });
            if (opened) return;
        }
        location.href = `./login.html?redirect=${encodeURIComponent(redirect)}`;
    }

    function requireAuth() {
        if (!getToken()) {
            toLogin(true);
            return false;
        }
        return true;
    }

    async function parseJsonSafe(res) {
        try {
            return await res.json();
        } catch {
            return null;
        }
    }

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }
        const token = getToken();
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (res.status === 401) {
            clearSession();
            if (!options.noRedirectOn401) {
                toLogin(true);
            }
            let msg = "登录已失效，请重新登录";
            try {
                const errBody = await res.json();
                if (errBody && typeof errBody.message === "string" && errBody.message.trim()) {
                    msg = errBody.message.trim();
                }
            } catch (_) {}
            throw new Error(msg);
        }
        return res;
    }

    async function requestJson(path, options = {}) {
        const res = await request(path, options);
        const data = await parseJsonSafe(res);
        if (!res.ok) {
            throw new Error(data?.message || `请求失败(${res.status})`);
        }
        return data;
    }

    async function validateMe() {
        const token = getToken();
        if (!token) return null;
        try {
            const data = await requestJson("/auth/me", { noRedirectOn401: true });
            if (data?.user) {
                setSession(token, data.user);
            }
            startUsagePing();
            return data;
        } catch {
            clearSession();
            return null;
        }
    }

    function startUsagePing() {
        if (usagePingTimer != null) return;
        const run = async () => {
            const token = getToken();
            if (!token) return;
            try {
                await requestJson("/telemetry/ping", {
                    method: "POST",
                    body: JSON.stringify({ clientVersion: APP_CLIENT_VERSION }),
                    noRedirectOn401: true,
                });
            } catch (_) {
                /* 静默失败，避免打断主流程 */
            }
        };
        run();
        usagePingTimer = setInterval(run, 5 * 60 * 1000);
    }

    window.ApiClient = {
        API_BASE,
        APP_CLIENT_VERSION,
        getToken,
        setSession,
        clearSession,
        getUser,
        getDisplayName,
        toLogin,
        requireAuth,
        request,
        requestJson,
        parseJsonSafe,
        validateMe,
        startUsagePing,
    };

    function ensureErrorModal() {
        let root = document.getElementById(GLOBAL_ERROR_MODAL_ID);
        if (root) return root;
        root = document.createElement("div");
        root.id = GLOBAL_ERROR_MODAL_ID;
        root.className = "app-modal-backdrop d-none";
        root.innerHTML = `
            <div class="app-modal-card">
                <div class="d-flex justify-content-between align-items-start gap-3">
                    <div>
                        <div id="globalErrorModalTitle" class="fw-semibold">提示</div>
                    </div>
                </div>
                <div id="globalErrorModalMsg" class="mt-3 text-secondary" style="white-space: pre-wrap;"></div>
                <div class="mt-4 d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-primary" id="globalErrorModalOkBtn">我知道了</button>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        const close = () => root.classList.add("d-none");
        root.addEventListener("click", (e) => {
            if (e.target === root) close();
        });
        root.querySelector("#globalErrorModalOkBtn")?.addEventListener("click", close);
        return root;
    }

    window.AppDialog = {
        alert(message, opts = {}) {
            const root = ensureErrorModal();
            const title = typeof opts.title === "string" && opts.title.trim() ? opts.title.trim() : "提示";
            root.querySelector("#globalErrorModalTitle").textContent = title;
            root.querySelector("#globalErrorModalMsg").textContent = String(message || "");
            root.classList.remove("d-none");
        },
        error(message, title = "操作失败") {
            const root = ensureErrorModal();
            root.querySelector("#globalErrorModalTitle").textContent = title;
            root.querySelector("#globalErrorModalMsg").textContent = String(message || "请求失败，请稍后重试");
            root.classList.remove("d-none");
        },
    };
})();
