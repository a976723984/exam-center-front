const userInfo = document.getElementById("userInfo");
const planInfo = document.getElementById("planInfo");
const planCardsRow = document.getElementById("planCardsRow");
const logoutBtn = document.getElementById("logoutBtn");
const paymentModalBackdrop = document.getElementById("paymentModalBackdrop");
const paymentModalClose = document.getElementById("paymentModalClose");
const paymentModalPlan = document.getElementById("paymentModalPlan");
const paymentModalTip = document.getElementById("paymentModalTip");
const groupQrImage = document.getElementById("groupQrImage");
const trialCountdownEl = document.getElementById("trialCountdown");

let currentPeriod = "monthly";
let pendingPlan = null;
let groupQrUrl = "";

function escapeHtml(text) {
    if (text == null) return "";
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function getPriceByPeriod(plan, period) {
    if (plan.priceMonthly === 0) return { amount: 0, label: "免费", note: "" };
    switch (period) {
        case "quarterly":
            return { amount: plan.priceQuarterly, label: "¥" + plan.priceQuarterly, note: "季付（约" + (plan.priceQuarterly / 3).toFixed(1) + "元/月）" };
        case "yearly":
            return { amount: plan.priceYearly, label: "¥" + plan.priceYearly, note: "年付（约" + (plan.priceYearly / 12).toFixed(1) + "元/月）" };
        default:
            return { amount: plan.priceMonthly, label: "¥" + plan.priceMonthly + "/月", note: "按月续费" };
    }
}

function getPlanFeatures(plan) {
    const features = [];
    features.push("题库数量：" + (plan.maxBanks == null ? "不限" : plan.maxBanks + " 个"));
    if (plan.maxQuestionsTotal != null) {
        features.push("题目生成：总量 " + plan.maxQuestionsTotal + " 道");
    } else if (plan.maxQuestionsPerDay != null) {
        features.push("题目生成：每日 " + plan.maxQuestionsPerDay + " 道");
    } else {
        features.push("题目生成：不限量");
    }
    return features;
}

function renderPlanCards() {
    if (!planCardsRow || !window.PlanConfig) return;
    const PLANS = PlanConfig.PLANS;
    const currentPlanId = PlanConfig.getCurrentPlanId();
    const planIds = ["trial", "personal", "advanced"];
    const periodLabels = { monthly: "月付", quarterly: "季付", yearly: "年付" };

    planCardsRow.innerHTML = planIds.map((id) => {
        const plan = PLANS[id];
        const isCurrent = currentPlanId === id;
        const priceInfo = getPriceByPeriod(plan, currentPeriod);
        const features = getPlanFeatures(plan);
        const isFree = plan.priceMonthly === 0;

        return `
            <div class="col-12 col-md-4">
                <div class="plan-card ${isCurrent ? "plan-card--current" : ""}" data-plan-id="${escapeHtml(plan.id)}">
                    <div class="plan-card__name">${escapeHtml(plan.name)}</div>
                    <div class="plan-card__desc">${escapeHtml(plan.desc)}</div>
                    <ul class="plan-card__features">
                        ${features.map((f) => "<li>" + escapeHtml(f) + "</li>").join("")}
                    </ul>
                    <div class="plan-card__price">${priceInfo.label}</div>
                    ${priceInfo.note ? '<div class="plan-card__price-note">' + escapeHtml(priceInfo.note) + "</div>" : ""}
                    <div class="plan-card__actions">
                        ${isFree
                            ? '<span class="plan-card__btn-free">免费使用</span>'
                            : `<button type="button" class="plan-card__btn-consult" data-plan-id="${escapeHtml(plan.id)}">
                                    <i class="bi bi-people-fill"></i> 加群咨询升级
                               </button>`}
                    </div>
                </div>
            </div>
        `;
    }).join("");

    planCardsRow.querySelectorAll(".plan-card__btn-consult[data-plan-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const planId = btn.getAttribute("data-plan-id");
            openConsultModal(planId);
        });
    });
}

function openConsultModal(planId) {
    if (!window.PlanConfig) return;
    const plan = PlanConfig.getPlan(planId);
    pendingPlan = { planId, planName: plan.name, period: currentPeriod };

    if (!groupQrUrl) {
        if (paymentModalTip) {
            paymentModalTip.textContent = "暂未配置加群二维码，请联系管理员。";
            paymentModalTip.classList.remove("d-none");
        } else {
            alert("暂未配置加群二维码，请联系管理员。");
        }
    } else if (groupQrImage) {
        groupQrImage.src = groupQrUrl;
        groupQrImage.style.display = "inline-block";
    }

    if (paymentModalPlan) {
        paymentModalPlan.textContent = plan.name + " · 咨询升级";
    }
    if (paymentModalBackdrop) paymentModalBackdrop.classList.remove("d-none");
}

