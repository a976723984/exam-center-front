const API_BASE_KEY = "exam_admin_api_base";
const ADMIN_TOKEN_KEY = "exam_admin_token";

const OVERVIEW_DAYS = 14;

function getApiBase() {
    const raw = sessionStorage.getItem(API_BASE_KEY);
    if (raw && raw.trim()) return raw.trim().replace(/\/$/, "");
    return "http://localhost:8081/api";
}

function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function escapeHtml(text) {
    if (text == null) return "";
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function fmtTime(iso) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString("zh-CN", { hour12: false });
    } catch {
        return iso;
    }
}

async function adminFetch(path, options = {}) {
    const base = getApiBase();
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }
    const token = getAdminToken();
    if (token) headers.set("X-Admin-Token", token);
    const res = await fetch(`${base}${path}`, { ...options, headers });
    let data = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    if (!res.ok) {
        const msg = data?.message || data?.code || `请求失败 (${res.status})`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
}

let currentPage = 0;
const pageSize = 20;

let chartLogin = null;
let chartGenerated = null;
let chartAnswered = null;
let coinsModalInstance = null;

async function loadStats() {
    const s = await adminFetch("/admin/stats");
    document.getElementById("statTotal").textContent = s.totalUsers ?? "—";
    document.getElementById("statActive").textContent = s.activeLast7Days ?? "—";
    const plans = s.usersByPlan || {};
    const parts = Object.keys(plans)
        .sort()
        .map((k) => `<span class="badge bg-secondary me-1 mb-1">${escapeHtml(k)}: ${plans[k]}</span>`);
    document.getElementById("statPlans").innerHTML = parts.length ? parts.join(" ") : "—";
}

function renderMiniLineChart(canvasId, labels, data, label, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return null;
    const ctx = canvas.getContext("2d");
    const shortLabels = (labels || []).map((d) => {
        if (typeof d !== "string") return "—";
        // d: YYYY-MM-DD -> MM-DD
        return d.length >= 5 ? d.slice(5) : d;
    });

    return new Chart(ctx, {
        type: "line",
        data: {
            labels: shortLabels,
            datasets: [
                {
                    label,
                    data: data || [],
                    borderColor: color,
                    backgroundColor: color,
                    pointRadius: 2,
                    borderWidth: 2,
                    tension: 0.25,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true },
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" } },
            },
        },
    });
}

async function loadOverview(days = OVERVIEW_DAYS) {
    const o = await adminFetch(`/admin/overview?days=${days}`);
    document.getElementById("statLoginTotal").textContent = o.loginUsersTotal ?? "—";
    document.getElementById("statGeneratedTotal").textContent = o.generatedQuestionsTotal ?? "—";
    document.getElementById("statAnsweredTotal").textContent = o.answeredTotal ?? "—";

    const labels = o.labels || [];
    const loginDaily = o.loginDaily || [];
    const generatedDaily = o.generatedDaily || [];
    const answeredDaily = o.answeredDaily || [];

    if (chartLogin) chartLogin.destroy();
    if (chartGenerated) chartGenerated.destroy();
    if (chartAnswered) chartAnswered.destroy();

    chartLogin = renderMiniLineChart("chartLogin", labels, loginDaily, "登录用户数", "#3b82f6");
    chartGenerated = renderMiniLineChart("chartGenerated", labels, generatedDaily, "生成题目数量", "#a855f7");
    chartAnswered = renderMiniLineChart("chartAnswered", labels, answeredDaily, "答题次数", "#10b981");
}

