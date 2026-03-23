(async () => {
    const profile = await ApiClient.validateMe();
    if (profile?.user && !profile.user.phone && ApiClient.getToken() && window.PhoneBindModal) {
        await PhoneBindModal.ensureBound();
    }
    const link = document.getElementById("userArea");
    const textEl = document.getElementById("userAreaText");
    if (!link || !textEl) return;
    const me = ApiClient.getUser();
    const displayName = ApiClient.getDisplayName?.(me);
    if (displayName) {
        textEl.textContent = displayName;
        link.href = "./center.html";
    } else {
        textEl.textContent = "登录/注册";
        link.href = "./login.html";
    }
})();

(async function loadPublicPapers() {
    const row = document.getElementById("publicPapersRow");
    if (!row) return;
    try {
        const res = await fetch(`${ApiClient.API_BASE}/papers/public?page=1&size=6`);
        const data = await res.json();
        const items = data.items || [];
        if (!items.length) {
            row.innerHTML = '<div class="col-12 text-secondary small">暂无分享的试卷</div>';
            return;
        }
        row.innerHTML = items.map((p) => `
            <div class="col-md-6 col-lg-4">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body p-3">
                        <h6 class="card-title mb-2">${escapeHtml(p.title || "未命名")}</h6>
                        <div class="small text-secondary mb-2">分享者：${escapeHtml(p.ownerName || "-")}</div>
                        <div class="small text-secondary mb-2">浏览 ${p.viewCount ?? 0} · 订阅 ${p.subscribeCount ?? 0} · 评分 ${p.averageRating != null ? p.averageRating : "-"}</div>
                        <a class="btn btn-sm btn-outline-primary" href="./share.html?id=${p.id}">查看</a>
                    </div>
                </div>
            </div>
        `).join("");
    } catch (e) {
        row.innerHTML = '<div class="col-12 text-secondary small">加载失败</div>';
    }
})();

function escapeHtml(text) {
    if (text == null) return "";
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

