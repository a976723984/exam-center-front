(function () {
    const listSection = document.getElementById("listSection");
    const detailSection = document.getElementById("detailSection");
    const publicList = document.getElementById("publicList");
    const listPageInfo = document.getElementById("listPageInfo");
    const listPrevBtn = document.getElementById("listPrevBtn");
    const listNextBtn = document.getElementById("listNextBtn");
    const backToListBtn = document.getElementById("backToListBtn");
    const detailTitle = document.getElementById("detailTitle");
    const detailMeta = document.getElementById("detailMeta");
    const detailQuestions = document.getElementById("detailQuestions");
    const subscribeHint = document.getElementById("subscribeHint");
    const subscribeForm = document.getElementById("subscribeForm");
    const subscribeBankSelect = document.getElementById("subscribeBankSelect");
    const subscribeBtn = document.getElementById("subscribeBtn");
    const reviewHint = document.getElementById("reviewHint");
    const reviewForm = document.getElementById("reviewForm");
    const reviewRating = document.getElementById("reviewRating");
    const reviewComment = document.getElementById("reviewComment");
    const reviewSubmitBtn = document.getElementById("reviewSubmitBtn");
    const reviewsList = document.getElementById("reviewsList");
    const userArea = document.getElementById("userArea");
    const userAreaText = document.getElementById("userAreaText");

    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 12;
    let currentPaperId = null;
    let isLoggedIn = false;

    function escapeHtml(text) {
        if (text == null) return "";
        return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    }

    const typeLabel = { SINGLE_CHOICE: "单选题", MULTIPLE_CHOICE: "多选题", SHORT_ANSWER: "简答题", TRUE_FALSE: "判断题" };

    function parseOptions(json) {
        try { return json ? JSON.parse(json) : []; } catch { return []; }
    }

    async function requestPublic(path, options = {}) {
        const url = `${ApiClient.API_BASE}${path}`;
        const headers = {};
        if (ApiClient.getToken()) headers["Authorization"] = "Bearer " + ApiClient.getToken();
        const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
        return res;
    }

    async function loadList(page = 1) {
        const res = await requestPublic(`/papers/public?page=${page}&size=${pageSize}`);
        const data = await res.json();
        const items = data.items || [];
        currentPage = data.page || page;
        totalPages = data.totalPages || 1;
        listPageInfo.textContent = `第 ${currentPage} / ${totalPages} 页，共 ${data.totalElements ?? 0} 份`;
        listPrevBtn.disabled = currentPage <= 1;
        listNextBtn.disabled = currentPage >= totalPages;
        if (!items.length) {
            publicList.innerHTML = '<div class="col-12 text-secondary small">暂无分享的试卷</div>';
            return;
        }
        publicList.innerHTML = items.map((p) => `
            <div class="col-md-6 col-lg-4">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body p-3">
                        <h6 class="card-title mb-2">${escapeHtml(p.title || "未命名")}</h6>
                        <div class="small text-secondary mb-2">分享者：${escapeHtml(p.ownerName || "-")}</div>
                        <div class="small text-secondary mb-2">浏览 ${p.viewCount ?? 0} · 订阅 ${p.subscribeCount ?? 0} · 评分 ${p.averageRating != null ? p.averageRating : "-"}</div>
                        <button class="btn btn-sm btn-outline-primary" data-id="${p.id}" type="button">查看</button>
                    </div>
                </div>
            </div>
        `).join("");
        publicList.querySelectorAll("[data-id]").forEach((btn) => {
            btn.addEventListener("click", () => showDetail(Number(btn.getAttribute("data-id"))));
        });
    }

    function showList() {
        listSection.classList.remove("d-none");
        detailSection.classList.add("d-none");
        currentPaperId = null;
        loadList(currentPage);
    }

    async function showDetail(paperId) {
        currentPaperId = paperId;
        listSection.classList.add("d-none");
        detailSection.classList.remove("d-none");
        detailQuestions.innerHTML = "加载中...";
        detailTitle.textContent = "";
        detailMeta.innerHTML = "";
        reviewsList.innerHTML = "";
        try {
            const res = await requestPublic(`/papers/public/${paperId}`);
            const data = await res.json();
            detailTitle.textContent = data.title || "未命名";
            detailMeta.innerHTML = `
                分享者：${escapeHtml(data.ownerName || "-")} · 
                浏览 ${data.viewCount ?? 0} · 订阅 ${data.subscribeCount ?? 0} · 
                评分 ${data.averageRating != null ? data.averageRating : "-"}
                ${data.subscribed ? " · <span class=\"text-success\">您已订阅</span>" : ""}
            `;
            const questions = data.questions || [];
            detailQuestions.innerHTML = questions.map((q, i) => {
                const opts = parseOptions(q.optionsJson);
                const optsHtml = opts.length ? `<ul class="list-unstyled small mb-0 mt-1">${opts.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>` : "";
                return `
                    <div class="border rounded p-2">
                        <div class="fw-medium">${i + 1}. ${escapeHtml(q.stem || "")}</div>
                        <div class="text-secondary small">${typeLabel[q.type] || q.type}</div>
                        ${optsHtml}
                    </div>
                `;
            }).join("") || "<span class=\"text-secondary\">无题目</span>";

            if (isLoggedIn && !data.subscribed) {
                subscribeHint.classList.add("d-none");
                subscribeForm.classList.remove("d-none");
                await fillBankSelect();
            } else if (isLoggedIn && data.subscribed) {
                subscribeHint.textContent = "您已订阅过该试卷。";
                subscribeForm.classList.add("d-none");
            } else {
                subscribeHint.classList.remove("d-none");
                subscribeForm.classList.add("d-none");
            }

            if (isLoggedIn && data.ownerUserId !== ApiClient.getUser()?.id) {
                reviewHint.classList.add("d-none");
                reviewForm.classList.remove("d-none");
                if (data.myReview) {
                    reviewRating.value = data.myReview.rating;
                    reviewComment.value = data.myReview.comment || "";
                }
            } else {
                reviewHint.classList.remove("d-none");
                reviewForm.classList.add("d-none");
            }

            const reviewsRes = await requestPublic(`/papers/public/${paperId}/reviews`);
            const reviews = await reviewsRes.json();
            reviewsList.innerHTML = "<strong>全部评价</strong><div class=\"mt-2\"></div>" + (reviews.length
                ? reviews.map((r) => `
                    <div class="border-bottom pb-2 mb-2">
                        <span class="fw-medium">${escapeHtml(r.username || "用户")}</span>
                        <span class="text-warning">${"★".repeat(r.rating || 0)}${"☆".repeat(5 - (r.rating || 0))}</span>
                        <span class="text-secondary small">${r.createdAt ? new Date(r.createdAt).toLocaleString("zh-CN") : ""}</span>
                        ${r.comment ? `<div class="mt-1">${escapeHtml(r.comment)}</div>` : ""}
                    </div>
                `).join("")
                : "<span class=\"text-secondary\">暂无评价</span>");
        } catch (e) {
            detailQuestions.innerHTML = '<span class="text-danger">加载失败</span>';
        }
    }

    async function fillBankSelect() {
        if (!ApiClient.getToken()) return;
        try {
            const res = await ApiClient.request("/banks");
            const banks = await res.json();
            subscribeBankSelect.innerHTML = "<option value=\"\">请选择题库</option>" + (banks || []).map((b) =>
                `<option value="${b.id}">${escapeHtml(b.name)}</option>`
            ).join("");
        } catch (_) {
            subscribeBankSelect.innerHTML = "<option value=\"\">加载题库失败</option>";
        }
    }

    backToListBtn.addEventListener("click", showList);

    subscribeBtn.addEventListener("click", async () => {
        const bankId = subscribeBankSelect.value;
        if (!bankId) return alert("请选择题库");
        try {
            const res = await ApiClient.request(`/papers/public/${currentPaperId}/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bankId: Number(bankId) }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err?.message || "订阅失败");
            }
            alert("订阅成功，已添加到您的题库");
            showDetail(currentPaperId);
        } catch (e) {
            alert(e.message || "订阅失败");
        }
    });

    reviewSubmitBtn.addEventListener("click", async () => {
        const rating = Number(reviewRating.value);
        const comment = (reviewComment.value || "").trim();
        try {
            const res = await ApiClient.request(`/papers/public/${currentPaperId}/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, comment }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err?.message || "提交失败");
            }
            alert("评价已提交");
            showDetail(currentPaperId);
        } catch (e) {
            alert(e.message || "提交失败");
        }
    });

    (async function init() {
        try {
            const profile = await ApiClient.validateMe();
            isLoggedIn = !!(ApiClient.getDisplayName?.(profile?.user));
            if (isLoggedIn && profile?.user && !profile.user.phone && window.PhoneBindModal) {
                await PhoneBindModal.ensureBound();
                isLoggedIn = !!ApiClient.getDisplayName?.(ApiClient.getUser());
            }
            const u = ApiClient.getUser();
            const displayName = ApiClient.getDisplayName?.(u);
            if (isLoggedIn && u && userArea && userAreaText) {
                userAreaText.textContent = displayName;
                userArea.href = "./center.html";
            } else if (userArea && userAreaText) {
                userAreaText.textContent = "登录/注册";
                userArea.href = "./login.html?redirect=share.html";
            }
        } catch (_) {
            isLoggedIn = false;
        }

        const params = new URLSearchParams(location.search);
        const id = params.get("id");
        if (id) {
            await showDetail(Number(id));
        } else {
            showList();
        }
    })();
})();
