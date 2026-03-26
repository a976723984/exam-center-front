/**
 * 小白塔云题库 - 版本与定价配置
 * 试用版：默认免费；个人版：10元/月；高级版：15元/月
 * 包季每月优惠15%，包年每月优惠35%
 */
(function () {
    const PLANS = {
        trial: {
            id: "trial",
            name: "试用版",
            maxBanks: 1,
            priceMonthly: 0,
            priceQuarterly: 0,
            priceYearly: 0,
            desc: "免费，限 1 个题库；注册赠送 100 白塔币",
        },
        personal: {
            id: "personal",
            name: "个人版",
            maxBanks: 20,
            priceMonthly: 10,
            priceQuarterly: Math.round(10 * 3 * (1 - 0.15)),
            priceYearly: Math.round(10 * 12 * (1 - 0.35)),
            desc: "20 个题库，知识文件容量 10G；每月赠送 300 白塔币",
        },
        advanced: {
            id: "advanced",
            name: "高级版",
            maxBanks: null,
            priceMonthly: 15,
            priceQuarterly: Math.round(15 * 3 * (1 - 0.15)),
            priceYearly: Math.round(15 * 12 * (1 - 0.35)),
            desc: "题库不限量，知识文件容量 20G；每月赠送 800 白塔币",
        },
    };

    const PLAN_STORAGE_KEY = "exam_center_plan";

    function currentUserScope() {
        try {
            const uid = window.ApiClient?.getUser?.()?.id ?? null;
            return uid != null ? String(uid) : "anon";
        } catch {
            return "anon";
        }
    }

    function scopedKey(baseKey) {
        return baseKey + "__u" + currentUserScope();
    }

    function getCurrentPlanId() {
        return localStorage.getItem(scopedKey(PLAN_STORAGE_KEY)) || "trial";
    }

    function setCurrentPlanId(planId) {
        if (PLANS[planId]) localStorage.setItem(scopedKey(PLAN_STORAGE_KEY), planId);
    }

    function getPlan(planId) {
        return PLANS[planId] || PLANS.trial;
    }

    function getCurrentPlan() {
        return getPlan(getCurrentPlanId());
    }

    /** 用量进度条颜色：未满一半绿，一半以上黄，满或超红 */
    function getUsageBarColor(used, max) {
        if (max == null || max === 0) return "green";
        var ratio = used / max;
        if (ratio >= 1) return "red";
        if (ratio >= 0.5) return "yellow";
        return "green";
    }

    /** 渲染用量进度条 HTML：used/max 为数字，unit 为「个」或「道」等；无 max 时只显示文字 */
    function renderUsageBar(used, max, unit) {
        unit = unit || "";
        if (max == null || max === 0) {
            return '<span class="usage-progress__text">' + used + " " + unit + "（不限）</span>";
        }
        var color = getUsageBarColor(used, max);
        var pct = Math.min(100, Math.round((used / max) * 100));
        var text = used + " / " + max + " " + unit;
        return (
            '<div class="usage-progress">' +
            '<div class="usage-progress__bar" role="progressbar" aria-valuenow="' + used + '" aria-valuemin="0" aria-valuemax="' + max + '">' +
            '<div class="usage-progress__fill usage-progress__fill--' + color + '" style="width:' + pct + '%"></div>' +
            "</div>" +
            '<span class="usage-progress__text">' + text + "</span>" +
            "</div>"
        );
    }

    window.PlanConfig = {
        PLANS,
        getCurrentPlanId,
        setCurrentPlanId,
        getPlan,
        getCurrentPlan,
        getUsageBarColor,
        renderUsageBar,
    };
})();