function closePaymentModal() {
    pendingPlan = null;
    if (paymentModalBackdrop) paymentModalBackdrop.classList.add("d-none");
}

(async function init() {
    if (!ApiClient.requireAuth()) return;
    if (window.PhoneBindModal) await PhoneBindModal.ensureBound();

    const profile = await ApiClient.validateMe();
    const user = profile?.user;
    if (!user) {
        if (userInfo) userInfo.innerHTML = '<span class="text-danger">未获取到用户信息</span>';
        if (planInfo) planInfo.innerHTML = "-";
        return;
    }

    // 读取后端返回的试用剩余天数与加群二维码地址
    groupQrUrl = profile?.groupQrUrl || "";
    const trialDaysLeft = typeof profile?.trialDaysLeft === "number" ? profile.trialDaysLeft : null;
    if (trialCountdownEl && trialDaysLeft != null) {
        if (trialDaysLeft > 0) {
            trialCountdownEl.textContent = `试用版剩余 ${trialDaysLeft} 天，到期后将无法继续使用生成题目等功能，请及时联系升级版本。`;
        } else {
            trialCountdownEl.textContent = "试用期已结束，请升级版本后继续使用。";
        }
        trialCountdownEl.classList.remove("d-none");
    }

    if (userInfo) {
        userInfo.innerHTML = `
            <div class="mb-2"><strong>用户名</strong>：${escapeHtml(user.username || "-")}</div>
            ${user.phone ? `<div class="mb-2"><strong>手机号</strong>：${escapeHtml(user.phone)}</div>` : ""}
        `;
    }

    const plan = window.PlanConfig ? PlanConfig.getCurrentPlan() : { name: "试用版", desc: "默认版本" };
    if (planInfo) {
        planInfo.innerHTML = `
            <div class="mb-2"><strong>当前版本</strong>：${escapeHtml(plan.name)}</div>
            <div class="text-secondary">${escapeHtml(plan.desc)}</div>
        `;
    }

    const usageInfo = document.getElementById("usageInfo");
    const usageStorage = document.getElementById("usageStorage");
    const usageBanks = document.getElementById("usageBanks");
    const usageQuestions = document.getElementById("usageQuestions");
    if (usageInfo && usageBanks && usageQuestions && window.PlanConfig && typeof PlanConfig.renderUsageBar === "function") {
        let bankCount = 0;
        try {
            const res = await ApiClient.request("/banks");
            const banks = await res.json();
            bankCount = Array.isArray(banks) ? banks.length : 0;
        } catch (_) {}
        const p = PlanConfig.getCurrentPlan();
        const qu = PlanConfig.getQuestionGenUsage();
        if (usageStorage) {
            const used = typeof profile.storageUsedBytes === "number" ? profile.storageUsedBytes : 0;
            const limit = typeof profile.storageLimitBytes === "number" ? profile.storageLimitBytes : null;
            const usedMB = Math.round(used / (1024 * 1024));
            const limitMB = limit != null ? Math.round(limit / (1024 * 1024)) : null;
            usageStorage.innerHTML = PlanConfig.renderUsageBar(usedMB, limitMB, "MB");
        }
        usageBanks.innerHTML = PlanConfig.renderUsageBar(bankCount, p.maxBanks, "个");
        if (p.maxQuestionsTotal != null) {
            usageQuestions.innerHTML = PlanConfig.renderUsageBar(qu.total, p.maxQuestionsTotal, "道");
        } else if (p.maxQuestionsPerDay != null) {
            usageQuestions.innerHTML = PlanConfig.renderUsageBar(qu.today, p.maxQuestionsPerDay, "道");
        } else {
            usageQuestions.innerHTML = PlanConfig.renderUsageBar(qu.total, null, "道");
        }
        usageInfo.classList.remove("d-none");
    }

    renderPlanCards();

    document.querySelectorAll(".plan-period-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".plan-period-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            tab.setAttribute("aria-selected", "true");
            currentPeriod = tab.getAttribute("data-period") || "monthly";
            renderPlanCards();
        });
    });

    if (paymentModalClose) paymentModalClose.addEventListener("click", closePaymentModal);
    if (paymentModalBackdrop) {
        paymentModalBackdrop.addEventListener("click", (e) => {
            if (e.target === paymentModalBackdrop) closePaymentModal();
        });
    }
})();

logoutBtn?.addEventListener("click", () => {
    const uid = ApiClient.getUser()?.id ?? null;
    if (window.PlanConfig?.clearQuestionGenUsageForUser) {
        PlanConfig.clearQuestionGenUsageForUser(uid);
    }
    ApiClient.clearSession();
    location.href = "./login.html";
});