async function loadUsers(page = 0) {
    const plan = document.getElementById("filterPlan").value.trim();
    const q = document.getElementById("filterQ").value.trim();
    const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
    if (plan) params.set("plan", plan);
    if (q) params.set("q", q);
    const data = await adminFetch(`/admin/users?${params.toString()}`);
    currentPage = data.page ?? page;
    const tbody = document.getElementById("userTableBody");
    const items = data.items || [];
    tbody.innerHTML = items
        .map((u) => {
            const meta = encodeURIComponent(
                JSON.stringify({
                    id: u.id,
                    username: u.username || "",
                    planId: u.planId || "trial",
                    baitaCoins: u.baitaCoins ?? 0,
                })
            );
            return `
        <tr>
            <td>${u.id}</td>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.phone || "—")}</td>
            <td><span class="badge text-bg-light border">${escapeHtml(u.planId || "trial")}</span></td>
            <td><span class="fw-semibold">${u.baitaCoins ?? 0}</span></td>
            <td class="small">${escapeHtml(u.clientVersion || "—")}</td>
            <td class="small text-secondary">${escapeHtml(fmtTime(u.lastLoginAt))}</td>
            <td class="small text-secondary">${escapeHtml(fmtTime(u.lastActiveAt))}</td>
            <td class="small text-secondary">${escapeHtml(fmtTime(u.createdAt))}</td>
            <td>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-edit-plan" data-meta="${meta}">
                        改套餐
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-warning btn-adjust-coins" data-meta="${meta}">
                        发币
                    </button>
                    <button type="button"
                        class="btn btn-sm btn-outline-success btn-user-usage"
                        data-id="${u.id}"
                        data-username="${escapeHtml(u.username)}">
                        统计
                    </button>
                </div>
            </td>
        </tr>`;
        })
        .join("");
    const total = data.total ?? 0;
    const size = data.size ?? pageSize;
    const start = total === 0 ? 0 : currentPage * size + 1;
    const end = Math.min(total, (currentPage + 1) * size);
    document.getElementById("pageInfo").textContent = `共 ${total} 条 · 显示 ${start}–${end}`;

    tbody.querySelectorAll(".btn-edit-plan").forEach((btn) => {
        btn.addEventListener("click", () => {
            let u = { id: "", username: "", planId: "trial" };
            try {
                u = JSON.parse(decodeURIComponent(btn.getAttribute("data-meta") || ""));
            } catch {
                /* ignore */
            }
            document.getElementById("editUserId").value = String(u.id);
            document.getElementById("editUsername").textContent = u.username || "";
            document.getElementById("editPlanSelect").value = u.planId || "trial";
            const modal = new bootstrap.Modal(document.getElementById("planModal"));
            modal.show();
        });
    });

    tbody.querySelectorAll(".btn-user-usage").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = Number(btn.getAttribute("data-id") || "0");
            const username = btn.getAttribute("data-username") || "";
            openUserUsageModal(id, username).catch((e) => alert(e.message || "加载用户统计失败"));
        });
    });

    tbody.querySelectorAll(".btn-adjust-coins").forEach((btn) => {
        btn.addEventListener("click", () => {
            let u = { id: "", username: "", baitaCoins: 0 };
            try {
                u = JSON.parse(decodeURIComponent(btn.getAttribute("data-meta") || ""));
            } catch {
                /* ignore */
            }
            openCoinsModal(u);
        });
    });
}

function openCoinsModal(user) {
    const userIdEl = document.getElementById("coinsUserId");
    const usernameEl = document.getElementById("coinsUsername");
    const currentBalanceEl = document.getElementById("coinsCurrentBalance");
    const deltaInputEl = document.getElementById("coinsDeltaInput");
    const coinsModalEl = document.getElementById("coinsModal");
    if (!userIdEl || !usernameEl || !currentBalanceEl || !deltaInputEl || !coinsModalEl) return;
    userIdEl.value = String(user.id || "");
    usernameEl.textContent = user.username || "";
    currentBalanceEl.textContent = String(user.baitaCoins ?? 0);
    deltaInputEl.value = "50";
    if (!coinsModalInstance) {
        coinsModalInstance = new bootstrap.Modal(coinsModalEl);
    }
    coinsModalInstance.show();
}

