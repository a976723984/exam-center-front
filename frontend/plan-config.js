/**
 * 小白塔云题库 - 版本与定价配置
 * 试用版：默认免费；个人版：25元/月；高级版：40元/月
 * 包季每月优惠15%，包年每月优惠35%
 */
(function () {
    const PLANS = {
        trial: {
            id: "trial",
            name: "试用版",
            maxBanks: 1,
            maxQuestionsTotal: 100,
            maxQuestionsPerDay: null,
            priceMonthly: 0,
            priceQuarterly: 0,
            priceYearly: 0,
            desc: "免费，限 1 个题库、题目生成总量 100 道",
        },
        personal: {
            id: "personal",
            name: "个人版",
            maxBanks: 20,
            maxQuestionsTotal: null,
            maxQuestionsPerDay: 500,
            priceMonthly: 25,
            priceQuarterly: Math.round(25 * 3 * (1 - 0.15)),
            priceYearly: Math.round(25 * 12 * (1 - 0.35)),
            desc: "20 个题库，每日题目生成 500 道",
        },
        advanced: {
            id: "advanced",
            name: "高级版",
            maxBanks: 50,
            maxQuestionsTotal: null,
            maxQuestionsPerDay: null,
            priceMonthly: 40,
            priceQuarterly: Math.round(40 * 3 * (1 - 0.15)),
            priceYearly: Math.round(40 * 12 * (1 - 0.35)),
            desc: "50 个题库，题目生成不限量",
        },
    };

    const PLAN_STORAGE_KEY = "exam_center_plan";
    const USAGE_TOTAL_KEY = "exam_center_plan_usage_total";
    const USAGE_DATE_KEY = "exam_center_plan_usage_date";
    const USAGE_TODAY_KEY = "exam_center_plan_usage_today";

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

    function getQuestionGenUsage() {
        const today = new Date().toISOString().slice(0, 10);
        const savedDate = localStorage.getItem(scopedKey(USAGE_DATE_KEY));
        const total = parseInt(localStorage.getItem(scopedKey(USAGE_TOTAL_KEY)) || "0", 10);
        let dayCount = parseInt(localStorage.getItem(scopedKey(USAGE_TODAY_KEY)) || "0", 10);
        if (savedDate !== today) {
            dayCount = 0;
            localStorage.setItem(scopedKey(USAGE_DATE_KEY), today);
            localStorage.setItem(scopedKey(USAGE_TODAY_KEY), "0");
        }
        return { total, today: dayCount };
    }

    function addQuestionGenUsage(count) {
        const u = getQuestionGenUsage();
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem(scopedKey(USAGE_TOTAL_KEY), String(u.total + count));
        localStorage.setItem(scopedKey(USAGE_TODAY_KEY), String(u.today + count));
        localStorage.setItem(scopedKey(USAGE_DATE_KEY), today);
    }

    function clearQuestionGenUsageForUser(userId) {
        const scope = userId != null ? String(userId) : "anon";
        const suffix = "__u" + scope;
        localStorage.removeItem(USAGE_TOTAL_KEY + suffix);
        localStorage.removeItem(USAGE_TODAY_KEY + suffix);
        localStorage.removeItem(USAGE_DATE_KEY + suffix);
    }

    function checkCanGenerateQuestions(count) {
        const plan = getCurrentPlan();
        const usage = getQuestionGenUsage();
        if (plan.maxQuestionsTotal != null) {
            if (usage.total + count > plan.maxQuestionsTotal) {
                return { ok: false, message: "试用版题目生成总量限制为 " + plan.maxQuestionsTotal + " 道，当前已用 " + usage.total + " 道，无法再生成。" };
            }
        }
        if (plan.maxQuestionsPerDay != null) {
            if (usage.today + count > plan.maxQuestionsPerDay) {
                return { ok: false, message: "个人版每日题目生成限制为 " + plan.maxQuestionsPerDay + " 道，今日已用 " + usage.today + " 道，无法再生成。" };
            }
        }
        return { ok: true };
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
        getQuestionGenUsage,
        addQuestionGenUsage,
        clearQuestionGenUsageForUser,
        checkCanGenerateQuestions,
        getUsageBarColor,
        renderUsageBar,
    };
})();