async function openUserUsageModal(userId, username) {
    const usageModalEl = document.getElementById("usageModal");
    if (!usageModalEl) return;

    document.getElementById("usageModalTitle").textContent = `用户统计：${username || userId}`;
    document.getElementById("usageGeneratedTotal").textContent = "—";
    document.getElementById("usageGeneratedToday").textContent = "—";
    document.getElementById("usageAnsweredTotal").textContent = "—";

    const modal = new bootstrap.Modal(usageModalEl);
    modal.show();

    const u = await adminFetch(`/admin/users/${userId}/usage`);
    document.getElementById("usageGeneratedTotal").textContent = u.generatedQuestionsTotal ?? 0;
    document.getElementById("usageGeneratedToday").textContent = u.generatedQuestionsToday ?? 0;
    document.getElementById("usageAnsweredTotal").textContent = u.answeredTotal ?? 0;
}

function showGateError(text) {
    const el = document.getElementById("gateMsg");
    el.textContent = text;
    el.classList.toggle("d-none", !text);
}

async function connect() {
    const token = document.getElementById("adminTokenInput").value.trim();
    showGateError("");
    if (!token) {
        showGateError("请填写管理令牌");
        return;
    }
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    try {
        await loadStats();
        await loadOverview(OVERVIEW_DAYS);
        await loadUsers(0);
        document.getElementById("gateCard").classList.add("d-none");
        document.getElementById("dashboard").classList.remove("d-none");
    } catch (e) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        showGateError(e.message || "连接失败，请检查令牌与 API 地址");
    }
}

document.getElementById("apiBaseInput").value = getApiBase();
document.getElementById("saveApiBaseBtn").addEventListener("click", () => {
    let v = document.getElementById("apiBaseInput").value.trim().replace(/\/$/, "");
    if (!v) v = "http://localhost:8081/api";
    sessionStorage.setItem(API_BASE_KEY, v);
    document.getElementById("apiBaseInput").value = v;
});

document.getElementById("connectBtn").addEventListener("click", connect);

document.getElementById("searchBtn").addEventListener("click", () => {
    loadUsers(0).catch((e) => alert(e.message));
});

document.getElementById("refreshBtn").addEventListener("click", () => {
    Promise.all([loadStats(), loadOverview(OVERVIEW_DAYS)]).catch((e) => alert(e.message));
});

document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (currentPage <= 0) return;
    loadUsers(currentPage - 1).catch((e) => alert(e.message));
});

document.getElementById("nextPageBtn").addEventListener("click", () => {
    loadUsers(currentPage + 1).catch((e) => alert(e.message));
});

document.getElementById("savePlanBtn").addEventListener("click", async () => {
    const id = document.getElementById("editUserId").value;
    const planId = document.getElementById("editPlanSelect").value;
    const btn = document.getElementById("savePlanBtn");
    btn.disabled = true;
    try {
        await adminFetch(`/admin/users/${id}/plan`, {
            method: "PATCH",
            body: JSON.stringify({ planId }),
        });
        bootstrap.Modal.getInstance(document.getElementById("planModal"))?.hide();
        await loadUsers(currentPage);
        await loadStats();
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
});

document.getElementById("saveCoinsBtn")?.addEventListener("click", async () => {
    const userId = Number(document.getElementById("coinsUserId")?.value || "0");
    const delta = Number(document.getElementById("coinsDeltaInput")?.value || "0");
    const btn = document.getElementById("saveCoinsBtn");
    if (!userId) {
        alert("用户信息无效");
        return;
    }
    if (!Number.isFinite(delta) || delta <= 0) {
        alert("请输入大于 0 的发放数量");
        return;
    }
    btn.disabled = true;
    try {
        await adminFetch(`/admin/users/${userId}/baita-coins`, {
            method: "PATCH",
            body: JSON.stringify({ delta }),
        });
        bootstrap.Modal.getInstance(document.getElementById("coinsModal"))?.hide();
        await loadUsers(currentPage);
    } catch (e) {
        alert(e.message || "发放失败");
    } finally {
        btn.disabled = false;
    }
});

(function init() {
    const existing = getAdminToken();
    if (existing) {
        document.getElementById("adminTokenInput").value = existing;
        connect().catch(() => {});
    }
})();
