const bankSelect = document.getElementById("bankSelect");
const bankSelectMobile = document.getElementById("bankSelectMobile");
const genBtn = document.getElementById("genBtn");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const selectAllQuestions = document.getElementById("selectAllQuestions");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const questionPageInfo = document.getElementById("questionPageInfo");
const questionPool = document.getElementById("questionPool");
const manualPaperBtn = document.getElementById("manualPaperBtn");
const autoPaperBtn = document.getElementById("autoPaperBtn");
const paperList = document.getElementById("paperList");
const paperDetailView = document.getElementById("paperDetailView");
const paperListSection = document.getElementById("paperListSection");
const paperDetailSection = document.getElementById("paperDetailSection");
const paperPrevBtn = document.getElementById("paperPrevBtn");
const paperNextBtn = document.getElementById("paperNextBtn");
const paperPageInfo = document.getElementById("paperPageInfo");
const backPaperListBtn = document.getElementById("backPaperListBtn");
const startExamBtn = document.getElementById("startExamBtn");
const questionFiltersDrawer = document.getElementById("questionFiltersRow");
const genBtnMobile = document.getElementById("genBtnMobile");
const deleteSelectedBtnMobile = document.getElementById("deleteSelectedBtnMobile");
const manualPaperBtnMobile = document.getElementById("manualPaperBtnMobile");
const autoPaperBtnMobile = document.getElementById("autoPaperBtnMobile");
const startExamBtnMobile = document.getElementById("startExamBtnMobile");
const mobileOperationActions = document.getElementById("mobileOperationActions");
const examForm = document.getElementById("examForm");
const examQuestions = document.getElementById("examQuestions");
const examResult = document.getElementById("examResult");
const examHistoryList = document.getElementById("examHistoryList");
const examRecordDetailView = document.getElementById("examRecordDetailView");
const recordListSection = document.getElementById("recordListSection");
const recordDetailSection = document.getElementById("recordDetailSection");
const recordPrevBtn = document.getElementById("recordPrevBtn");
const recordNextBtn = document.getElementById("recordNextBtn");
const recordPageInfo = document.getElementById("recordPageInfo");
const backRecordListBtn = document.getElementById("backRecordListBtn");
const moduleTags = document.getElementById("moduleTags");
const moduleMenuBtns = Array.from(document.querySelectorAll(".module-menu-btn"));
const moduleOperation = document.getElementById("moduleOperation");
const moduleExamSession = document.getElementById("moduleExamSession");
const modulePapers = document.getElementById("modulePapers");
const moduleRecords = document.getElementById("moduleRecords");
const moduleStats = document.getElementById("moduleStats");
const statsBankSelect = document.getElementById("statsBankSelect");
const statsPaperSelect = document.getElementById("statsPaperSelect");
const statsQueryBtn = document.getElementById("statsQueryBtn");
const statsSummary = document.getElementById("statsSummary");
const backToOperationBtn = document.getElementById("backToOperationBtn");
const examSessionMeta = document.getElementById("examSessionMeta");
const userArea = document.getElementById("userArea");
const userAreaText = document.getElementById("userAreaText");
const msg = document.getElementById("msg");
const examSidebarToggle = document.getElementById("examSidebarToggle");
const examSidebar = document.querySelector(".exam-sidebar");
const examLayout = document.querySelector(".exam-layout");
const examSubmenuToggle = document.getElementById("examSubmenuToggle");
const examSubmenu = document.getElementById("examSubmenu");
const actionConfirmModalEl = document.getElementById("actionConfirmModal");
const actionConfirmModalTitle = document.getElementById("actionConfirmModalTitle");
const actionConfirmModalDesc = document.getElementById("actionConfirmModalDesc");
const actionConfirmModalFields = document.getElementById("actionConfirmModalFields");
const actionConfirmModalConfirmBtn = document.getElementById("actionConfirmModalConfirmBtn");
const genTaskFab = document.getElementById("genTaskFab");
const genTaskFabCount = document.getElementById("genTaskFabCount");
const genTaskModalBackdrop = document.getElementById("genTaskModalBackdrop");
const closeGenTaskModalBtn = document.getElementById("closeGenTaskModalBtn");
const genTaskList = document.getElementById("genTaskList");

function setExamSubmenuOpen(open) {
    if (!examSubmenuToggle || !examSubmenu) return;
    examSubmenuToggle.setAttribute("aria-expanded", String(open));
    examSubmenu.classList.toggle("is-open", open);
}

if (examSubmenuToggle && examSubmenu) {
    setExamSubmenuOpen(examSubmenuToggle.getAttribute("aria-expanded") === "true");
    examSubmenuToggle.addEventListener("click", () => {
        const expanded = examSubmenuToggle.getAttribute("aria-expanded") === "true";
        setExamSubmenuOpen(!expanded);
    });
}

const GEN_TASKS_STORAGE_KEY = "exam-center-gen-tasks";
const genTaskMap = new Map();
let genTaskSeed = 0;

function hasActiveGenerateTaskForBank(bankId) {
    if (!bankId) return false;
    return Array.from(genTaskMap.values()).some(
        (t) => String(t.bankId) === String(bankId) && (t.status === "PENDING" || t.status === "RUNNING"),
    );
}

function syncGenerateButtonDisabledState() {
    if (!genBtn) return;
    const bankId = bankSelect?.value;
    const disabledByTask = hasActiveGenerateTaskForBank(bankId);
    if (disabledByTask) {
        genBtn.disabled = true;
        genBtn.title = "当前题库已有进行中的题目生成任务";
        return;
    }
    genBtn.disabled = false;
    genBtn.removeAttribute("title");
}

// 同步其他标签页/窗口的生成任务角标
window.addEventListener("storage", (event) => {
    if (event.key !== GEN_TASKS_STORAGE_KEY) return;
    // 有后端持久化时以服务端为准；本地存储仅作兼容
    genTaskMap.clear();
    void loadActiveGenTasksFromServer().catch(() => loadPersistedGenTasks());
});

function isSidebarDrawerMode() {
    const sidebar = document.getElementById("examSidebar");
    if (!sidebar) return false;
    // 用真实布局状态判断（fixed = 移动端抽屉），避免浏览器缩放/系统缩放导致断点误判
    return window.getComputedStyle(sidebar).position === "fixed";
}

function isMobileLike() {
    return isSidebarDrawerMode() === true
        || (!!window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
}

function setMobilePagerUiHidden(hidden) {
    const h = !!hidden;
    if (questionPageInfo) questionPageInfo.classList.toggle("d-none", h);
    if (paperPageInfo) paperPageInfo.classList.toggle("d-none", h);
    if (recordPageInfo) recordPageInfo.classList.toggle("d-none", h);
    // “当前页全选”隐藏：是一个 label 包住 input
    const selectAllLabel = selectAllQuestions?.closest?.("label");
    if (selectAllLabel) selectAllLabel.classList.toggle("d-none", h);
}

function ensureMobileLoadingEl(key, afterEl) {
    if (!window.__mobileInfiniteLoadingEls) window.__mobileInfiniteLoadingEls = {};
    if (window.__mobileInfiniteLoadingEls[key]) return window.__mobileInfiniteLoadingEls[key];
    if (!afterEl) return null;
    const el = document.createElement("div");
    el.id = `mobileInfiniteLoading-${key}`;
    el.className = "d-none text-center text-secondary small py-3";
    el.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></div><div class="mt-2">加载中...</div>';
    afterEl.insertAdjacentElement("afterend", el);
    window.__mobileInfiniteLoadingEls[key] = el;
    return el;
}

function setMobileInfiniteLoadingVisible(key, visible) {
    if (!isMobileLike()) return;
    const afterEl = key === "questions" ? questionPool : (key === "papers" ? paperList : examHistoryList);
    const el = ensureMobileLoadingEl(key, afterEl);
    if (!el) return;
    el.classList.toggle("d-none", !visible);
}

function saveGenTasksToStorage() {
    const tasks = Array.from(genTaskMap.values())
        .map((t) => ({
            localId: t.localId,
            taskId: t.taskId || "",
            bankId: t.bankId,
            count: typeof t.count === "number" ? t.count : null,
            status: t.status || "PENDING",
            statusText: t.statusText || "",
            questionsGenerated: typeof t.questionsGenerated === "number" ? t.questionsGenerated : null,
            message: t.message || null,
            createdAt: t.createdAt || Date.now(),
        }))
        .filter((t) => t.bankId && (t.taskId || t.status === "PENDING"));
    try {
        // 使用 localStorage：跨标签页/窗口可恢复任务角标与列表
        localStorage.setItem(GEN_TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch (_) {}
}

function loadPersistedGenTasks() {
    try {
        const raw = localStorage.getItem(GEN_TASKS_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list) || !list.length) {
            renderGenTasksUI();
            return;
        }
        list.forEach((item) => {
            const taskId = item.taskId;
            const bankId = item.bankId;
            if (!bankId) return;
            const localId = item.localId || (taskId ? `gen-restored-${taskId}` : `gen-restored-${Date.now()}-${genTaskSeed++}`);
            if (genTaskMap.has(localId)) return;
            const task = {
                localId,
                taskId: taskId || "",
                bankId,
                count: typeof item.count === "number" ? item.count : null,
                status: item.status || "RUNNING",
                statusText: item.statusText || ((item.status === "PENDING" || item.status === "RUNNING") ? "恢复中，正在查询进度..." : ""),
                questionsGenerated: typeof item.questionsGenerated === "number" ? item.questionsGenerated : null,
                message: item.message || null,
                createdAt: item.createdAt || Date.now(),
            };
            genTaskMap.set(localId, task);
            if (task.taskId && (task.status === "PENDING" || task.status === "RUNNING")) {
                void monitorGenTask(localId);
            }
        });
        renderGenTasksUI();
    } catch (_) {}
}

async function loadActiveGenTasksFromServer() {
    const list = await ApiClient.requestJson("/banks/questions/generate-tasks/active");
    const tasks = Array.isArray(list) ? list : [];
    if (!tasks.length) {
        renderGenTasksUI();
        return;
    }
    tasks.forEach((t) => {
        const taskId = t.taskId;
        const bankId = t.bankId;
        if (!taskId || !bankId) return;
        const localId = `gen-server-${taskId}`;
        const existing = genTaskMap.get(localId);
        const task = existing || {
            localId,
            taskId,
            bankId,
            count: null,
            status: "RUNNING",
            statusText: "",
            questionsGenerated: null,
            message: null,
            createdAt: t.startedAt ? Date.parse(t.startedAt) : Date.now(),
        };
        task.count = typeof t.count === "number" ? t.count : task.count;
        task.status = t.status || task.status;
        task.questionsGenerated = typeof t.questionsGenerated === "number" ? t.questionsGenerated : task.questionsGenerated;
        task.message = t.message || task.message;
        task.statusText = task.statusText || (task.status === "FAILED" ? (task.message || "生成失败") : "");
        genTaskMap.set(localId, task);
        if (task.status === "PENDING" || task.status === "RUNNING") {
            void monitorGenTask(localId);
        }
    });
    renderGenTasksUI();
}

function getBankName(bankId) {
    const opt = bankSelect?.querySelector(`option[value="${bankId}"]`);
    return (opt && opt.textContent) ? opt.textContent.trim() : `题库 ${bankId}`;
}

let currentExamId = null;
let currentQuestionPage = 1;
let currentQuestionTotalPages = 1;
const questionPageSize = 10;
const selectedQuestionIds = new Set();
let currentPaperPage = 1;
let currentPaperTotalPages = 1;
const paperPageSize = 8;
let currentRecordPage = 1;
let currentRecordTotalPages = 1;
const recordPageSize = 8;
let mobileQuestionItems = [];
let mobilePaperItems = [];
let mobileRecordItems = [];
let mobileInfiniteBound = false;
let pagingLoading = { questions: false, papers: false, records: false };
const MODULE_META = {
    operation: { title: "考试操作台", panel: moduleOperation },
    examSession: { title: "考试视图", panel: moduleExamSession },
    papers: { title: "试卷列表", panel: modulePapers },
    records: { title: "考试记录", panel: moduleRecords },
    stats: { title: "考试统计", panel: moduleStats },
};
let openedModules = ["operation"];
let activeModule = "operation";
let loadingMaskCount = 0;

function show(text, type = "success") {
    if (type === "danger" && window.AppDialog && typeof AppDialog.error === "function") {
        AppDialog.error(text);
        return;
    }
    msg.textContent = text;
    msg.className = `alert alert-${type} mt-3 py-2 mb-0`;
    msg.classList.remove("d-none");
}

function ensureLoadingMask() {
    let mask = document.getElementById("globalLoadingMask");
    if (mask) return mask;
    mask = document.createElement("div");
    mask.id = "globalLoadingMask";
    mask.className = "global-loading-mask d-none";
    mask.innerHTML = `
        <div class="global-loading-card">
            <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
            <div class="small text-secondary mt-2">处理中，请稍候...</div>
        </div>
    `;
    document.body.appendChild(mask);
    return mask;
}

function showLoadingMask() {
    loadingMaskCount += 1;
    const mask = ensureLoadingMask();
    mask.classList.remove("d-none");
}

function hideLoadingMask() {
    loadingMaskCount = Math.max(0, loadingMaskCount - 1);
    if (loadingMaskCount > 0) return;
    const mask = document.getElementById("globalLoadingMask");
    if (mask) {
        mask.classList.add("d-none");
    }
}

function setButtonLoading(button, loading, loadingText = "处理中...") {
    if (!button) return;
    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.innerHTML;
        }
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${loadingText}`;
        return;
    }
    if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
    }
    button.disabled = false;
}

async function runWithButtonLoading(button, action, loadingText = "处理中...") {
    setButtonLoading(button, true, loadingText);
    showLoadingMask();
    try {
        return await action();
    } finally {
        setButtonLoading(button, false);
        hideLoadingMask();
    }
}
async function readErrorMessage(res, fallback) {
    const data = await ApiClient.parseJsonSafe(res);
    if (data?.message) return data.message;
    return fallback;
}
const QUESTION_TYPE_OPTIONS = [
    { value: "SINGLE_CHOICE", label: "单选题" },
    { value: "MULTIPLE_CHOICE", label: "多选题" },
    { value: "TRUE_FALSE", label: "判断题" },
    { value: "SHORT_ANSWER", label: "简答题" },
];
const parseOptions = (json) => {
    try { return json ? JSON.parse(json) : []; } catch { return []; }
};
const typeLabel = (type) => ({
    SINGLE_CHOICE: "单选题",
    MULTIPLE_CHOICE: "多选题",
    SHORT_ANSWER: "简答题",
    TRUE_FALSE: "判断题",
}[type] || type);

function escapeHtml(text = "") {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

const CHOICE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getChoiceValue(optionText, index) {
    const text = String(optionText || "").trim().toUpperCase();
    const match = text.match(/^([A-Z])(?:[\.、\s]|$)/);
    if (match) return match[1];
    return CHOICE_LETTERS[index] ?? "";
}

/** 选项展示文案，避免题干已含 A. B. 时重复前缀 */
function formatOptionDisplay(option, idx) {
    const text = String(option || "").trim();
    if (/^[A-Z][\.、\s]/.test(text)) return text;
    const letter = getChoiceValue(option, idx);
    return letter ? letter + ". " + text : text;
}

const FILTER_TAG_MAX_DROPDOWN = 3;

// 题目分类选项（用于自动组卷/考试弹窗）
let currentQuestionCategoryOptions = [];
let currentFileCategoryMap = new Map(); // fileName -> full category labels
let currentOutlineCategoryMap = new Map(); // outline title -> full category labels
let currentKnowledgeFileOptionMap = new Map(); // fileId(string) -> { id, fileName, baseName }
let currentOutlineCacheByFileId = new Map(); // fileId(string) -> outline titles

function renderActionConfirmDropdownTags(container) {
    const tagsEl = container.querySelector(".filter-select-tags");
    const moreEl = container.querySelector(".filter-select-more");
    const optionsEl = container.querySelector(".action-confirm-dropdown-options");
    if (!tagsEl || !moreEl || !optionsEl) return;
    let options = [];
    try {
        const raw = container.getAttribute("data-options");
        if (raw) options = JSON.parse(raw);
    } catch (_) {}
    const optionNumber = container.getAttribute("data-option-number") === "true";
    const selected = Array.from(optionsEl.querySelectorAll("input:checked")).map((c) => ({
        value: c.value,
        label: c.getAttribute("data-label") || c.value,
    }));
    const items = selected.map((s) => ({ value: s.value, label: s.label }));
    const visible = items.slice(0, FILTER_TAG_MAX_DROPDOWN);
    const restCount = items.length - FILTER_TAG_MAX_DROPDOWN;
    tagsEl.innerHTML = visible.map((item) => `
        <span class="filter-select-tag" data-value="${escapeHtml(String(item.value))}">
            <span class="filter-select-tag-text">${escapeHtml(item.label)}</span>
            <button type="button" class="filter-select-tag-close" aria-label="移除">×</button>
        </span>`).join("");
    tagsEl.querySelectorAll(".filter-select-tag-close").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const value = btn.closest(".filter-select-tag")?.getAttribute("data-value");
            const cb = Array.from(optionsEl.querySelectorAll("input")).find((inp) => String(inp.value) === String(value));
            if (cb) {
                cb.checked = false;
                renderActionConfirmDropdownTags(container);
            }
        });
    });
    if (restCount > 0) {
        moreEl.textContent = "+" + restCount;
        moreEl.classList.remove("d-none");
    } else {
        moreEl.classList.add("d-none");
    }
}

function initActionConfirmDropdowns() {
    if (!actionConfirmModalFields) return;
    actionConfirmModalFields.querySelectorAll("[data-multiselect-dropdown]").forEach((container) => {
        const optionsEl = container.querySelector(".action-confirm-dropdown-options");
        const menu = container.querySelector(".action-confirm-dropdown-menu");
        if (menu) menu.addEventListener("click", (e) => e.stopPropagation());
        if (!optionsEl) return;
        optionsEl.querySelectorAll("input[type=checkbox]").forEach((cb) => {
            cb.addEventListener("change", () => renderActionConfirmDropdownTags(container));
        });
        renderActionConfirmDropdownTags(container);
    });
}

function openActionConfirmDialog(config) {
    if (!actionConfirmModalEl || !window.bootstrap) {
        return Promise.resolve(null);
    }
    const {
        title = "操作确认",
        description = "",
        fields = [],
    } = config || {};
    actionConfirmModalTitle.textContent = title;
    actionConfirmModalDesc.textContent = description;
    actionConfirmModalFields.innerHTML = fields.map((field) => {
        if (field.type === "multicheckbox") {
            const options = field.options || [];
            return `
        <div>
            <label class="form-label mb-1">${escapeHtml(field.label || field.name)}</label>
            <div class="d-flex flex-wrap gap-2" data-field="${escapeHtml(field.name)}" data-multicheckbox>
                ${options.map((opt) => {
                    const val = typeof opt === "object" ? opt.value : opt;
                    const lab = typeof opt === "object" ? (opt.label || opt.value) : opt;
                    return `<label class="small mb-0"><input type="checkbox" class="form-check-input me-1" value="${escapeHtml(String(val))}">${escapeHtml(String(lab))}</label>`;
                }).join("")}
            </div>
        </div>`;
        }
        if (field.type === "multiselect-dropdown") {
            const options = field.options || [];
            const defaultAll = field.defaultAllSelected !== false;
            const optionsJson = JSON.stringify(options);
            return `
        <div>
            <label class="form-label mb-1">${escapeHtml(field.label || field.name)}</label>
            <div class="dropdown filter-select-dropdown" data-field="${escapeHtml(field.name)}" data-multiselect-dropdown data-option-number="${field.optionNumber ? "true" : "false"}" data-options="${escapeHtml(optionsJson)}" data-bs-auto-close="outside">
                <div class="filter-select-trigger d-flex align-items-stretch" data-bs-toggle="dropdown" aria-expanded="false" aria-haspopup="true">
                    <div class="filter-select-bar flex-grow-1">
                        <div class="filter-select-tags"></div>
                        <span class="filter-select-more d-none"></span>
                    </div>
                    <span class="filter-select-toggle"><i class="bi bi-chevron-down"></i></span>
                </div>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm action-confirm-dropdown-menu">
                    <li class="px-3 py-2">
                        <div class="action-confirm-dropdown-options d-flex flex-column gap-1" style="min-width: 160px;">
                            ${options.map((opt) => {
                                const val = typeof opt === "object" ? opt.value : opt;
                                const lab = typeof opt === "object" ? (opt.label || opt.value) : opt;
                                return `<label class="form-check filter-option-row mb-0"><input class="form-check-input filter-option-cb-hidden" type="checkbox" value="${escapeHtml(String(val))}" data-label="${escapeHtml(String(lab))}" ${defaultAll ? "checked" : ""}><span class="small">${escapeHtml(String(lab))}</span></label>`;
                            }).join("")}
                        </div>
                    </li>
                </ul>
            </div>
        </div>`;
        }
        return `
        <div>
            <label class="form-label mb-1">${escapeHtml(field.label || field.name)}</label>
            <input
                class="form-control"
                data-field="${escapeHtml(field.name)}"
                type="${field.type === "number" ? "number" : "text"}"
                value="${escapeHtml(field.defaultValue ?? "")}"
                ${field.min !== undefined ? `min="${field.min}"` : ""}
                ${field.max !== undefined ? `max="${field.max}"` : ""}
                placeholder="${escapeHtml(field.placeholder || "")}"
            >
        </div>`;
    }).join("");
    initActionConfirmDropdowns();
    const modalInstance = bootstrap.Modal.getOrCreateInstance(actionConfirmModalEl);
    return new Promise((resolve) => {
        let settled = false;
        const onHidden = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(null);
        };
        const onConfirm = () => {
            const values = {};
            for (const field of fields) {
                if (field.type === "multicheckbox") {
                    const wrap = actionConfirmModalFields.querySelector(`[data-field="${field.name}"][data-multicheckbox]`);
                    const checked = wrap ? Array.from(wrap.querySelectorAll("input:checked")).map((c) => {
                        const v = c.value;
                        return field.optionNumber ? parseInt(v, 10) : v;
                    }) : [];
                    values[field.name] = field.optionNumber ? checked.filter((n) => !Number.isNaN(n)) : checked;
                    continue;
                }
                if (field.type === "multiselect-dropdown") {
                    const container = actionConfirmModalFields.querySelector(`[data-field="${field.name}"][data-multiselect-dropdown]`);
                    const optionsEl = container?.querySelector(".action-confirm-dropdown-options");
                    const optionNumber = container?.getAttribute("data-option-number") === "true";
                    const checked = optionsEl ? Array.from(optionsEl.querySelectorAll("input:checked")).map((c) => {
                        const v = c.value;
                        return optionNumber ? parseInt(v, 10) : v;
                    }) : [];
                    values[field.name] = optionNumber ? checked.filter((n) => !Number.isNaN(n)) : checked;
                    continue;
                }
                const input = actionConfirmModalFields.querySelector(`input[data-field="${field.name}"]`);
                const raw = (input?.value || "").trim();
                if (field.required && !raw) {
                    show(`${field.label || field.name}不能为空`, "danger");
                    return;
                }
                if (field.type === "number") {
                    const num = Number(raw);
                    if (!Number.isFinite(num)) {
                        show(`${field.label || field.name}不合法`, "danger");
                        return;
                    }
                    const intValue = Math.trunc(num);
                    if ((field.min !== undefined && intValue < field.min)
                        || (field.max !== undefined && intValue > field.max)) {
                        show(`${field.label || field.name}范围应为 ${field.min ?? "-∞"} 到 ${field.max ?? "∞"}`, "danger");
                        return;
                    }
                    values[field.name] = intValue;
                } else {
                    values[field.name] = raw;
                }
            }
            settled = true;
            cleanup();
            modalInstance.hide();
            resolve(values);
        };
        const cleanup = () => {
            actionConfirmModalEl.removeEventListener("hidden.bs.modal", onHidden);
            actionConfirmModalConfirmBtn.removeEventListener("click", onConfirm);
        };
        actionConfirmModalEl.addEventListener("hidden.bs.modal", onHidden);
        actionConfirmModalConfirmBtn.addEventListener("click", onConfirm);
        modalInstance.show();
    });
}

function renderModuleTabs() {
    moduleTags.innerHTML = openedModules.map((key) => {
        const activeClass = key === activeModule ? "active" : "";
        return `
            <div class="module-tag ${activeClass}" data-module="${key}">
                <span class="module-tag-title">${MODULE_META[key].title}</span>
                ${key === "operation" ? "" : `<button type="button" class="module-tag-close" data-close="${key}">x</button>`}
            </div>
        `;
    }).join("");
}

function refreshModulePanels() {
    Object.entries(MODULE_META).forEach(([key, meta]) => {
        if (key === activeModule) {
            meta.panel.classList.remove("d-none");
        } else {
            meta.panel.classList.add("d-none");
        }
    });
    moduleMenuBtns.forEach((btn) => {
        const key = btn.getAttribute("data-module");
        btn.classList.toggle("active-menu", key === activeModule);
    });
    if (mobileOperationActions) {
        mobileOperationActions.classList.toggle("d-none", activeModule !== "operation");
    }
}

function activateModule(key) {
    if (!MODULE_META[key]) return;
    activeModule = key;
    renderModuleTabs();
    refreshModulePanels();
}

function closeExamSidebarNow() {
    const sidebar = document.getElementById("examSidebar");
    const backdrop = document.getElementById("examSidebarBackdrop");
    console.log("[sidebar] closeExamSidebarNow", {
        hasSidebar: !!sidebar,
        hasBackdrop: !!backdrop,
        wasOpen: !!sidebar?.classList?.contains("exam-sidebar-open"),
    });
    if (sidebar) {
        sidebar.classList.remove("exam-sidebar-open");
        // 抽屉模式下做强制收回：即使 CSS 被覆盖，也确保可见状态关闭
        if (isSidebarDrawerMode()) {
            sidebar.style.transform = "translateX(-100%)";
        }
    }
    if (backdrop) {
        backdrop.classList.remove("exam-sidebar-backdrop-visible");
        backdrop.setAttribute("aria-hidden", "true");
    }
}

function isDesktopSidebarCollapsed() {
    return !!examLayout?.classList.contains("exam-layout-sidebar-collapsed");
}

function setDesktopSidebarCollapsed(collapsed) {
    if (!examLayout) {
        console.log("[sidebar] setDesktopSidebarCollapsed skipped: examLayout is null", { collapsed });
        return;
    }

    if (!isSidebarDrawerMode()) {
        examLayout.classList.toggle("exam-layout-sidebar-collapsed", collapsed);
        console.log("[sidebar] setDesktopSidebarCollapsed", {
            collapsed,
            applied: examLayout.classList.contains("exam-layout-sidebar-collapsed"),
        });
    } else {
        // 进入移动端时，强制移除桌面收起状态，避免影响抽屉布局
        examLayout.classList.remove("exam-layout-sidebar-collapsed");
        console.log("[sidebar] setDesktopSidebarCollapsed ignored on mobile breakpoint", { collapsed });
    }

    if (examSidebarToggle) {
        if (collapsed) {
            examSidebarToggle.classList.remove("d-md-none");
            examSidebarToggle.classList.add("exam-sidebar-toggle-visible");
        } else {
            examSidebarToggle.classList.add("d-md-none");
            examSidebarToggle.classList.remove("exam-sidebar-toggle-visible");
        }
    }

    // 桌面“收起”不依赖移动端 open class，但顺带确保抽屉状态关闭
    if (collapsed) closeExamSidebarNow();
}

function openModule(key) {
    if (!MODULE_META[key]) return;
    const drawerMode = isSidebarDrawerMode();
    console.log("[sidebar] openModule", {
        key,
        drawerMode,
        examLayoutFound: !!examLayout,
        examSidebarFound: !!document.getElementById("examSidebar"),
    });
    // 仅在移动端抽屉模式下关闭侧边栏，桌面端保持原样
    if (drawerMode) {
        closeExamSidebarNow();
    }
    if (!openedModules.includes(key)) {
        openedModules.push(key);
    }
    activateModule(key);
    if (key === "stats") initStatsPanel();
    if (key === "records") {
        // 每次进入考试记录页都从后端刷新
        currentRecordPage = 1;
        void refreshExamHistory().catch(() => {});
    }
    if (key !== "examSession") {
        clearExamDraftTimer();
        clearExamSessionTimer();
    }
    // 移动端抽屉：避免某些情况下与点击/重绘时序叠加导致未收起
    if (drawerMode) {
        queueMicrotask(() => closeExamSidebarNow());
    }
}

function closeModule(key) {
    if (key === "operation") return;
    openedModules = openedModules.filter((it) => it !== key);
    if (!openedModules.length) {
        openedModules = ["operation"];
    }
    if (activeModule === key) {
        activeModule = openedModules[openedModules.length - 1];
    }
    renderModuleTabs();
    refreshModulePanels();
}

async function fetchBanks() {
    const res = await ApiClient.request("/banks");
    if (!res.ok) throw new Error("读取题库失败");
    return res.json();
}

const PARSING_STATUSES = ["PARSING", "INIT", "IN_PARSE_QUEUE"];

function isAnyDocumentParsing(docs) {
    if (!Array.isArray(docs) || !docs.length) return false;
    return docs.some((d) => {
        const status = (d.status || "").toUpperCase();
        const parseStatus = (d.parseStatus || "").toUpperCase();
        return status === "PARSING" || PARSING_STATUSES.includes(parseStatus);
    });
}

async function listDocuments(bankId) {
    const res = await ApiClient.request(`/banks/${bankId}/documents`);
    if (!res.ok) throw new Error("获取知识文件失败");
    return res.json();
}

async function startGenerateTaskAsync(bankId, count, types, outlineGuides) {
    const payload = { count, types };
    if (Array.isArray(outlineGuides) && outlineGuides.length) payload.outlineGuides = outlineGuides;
    const res = await ApiClient.request(`/banks/${bankId}/questions/generate/async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const msg = await readErrorMessage(res, "提交生成任务失败");
        throw new Error(msg);
    }
    const data = await res.json();
    if (!data?.taskId) throw new Error("服务端未返回任务 ID");
    return data.taskId;
}

async function pollGenerateTaskStatus(bankId, taskId) {
    const res = await ApiClient.request(`/banks/${bankId}/questions/generate-tasks/${taskId}`);
    if (!res.ok) {
        const msg = await readErrorMessage(res, "查询任务状态失败");
        throw new Error(msg);
    }
    return res.json();
}

async function cancelGenerateTask(bankId, taskId) {
    const res = await ApiClient.request(`/banks/${bankId}/questions/generate-tasks/${taskId}/cancel`, {
        method: "POST",
    });
    if (!res.ok) {
        const msg = await readErrorMessage(res, "中止任务失败");
        throw new Error(msg);
    }
    return res.json();
}

async function deleteGenerateTask(bankId, taskId) {
    const res = await ApiClient.request(`/banks/${bankId}/questions/generate-tasks/${taskId}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const msg = await readErrorMessage(res, "删除任务失败");
        throw new Error(msg);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderGenTasksUI() {
    const all = Array.from(genTaskMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    const activeCount = all.filter((t) => t.status === "PENDING" || t.status === "RUNNING").length;
    if (genTaskFab) genTaskFab.classList.toggle("d-none", all.length === 0);
    if (genTaskFabCount) genTaskFabCount.textContent = String(activeCount);

    if (!genTaskList) return;
    if (all.length === 0) {
        genTaskList.innerHTML = '<div class="text-secondary small">暂无题目生成任务</div>';
        syncGenerateButtonDisabledState();
        return;
    }
    genTaskList.innerHTML = all.map((task) => {
        const bankName = escapeHtml(getBankName(task.bankId));
        let statusBadge = "";
        let statusText = task.statusText || "";
        let progressBarHtml = "";
        if (task.status === "RUNNING" || task.status === "PENDING") {
            statusBadge = '<span class="badge bg-primary">生成中</span>';
            const total = task.count ?? 0;
            const done = task.questionsGenerated ?? 0;
            if (total > 0) {
                const pct = Math.min(100, Math.round((done / total) * 100));
                statusText = `已生成 ${done}/${total} 道题目`;
                progressBarHtml = `
                    <div class="progress mt-1" style="height: 6px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar"
                             style="width: ${pct}%;" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${total}"></div>
                    </div>`;
            } else {
                statusText = statusText || "正在生成...";
            }
        } else if (task.status === "SUCCESS") {
            statusBadge = '<span class="badge bg-success">已完成</span>';
            statusText = statusText || `已生成 ${task.questionsGenerated ?? 0} 道题目`;
        } else if (task.status === "CANCELLED") {
            statusBadge = '<span class="badge bg-secondary">已中止</span>';
            statusText = statusText || (task.message || "任务已中止");
        } else {
            statusBadge = '<span class="badge bg-danger">失败</span>';
            statusText = statusText || (task.message || "生成失败");
        }
        const cancelBtnHtml = (task.status === "RUNNING" || task.status === "PENDING")
            ? `<button class="btn btn-sm btn-outline-danger gen-task-cancel-btn" data-local-id="${escapeHtml(task.localId)}" ${task.cancelling ? "disabled" : ""}>${task.cancelling ? "中止中..." : "中止"}</button>`
            : "";
        const deleteBtnHtml = (task.status === "SUCCESS" || task.status === "FAILED")
            ? `<button class="btn btn-sm btn-outline-secondary gen-task-delete-btn" data-local-id="${escapeHtml(task.localId)}">删除</button>`
            : "";
        return `
            <div class="upload-task-item">
                <div class="upload-task-item-header d-flex justify-content-between align-items-start gap-2 mb-1">
                    <div class="fw-semibold upload-task-item-title">${bankName}</div>
                    <div class="upload-task-item-badge">${statusBadge}</div>
                </div>
                <div class="small text-secondary upload-task-item-status">${escapeHtml(statusText)}</div>
                ${progressBarHtml}
                <div class="mt-2 d-flex justify-content-end gap-2">${cancelBtnHtml}${deleteBtnHtml}</div>
            </div>
        `;
    }).join("");
    syncGenerateButtonDisabledState();
}

function openGenTaskModal() {
    renderGenTasksUI();
    if (genTaskModalBackdrop) genTaskModalBackdrop.classList.remove("d-none");
}

function closeGenTaskModal() {
    if (genTaskModalBackdrop) genTaskModalBackdrop.classList.add("d-none");
}

async function monitorGenTask(localId) {
    const task = genTaskMap.get(localId);
    if (!task || !task.taskId) return;
    const bankId = task.bankId;
    for (let i = 0; i < 600; i++) {
        try {
            const data = await pollGenerateTaskStatus(bankId, task.taskId);
            const t = genTaskMap.get(localId);
            if (!t) return;
            t.status = data?.status ?? t.status;
            t.count = data?.count ?? t.count;
            t.questionsGenerated = data?.questionsGenerated ?? t.questionsGenerated;
            t.message = data?.message ?? t.message;
            if (t.status === "SUCCESS") {
                const generated = t.questionsGenerated ?? 0;
                try {
                    await ApiClient.validateMe();
                } catch (_) {}
                updateQuestionUsageHint();
                t.statusText = `已生成 ${generated} 道题目`;
                renderGenTasksUI();
                if (String(bankSelect?.value) === String(bankId)) {
                    await refreshQuestions(1);
                    await refreshPapers();
                }
                saveGenTasksToStorage();
                return;
            }
            if (t.status === "FAILED") {
                t.statusText = t.message || "生成失败";
                renderGenTasksUI();
                show(t.statusText, "danger");
                saveGenTasksToStorage();
                return;
            }
            if (t.status === "CANCELLED") {
                t.statusText = t.message || "任务已中止";
                renderGenTasksUI();
                saveGenTasksToStorage();
                return;
            }
            const total = t.count ?? 0;
            const done = t.questionsGenerated ?? 0;
            t.statusText = total > 0 ? `已生成 ${done}/${total} 道题目` : "正在生成...";
            renderGenTasksUI();
            saveGenTasksToStorage();
        } catch (e) {
            const t = genTaskMap.get(localId);
            if (t) {
                t.status = "FAILED";
                t.statusText = t.message = e?.message || "轮询失败";
                renderGenTasksUI();
                show(t.statusText, "danger");
                setTimeout(() => {
                    genTaskMap.delete(localId);
                    saveGenTasksToStorage();
                    renderGenTasksUI();
                }, 5000);
            }
            return;
        }
        await sleep(1500);
    }
    const t = genTaskMap.get(localId);
    if (t) {
        t.status = "FAILED";
        t.statusText = "任务超时";
        renderGenTasksUI();
        show("题目生成任务超时", "danger");
        setTimeout(() => {
            genTaskMap.delete(localId);
            saveGenTasksToStorage();
            renderGenTasksUI();
        }, 5000);
    }
}

function updateQuestionUsageHint() {
    const el = document.getElementById("questionUsageHint");
    if (!el) return;
    const coins = Number(window.ApiClient?.getUser?.()?.baitaCoins ?? 0);
    const safeCoins = Number.isFinite(coins) ? coins : 0;
    const html = `
        <span class="small text-secondary mb-1 d-block">白塔币</span>
        <div class="usage-progress__text">余额：${safeCoins}（1 题 = 1 币）</div>
        <a class="small text-primary" href="./center.html" style="text-decoration:none;">去个人中心购买/查看赠送</a>
    `;
    el.innerHTML = html;
    var elMobile = document.getElementById("questionUsageHintMobile");
    if (elMobile) elMobile.innerHTML = html;
}

async function listQuestions(bankId) {
    const res = await ApiClient.request(`/banks/${bankId}/questions`);
    if (!res.ok) throw new Error("读取题目失败");
    return res.json();
}

async function listQuestionsPaged(bankId, page = 1, size = questionPageSize, difficulties = [], categories = [], types = []) {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    (difficulties || []).forEach((d) => params.append("difficulty", d));
    (categories || []).forEach((c) => params.append("category", c));
    (types || []).forEach((t) => params.append("type", t));
    const res = await ApiClient.request(`/banks/${bankId}/questions?${params.toString()}`);
    if (!res.ok) throw new Error("读取题目失败");
    return res.json();
}

async function listQuestionCategories(bankId) {
    const res = await ApiClient.request(`/banks/${bankId}/questions/categories`);
    if (!res.ok) return [];
    return res.json();
}

async function deleteQuestions(bankId, questionIds) {
    const res = await ApiClient.request(`/banks/${bankId}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds }),
    });
    if (!res.ok) {
        const message = await readErrorMessage(res, "批量删除题目失败");
        throw new Error(message);
    }
}

async function createManualPaper(payload) {
    const res = await ApiClient.request("/papers/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("手动组卷失败");
}

async function createAutoPaper(payload) {
    const res = await ApiClient.request("/papers/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("自动组卷失败");
}

async function listPapers(bankId) {
    const res = await ApiClient.request(`/papers/banks/${bankId}`);
    if (!res.ok) throw new Error("读取试卷失败");
    return res.json();
}

async function listPapersPaged(bankId, page = 1, size = paperPageSize) {
    const res = await ApiClient.request(`/papers/banks/${bankId}?page=${page}&size=${size}`);
    if (!res.ok) throw new Error("读取试卷失败");
    return res.json();
}

async function paperDetail(paperId, includeAnswer = false) {
    const res = await ApiClient.request(`/papers/${paperId}?includeAnswer=${includeAnswer}`);
    if (!res.ok) throw new Error("读取试卷详情失败");
    return res.json();
}

async function startRandomExam(payload) {
    const res = await ApiClient.request("/exams/random/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("开始考试失败");
    return res.json();
}

async function startExamByPaper(paperId, contextBankId) {
    const body = contextBankId != null ? JSON.stringify({ contextBankId: Number(contextBankId) }) : undefined;
    const res = await ApiClient.request(`/exams/papers/${paperId}/start`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
    });
    if (!res.ok) throw new Error("按试卷开始考试失败");
    return res.json();
}

async function resumeExam(examRecordId) {
    const res = await ApiClient.request(`/exams/${examRecordId}/resume`, { method: "POST" });
    if (!res.ok) {
        const data = await ApiClient.parseJsonSafe(res);
        // 控制台输出：便于定位后端报错原因
        console.error("[resumeExam] failed", {
            examRecordId,
            status: res.status,
            statusText: res.statusText,
            body: data,
        });
        throw new Error(data?.message || `继续考试失败(${res.status})`);
    }
    return res.json();
}

async function submitExam(examId, payload) {
    const res = await ApiClient.request(`/exams/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("提交考试失败");
    return res.json();
}

async function listExamRecords(bankId) {
    const res = await ApiClient.request(`/exams/banks/${bankId}`);
    if (!res.ok) throw new Error("读取考试结果失败");
    return res.json();
}

async function listExamRecordsPaged(bankId, page = 1, size = recordPageSize) {
    const res = await ApiClient.request(`/exams/banks/${bankId}?page=${page}&size=${size}`);
    if (!res.ok) throw new Error("读取考试结果失败");
    return res.json();
}

async function examRecordDetail(examRecordId) {
    const res = await ApiClient.request(`/exams/${examRecordId}/detail`);
    if (!res.ok) throw new Error("读取考试结果详情失败");
    return res.json();
}

async function getExamStats(bankId, paperId) {
    let url = `/exams/banks/${bankId}/stats`;
    if (paperId) url += `?paperId=${encodeURIComponent(paperId)}`;
    const res = await ApiClient.request(url);
    if (!res.ok) throw new Error("获取考试统计失败");
    return res.json();
}

let statsCharts = { examCount: null, wrongCount: null, score: null };

function getCurrentStatsBankId() {
    // 移动端统计复用左侧抽屉题库；桌面端优先使用统计区题库下拉。
    if (isMobileLike()) {
        return bankSelectMobile?.value || bankSelect?.value || "";
    }
    return statsBankSelect?.value || bankSelect?.value || "";
}

async function refreshStatsPaperOptionsByBank(bankId) {
    if (!statsPaperSelect) return;
    statsPaperSelect.innerHTML = '<option value="">全部试卷</option>';
    if (!bankId) return;
    try {
        const papers = await listPapers(bankId);
        (papers || []).forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.title || "未命名试卷";
            statsPaperSelect.appendChild(opt);
        });
    } catch (_) {}
}
let chartJsLoadPromise = null;

function ensureChartJsLoaded() {
    if (window.Chart) return Promise.resolve(true);
    if (chartJsLoadPromise) return chartJsLoadPromise;
    chartJsLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-chartjs="1"]');
        if (existing && window.Chart) {
            resolve(true);
            return;
        }
        const s = document.createElement("script");
        s.src = "https://cdn.bootcdn.net/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
        s.defer = true;
        s.setAttribute("data-chartjs", "1");
        s.onload = () => resolve(true);
        s.onerror = () => reject(new Error("Chart.js 加载失败"));
        document.head.appendChild(s);
    });
    return chartJsLoadPromise;
}

function destroyStatsCharts() {
    ["chartExamCount", "chartWrongCount", "chartScore"].forEach((id) => {
        const canvas = document.getElementById(id);
        if (canvas && typeof Chart !== "undefined") {
            const existing = Chart.getChart(canvas);
            if (existing) existing.destroy();
        }
    });
    statsCharts = { examCount: null, wrongCount: null, score: null };
}

function renderStatsCharts(stats) {
    destroyStatsCharts();
    const daily = stats?.dailyStats || [];
    const labels = daily.map((d) => d.date).reverse();
    const examCounts = daily.map((d) => d.examCount).reverse();
    const wrongCounts = daily.map((d) => d.wrongCount).reverse();
    const avgScores = daily.map((d) => Math.round(d.averageScore * 10) / 10).reverse();

    const narrowStats =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(max-width: 768px)").matches;

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                ticks: {
                    maxRotation: narrowStats ? 70 : 45,
                    minRotation: narrowStats ? 45 : 0,
                    maxTicksLimit: narrowStats ? 8 : 15,
                    autoSkip: true,
                    font: { size: narrowStats ? 9 : 11 },
                },
                grid: { display: !narrowStats },
            },
            y: {
                beginAtZero: true,
                ticks: { font: { size: narrowStats ? 9 : 11 } },
            },
        },
        layout: {
            padding: narrowStats ? { left: 0, right: 4, top: 4, bottom: 0 } : { left: 4, right: 8, top: 8, bottom: 4 },
        },
    };

    const c1 = document.getElementById("chartExamCount");
    if (c1 && window.Chart) {
        statsCharts.examCount = new Chart(c1, {
            type: "bar",
            data: {
                labels,
                datasets: [{ label: "答题次数", data: examCounts, backgroundColor: "rgba(59, 130, 246, 0.6)", borderColor: "rgb(59, 130, 246)", borderWidth: 1 }],
            },
            options: commonOptions,
        });
    }

    const c2 = document.getElementById("chartWrongCount");
    if (c2 && window.Chart) {
        statsCharts.wrongCount = new Chart(c2, {
            type: "line",
            data: {
                labels,
                datasets: [{ label: "错题数", data: wrongCounts, borderColor: "rgb(239, 68, 68)", backgroundColor: "rgba(239, 68, 68, 0.1)", fill: true, tension: 0.2 }],
            },
            options: commonOptions,
        });
    }

    const c3 = document.getElementById("chartScore");
    if (c3 && window.Chart) {
        statsCharts.score = new Chart(c3, {
            type: "line",
            data: {
                labels,
                datasets: [{ label: "平均得分", data: avgScores, borderColor: "rgb(34, 197, 94)", backgroundColor: "rgba(34, 197, 94, 0.1)", fill: true, tension: 0.2 }],
            },
            options: commonOptions,
        });
    }
}

function renderStatsSummary(stats) {
    if (!statsSummary) return;
    const daily = stats?.dailyStats || [];
    const totalExams = daily.reduce((s, d) => s + d.examCount, 0);
    const totalWrong = stats?.totalWrongAnswerCount ?? 0;
    const withScore = daily.filter((d) => d.examCount > 0);
    const avgScore = withScore.length ? (withScore.reduce((s, d) => s + d.averageScore * d.examCount, 0) / withScore.reduce((s, d) => s + d.examCount, 0)).toFixed(1) : "-";
    statsSummary.innerHTML = `
        <div class="col-12 col-md-4"><span class="text-secondary">总答题次数：</span><strong>${totalExams}</strong></div>
        <div class="col-12 col-md-4"><span class="text-secondary">总错题次数：</span><strong>${totalWrong}</strong></div>
        <div class="col-12 col-md-4"><span class="text-secondary">平均得分：</span><strong>${avgScore}</strong></div>
    `;
}

async function loadStatsAndCharts() {
    const bankId = getCurrentStatsBankId();
    if (!bankId) {
        if (statsSummary) statsSummary.innerHTML = "<span class=\"text-secondary\">请选择题库</span>";
        destroyStatsCharts();
        return;
    }
    const paperId = statsPaperSelect?.value || null;
    try {
        if (statsSummary) statsSummary.innerHTML = "加载中...";
        // Chart.js 体积较大：仅在进入统计模块/触发统计查询时再加载，避免拖慢首屏与接口调用
        await ensureChartJsLoaded().catch(() => null);
        const stats = await getExamStats(bankId, paperId || undefined);
        renderStatsSummary(stats);
        renderStatsCharts(stats);
    } catch (e) {
        if (statsSummary) statsSummary.innerHTML = `<span class="text-danger">${escapeHtml(e.message)}</span>`;
        destroyStatsCharts();
    }
}

async function showPublicStatsModal(paperId) {
    const content = document.getElementById("publicStatsContent");
    const modalEl = document.getElementById("publicStatsModal");
    if (!content || !modalEl) return;
    content.textContent = "加载中...";
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    try {
        const res = await ApiClient.request(`/papers/${paperId}/public-stats`);
        const data = await res.json();
        const reviews = (data.reviews || []).map((r) => `
            <div class="border-bottom pb-2 mb-2">
                <span class="fw-medium">${escapeHtml(r.username || "用户")}</span>
                <span class="text-warning">${"★".repeat(r.rating || 0)}${"☆".repeat(5 - (r.rating || 0))}</span>
                <span class="text-secondary small ms-1">${r.createdAt ? new Date(r.createdAt).toLocaleString("zh-CN") : ""}</span>
                ${r.comment ? `<div class="mt-1">${escapeHtml(r.comment)}</div>` : ""}
            </div>
        `).join("") || "<span class=\"text-secondary\">暂无评价</span>";
        content.innerHTML = `
            <div class="mb-3">
                <div>访问次数：<strong>${data.viewCount ?? 0}</strong></div>
                <div>订阅次数：<strong>${data.subscribeCount ?? 0}</strong></div>
                <div>平均评分：<strong>${data.averageRating != null ? data.averageRating : "-"}</strong></div>
            </div>
            <div><strong>评价列表</strong></div>
            <div class="mt-2">${reviews}</div>
        `;
    } catch (e) {
        content.innerHTML = `<span class="text-danger">${escapeHtml(e.message || "加载失败")}</span>`;
    }
}

async function initStatsPanel() {
    if (!statsPaperSelect) return;
    if (statsBankSelect) {
        const banks = await fetchBanks();
        statsBankSelect.innerHTML = "";
        banks.forEach((b) => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.name;
            statsBankSelect.appendChild(opt);
        });
        if (bankSelect?.value && Array.from(statsBankSelect.options).some((o) => o.value === bankSelect.value)) {
            statsBankSelect.value = bankSelect.value;
        }
    }
    const bankId = getCurrentStatsBankId();
    await refreshStatsPaperOptionsByBank(bankId);
    await loadStatsAndCharts();
}

function difficultyStars(level) {
    if (level == null || level === undefined) return "";
    const n = Math.max(1, Math.min(5, Number(level)));
    return "★".repeat(n) + "☆".repeat(5 - n);
}

function renderQuestionPool(list, { append = false } = {}) {
    if (!append) questionPool.innerHTML = "";
    const startIndex = append ? questionPool.querySelectorAll(".question-row").length : 0;
    list.forEach((q, i) => {
        const item = document.createElement("div");
        item.className = "question-row p-3";
        const options = parseOptions(q.optionsJson);
        const badgeClass = q.type === "SINGLE_CHOICE" ? "choice" : q.type === "MULTIPLE_CHOICE" ? "choice" : q.type === "TRUE_FALSE" ? "tf" : "short";
        const stars = difficultyStars(q.difficulty);
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start gap-2">
                <div class="question-row-content">
                    <label class="mb-2"><input class="form-check-input me-2" type="checkbox" data-qid="${q.id}" ${selectedQuestionIds.has(q.id) ? "checked" : ""}>${startIndex + i + 1}. ${q.stem}</label>
                </div>
                <div class="d-flex align-items-center gap-2 flex-shrink-0">
                    ${stars ? `<span class="text-warning small" title="难度">${stars}</span>` : ""}
                    <span class="question-badge ${badgeClass}">${typeLabel(q.type)}</span>
                </div>
            </div>
            ${options.length ? `<ul class="small mb-2 list-unstyled">${options.map((o, idx) => `<li>${escapeHtml(formatOptionDisplay(o, idx))}</li>`).join("")}</ul>` : ""}
        `;
        const checkbox = item.querySelector("input[data-qid]");
        checkbox.addEventListener("change", () => {
            const id = Number(checkbox.getAttribute("data-qid"));
            if (checkbox.checked) {
                selectedQuestionIds.add(id);
            } else {
                selectedQuestionIds.delete(id);
            }
            syncSelectAllState();
        });
        questionPool.appendChild(item);
    });
    syncSelectAllState();
}

function syncSelectAllState() {
    const checkboxes = Array.from(questionPool.querySelectorAll("input[data-qid]"));
    if (!checkboxes.length) {
        selectAllQuestions.checked = false;
        return;
    }
    selectAllQuestions.checked = checkboxes.every((x) => x.checked);
}

function updateQuestionPager(page, totalPages) {
    currentQuestionPage = page;
    currentQuestionTotalPages = totalPages || 1;
    if (isMobileLike()) {
        questionPageInfo.textContent = "";
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        prevPageBtn.classList.add("d-none");
        nextPageBtn.classList.add("d-none");
    } else {
        questionPageInfo.textContent = `第 ${currentQuestionPage} / ${currentQuestionTotalPages} 页`;
        prevPageBtn.disabled = currentQuestionPage <= 1;
        nextPageBtn.disabled = currentQuestionPage >= currentQuestionTotalPages;
        prevPageBtn.classList.remove("d-none");
        nextPageBtn.classList.remove("d-none");
    }
}

const FILTER_TAG_MAX = 3;
let mobileFilterRefreshTimer = 0;

function collapseMobileQuestionFiltersDrawer() {
    if (!questionFiltersDrawer || !isMobileLike()) return;
    questionFiltersDrawer.removeAttribute("open");
}

function syncQuestionFiltersDrawerForViewport() {
    if (!questionFiltersDrawer) return;
    if (isMobileLike()) return;
    // 网页端始终展示查询条件，避免折叠状态导致看不到筛选项
    questionFiltersDrawer.setAttribute("open", "");
}

function triggerMobileFilterRefresh({ immediate = false } = {}) {
    if (!isMobileLike()) return;
    if (mobileFilterRefreshTimer) {
        clearTimeout(mobileFilterRefreshTimer);
        mobileFilterRefreshTimer = 0;
    }
    const run = async () => {
        try {
            await refreshQuestions(1);
        } catch (e) {
            show(e?.message || "查询失败", "danger");
        }
    };
    if (immediate) {
        void run();
        return;
    }
    mobileFilterRefreshTimer = setTimeout(() => {
        mobileFilterRefreshTimer = 0;
        void run();
    }, 120);
}

function getSelectedDifficultyFilter() {
    const el = document.getElementById("filterDifficulty");
    if (!el) return [];
    return Array.from(el.querySelectorAll("input:checked")).map((c) => parseInt(c.value, 10)).filter((n) => !Number.isNaN(n));
}

function getSelectedKnowledgeFileFilter() {
    const el = document.getElementById("filterKnowledgeFile");
    if (!el) return [];
    return Array.from(el.querySelectorAll("input:checked")).map((c) => String(c.value || "")).filter(Boolean);
}

function getSelectedOutlineFilter() {
    const el = document.getElementById("filterOutline");
    if (!el) return [];
    return Array.from(el.querySelectorAll("input:checked")).map((c) => c.value).filter(Boolean);
}

function renderFilterDifficultyTags() {
    const tagsEl = document.getElementById("filterDifficultyTags");
    const moreEl = document.getElementById("filterDifficultyMore");
    const checkboxesEl = document.getElementById("filterDifficulty");
    if (!tagsEl || !moreEl || !checkboxesEl) return;
    const selected = getSelectedDifficultyFilter().sort((a, b) => a - b);
    const items = selected.map((n) => ({ value: n, label: n + "星" }));
    const visible = items.slice(0, FILTER_TAG_MAX);
    const restCount = items.length - FILTER_TAG_MAX;
    tagsEl.innerHTML = visible.map((item) => `
        <span class="filter-select-tag" data-value="${item.value}">
            <span class="filter-select-tag-text">${escapeHtml(item.label)}</span>
            <button type="button" class="filter-select-tag-close" aria-label="移除">×</button>
        </span>`).join("");
    tagsEl.querySelectorAll(".filter-select-tag-close").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const value = Number(btn.closest(".filter-select-tag")?.getAttribute("data-value"));
            const cb = checkboxesEl.querySelector(`input[value="${value}"]`);
            if (cb) {
                cb.checked = false;
                renderFilterDifficultyTags();
                triggerMobileFilterRefresh({ immediate: true });
            }
        });
    });
    if (restCount > 0) {
        moreEl.textContent = "+" + restCount;
        moreEl.classList.remove("d-none");
    } else {
        moreEl.classList.add("d-none");
    }
}

function initDialogGenTypes() {
    const wrap = document.getElementById("dialogGenTypesWrap");
    if (!wrap) return;
    wrap.innerHTML = `
        <div class="dropdown filter-select-dropdown" id="dialogGenTypesDropdown" data-bs-auto-close="outside">
            <div class="filter-select-trigger d-flex align-items-stretch" data-bs-toggle="dropdown" aria-expanded="false" aria-haspopup="true" title="选择题型">
                <div class="filter-select-bar flex-grow-1" id="dialogGenTypesBar">
                    <div class="filter-select-tags" id="dialogGenTypesTags"></div>
                    <span class="filter-select-more d-none" id="dialogGenTypesMore"></span>
                </div>
                <span class="filter-select-toggle"><i class="bi bi-chevron-down"></i></span>
            </div>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm" id="dialogGenTypesMenu">
                <li class="px-3 py-2">
                    <div id="dialogGenTypesOptions" class="d-flex flex-column gap-1"></div>
                </li>
            </ul>
        </div>`;
    const optionsEl = document.getElementById("dialogGenTypesOptions");
    const tagsEl = document.getElementById("dialogGenTypesTags");
    const moreEl = document.getElementById("dialogGenTypesMore");
    if (!optionsEl || !tagsEl || !moreEl) return;
    optionsEl.innerHTML = QUESTION_TYPE_OPTIONS.map((opt, i) => `
        <label class="form-check filter-option-row mb-0">
            <input class="form-check-input dialog-gen-type-cb filter-option-cb-hidden" type="checkbox" value="${escapeHtml(opt.value)}" id="dialogGenType${i}" checked>
            <span class="small">${escapeHtml(opt.label)}</span>
        </label>`).join("");
    optionsEl.querySelectorAll(".dialog-gen-type-cb").forEach((cb) => {
        cb.addEventListener("change", renderDialogGenTypesTags);
    });
    const dialogMenu = document.getElementById("dialogGenTypesMenu");
    if (dialogMenu) {
        dialogMenu.addEventListener("click", (e) => e.stopPropagation());
    }
    renderDialogGenTypesTags();
}

function renderDialogGenTypesTags() {
    const tagsEl = document.getElementById("dialogGenTypesTags");
    const moreEl = document.getElementById("dialogGenTypesMore");
    const optionsEl = document.getElementById("dialogGenTypesOptions");
    if (!tagsEl || !moreEl || !optionsEl) return;
    const selected = Array.from(optionsEl.querySelectorAll("input:checked")).map((c) => c.value);
    const items = selected.map((v) => ({
        value: v,
        label: QUESTION_TYPE_OPTIONS.find((o) => o.value === v)?.label || v,
    }));
    const visible = items.slice(0, FILTER_TAG_MAX);
    const restCount = items.length - FILTER_TAG_MAX;
    tagsEl.innerHTML = visible.map((item) => `
        <span class="filter-select-tag" data-value="${escapeHtml(item.value)}">
            <span class="filter-select-tag-text">${escapeHtml(item.label)}</span>
            <button type="button" class="filter-select-tag-close" aria-label="移除">×</button>
        </span>`).join("");
    tagsEl.querySelectorAll(".filter-select-tag-close").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const value = btn.closest(".filter-select-tag")?.getAttribute("data-value");
            const cb = Array.from(optionsEl.querySelectorAll("input")).find((inp) => inp.value === value);
            if (cb) {
                cb.checked = false;
                renderDialogGenTypesTags();
            }
        });
    });
    if (restCount > 0) {
        moreEl.textContent = "+" + restCount;
        moreEl.classList.remove("d-none");
    } else {
        moreEl.classList.add("d-none");
    }
}

function getDialogGenTypes() {
    const optionsEl = document.getElementById("dialogGenTypesOptions");
    if (!optionsEl) return [];
    return Array.from(optionsEl.querySelectorAll("input:checked")).map((c) => c.value);
}

function renderFilterKnowledgeFileTags() {
    const tagsEl = document.getElementById("filterKnowledgeFileTags");
    const moreEl = document.getElementById("filterKnowledgeFileMore");
    const checkboxesEl = document.getElementById("filterKnowledgeFile");
    if (!tagsEl || !moreEl || !checkboxesEl) return;
    const selected = getSelectedKnowledgeFileFilter();
    const items = selected.map((v) => {
        const opt = currentKnowledgeFileOptionMap.get(String(v));
        return { value: String(v), label: opt?.baseName || String(v) };
    });
    const visible = items.slice(0, FILTER_TAG_MAX);
    const restCount = items.length - FILTER_TAG_MAX;
    tagsEl.innerHTML = visible.map((item) => `
        <span class="filter-select-tag" data-value="${escapeHtml(item.value)}">
            <span class="filter-select-tag-text">${escapeHtml(item.label)}</span>
            <button type="button" class="filter-select-tag-close" aria-label="移除">×</button>
        </span>`).join("");
    tagsEl.querySelectorAll(".filter-select-tag-close").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const value = btn.closest(".filter-select-tag")?.getAttribute("data-value");
            const cb = Array.from(checkboxesEl.querySelectorAll("input")).find((inp) => inp.value === value);
            if (cb) {
                cb.checked = false;
                renderFilterKnowledgeFileTags();
                void renderOutlineFilterBySelectedKnowledgeFiles().then(() => {
                    triggerMobileFilterRefresh({ immediate: true });
                });
            }
        });
    });
    if (restCount > 0) {
        moreEl.textContent = "+" + restCount;
        moreEl.classList.remove("d-none");
    } else {
        moreEl.classList.add("d-none");
    }
}

function renderFilterOutlineTags() {
    const tagsEl = document.getElementById("filterOutlineTags");
    const moreEl = document.getElementById("filterOutlineMore");
    const checkboxesEl = document.getElementById("filterOutline");
    if (!tagsEl || !moreEl || !checkboxesEl) return;
    const selected = getSelectedOutlineFilter();
    const items = selected.map((v) => ({ value: v, label: v }));
    const visible = items.slice(0, FILTER_TAG_MAX);
    const restCount = items.length - FILTER_TAG_MAX;
    tagsEl.innerHTML = visible.map((item) => `
        <span class="filter-select-tag" data-value="${escapeHtml(item.value)}">
            <span class="filter-select-tag-text">${escapeHtml(item.label)}</span>
            <button type="button" class="filter-select-tag-close" aria-label="移除">×</button>
        </span>`).join("");
    tagsEl.querySelectorAll(".filter-select-tag-close").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const value = btn.closest(".filter-select-tag")?.getAttribute("data-value");
            const cb = Array.from(checkboxesEl.querySelectorAll("input")).find((inp) => inp.value === value);
            if (cb) {
                cb.checked = false;
                renderFilterOutlineTags();
                triggerMobileFilterRefresh({ immediate: true });
            }
        });
    });
    if (restCount > 0) {
        moreEl.textContent = "+" + restCount;
        moreEl.classList.remove("d-none");
    } else {
        moreEl.classList.add("d-none");
    }
}

function parseSourceCategory(category, docBaseNames = []) {
    const raw = String(category || "").trim();
    if (!raw) return { fileName: "", outlineTitle: "", full: "" };
    let matchedFile = "";
    for (const fileName of docBaseNames) {
        if (!fileName) continue;
        if (raw === fileName || raw.startsWith(fileName + "-")) {
            if (!matchedFile || fileName.length > matchedFile.length) {
                matchedFile = fileName;
            }
        }
    }
    if (matchedFile) {
        const rest = raw === matchedFile ? "" : raw.slice(matchedFile.length + 1).trim();
        return { fileName: matchedFile, outlineTitle: rest, full: raw };
    }
    const splitAt = raw.indexOf("-");
    if (splitAt <= 0) {
        return { fileName: raw, outlineTitle: "", full: raw };
    }
    return {
        fileName: raw.slice(0, splitAt).trim(),
        outlineTitle: raw.slice(splitAt + 1).trim(),
        full: raw,
    };
}

function buildSourceFilterMaps(categories, docBaseNames = []) {
    const fileMap = new Map();
    (docBaseNames || []).forEach((name) => {
        const n = String(name || "").trim();
        if (!n) return;
        if (!fileMap.has(n)) fileMap.set(n, []);
    });
    for (const category of categories || []) {
        const parsed = parseSourceCategory(category, docBaseNames);
        if (!parsed.fileName) continue;
        if (!fileMap.has(parsed.fileName)) fileMap.set(parsed.fileName, []);
        fileMap.get(parsed.fileName).push(parsed);
    }
    currentFileCategoryMap = new Map();
    for (const [fileName, list] of fileMap.entries()) {
        const fulls = Array.from(new Set(list.map((it) => it.full).filter(Boolean)));
        currentFileCategoryMap.set(fileName, fulls);
    }
}

async function loadOutlineTitlesByFileId(bankId, fileId) {
    const key = String(fileId || "");
    if (!key) return [];
    if (currentOutlineCacheByFileId.has(key)) {
        return currentOutlineCacheByFileId.get(key) || [];
    }
    let titles = [];
    try {
        const outline = await fetchDocumentOutline(bankId, Number(key));
        const blocks = Array.isArray(outline?.blocks) ? outline.blocks : [];
        titles = Array.from(new Set(
            blocks
                .map((b) => String(b?.title || "").trim())
                .filter(Boolean)
        ));
    } catch (_) {
        titles = [];
    }
    currentOutlineCacheByFileId.set(key, titles);
    return titles;
}

async function renderOutlineFilterBySelectedKnowledgeFiles() {
    const outlineItem = document.getElementById("filterOutlineItem");
    const outlineEl = document.getElementById("filterOutline");
    if (!outlineItem || !outlineEl) return;
    const bankId = bankSelect?.value;
    const selectedFileIds = getSelectedKnowledgeFileFilter();
    const prevSelected = new Set(getSelectedOutlineFilter());
    const outlineMap = new Map();
    if (selectedFileIds.length && bankId) {
        for (const fileId of selectedFileIds) {
            const fileMeta = currentKnowledgeFileOptionMap.get(String(fileId));
            const fileBaseName = fileMeta?.baseName || "";
            const titles = await loadOutlineTitlesByFileId(bankId, fileId);
            titles.forEach((title) => {
                const display = fileBaseName ? `${fileBaseName}-${title}` : title;
                if (!outlineMap.has(display)) outlineMap.set(display, []);
                const matchedFull = (currentFileCategoryMap.get(fileBaseName) || [])
                    .filter((full) => full === display || full.endsWith(`-${title}`));
                const fallbackFull = matchedFull.length ? matchedFull : [display];
                outlineMap.get(display).push(...fallbackFull);
            });
        }
    }
    currentOutlineCategoryMap = outlineMap;
    const outlines = Array.from(outlineMap.keys()).sort((a, b) => a.localeCompare(b, "zh-CN"));
    if (!outlines.length) {
        outlineItem.classList.add("d-none");
        outlineEl.innerHTML = "";
        const tagsEl = document.getElementById("filterOutlineTags");
        if (tagsEl) tagsEl.innerHTML = "";
        const moreEl = document.getElementById("filterOutlineMore");
        if (moreEl) moreEl.classList.add("d-none");
        return;
    }
    outlineItem.classList.remove("d-none");
    outlineEl.innerHTML = outlines.map((o, i) => `
        <label class="form-check filter-option-row mb-0">
            <input class="form-check-input filter-outline-cb filter-option-cb-hidden" type="checkbox" value="${escapeHtml(o)}" id="fo${i}" ${prevSelected.has(o) ? "checked" : ""}>
            <span class="small">${escapeHtml(o)}</span>
        </label>`).join("");
    outlineEl.querySelectorAll(".filter-outline-cb").forEach((cb) => {
        cb.addEventListener("change", () => {
            renderFilterOutlineTags();
            triggerMobileFilterRefresh({ immediate: true });
        });
    });
    const outlineMenu = document.getElementById("filterOutlineMenu");
    if (outlineMenu) outlineMenu.addEventListener("click", (e) => e.stopPropagation());
    renderFilterOutlineTags();
}

function getSelectedQuestionTypeFilter() {
    const el = document.getElementById("filterQuestionType");
    if (!el) return [];
    return Array.from(el.querySelectorAll("input:checked")).map((c) => c.value);
}

function renderFilterQuestionTypeTags() {
    const tagsEl = document.getElementById("filterQuestionTypeTags");
    const moreEl = document.getElementById("filterQuestionTypeMore");
    const checkboxesEl = document.getElementById("filterQuestionType");
    if (!tagsEl || !moreEl || !checkboxesEl) return;
    const selected = getSelectedQuestionTypeFilter();
    const items = selected.map((v) => ({
        value: v,
        label: QUESTION_TYPE_OPTIONS.find((o) => o.value === v)?.label || v,
    }));
    const visible = items.slice(0, FILTER_TAG_MAX);
    const restCount = items.length - FILTER_TAG_MAX;
    tagsEl.innerHTML = visible.map((item) => `
        <span class="filter-select-tag" data-value="${escapeHtml(item.value)}">
            <span class="filter-select-tag-text">${escapeHtml(item.label)}</span>
            <button type="button" class="filter-select-tag-close" aria-label="移除">×</button>
        </span>`).join("");
    tagsEl.querySelectorAll(".filter-select-tag-close").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const value = btn.closest(".filter-select-tag")?.getAttribute("data-value");
            const cb = Array.from(checkboxesEl.querySelectorAll("input")).find((inp) => inp.value === value);
            if (cb) {
                cb.checked = false;
                renderFilterQuestionTypeTags();
                triggerMobileFilterRefresh({ immediate: true });
            }
        });
    });
    if (restCount > 0) {
        moreEl.textContent = "+" + restCount;
        moreEl.classList.remove("d-none");
    } else {
        moreEl.classList.add("d-none");
    }
}

async function loadQuestionFilters(bankId) {
    const diffEl = document.getElementById("filterDifficulty");
    const fileEl = document.getElementById("filterKnowledgeFile");
    const typeEl = document.getElementById("filterQuestionType");
    if (!diffEl || !fileEl || !typeEl) return;
    diffEl.innerHTML = [1, 2, 3, 4, 5].map((n) => `
        <label class="form-check filter-option-row mb-0">
            <input class="form-check-input filter-diff-cb filter-option-cb-hidden" type="checkbox" value="${n}" id="fd${n}">
            <span class="small">${n}星</span>
        </label>`).join("");
    diffEl.querySelectorAll(".filter-diff-cb").forEach((cb) => {
        cb.addEventListener("change", () => {
            renderFilterDifficultyTags();
            triggerMobileFilterRefresh();
        });
    });
    const diffMenu = document.getElementById("filterDifficultyMenu");
    if (diffMenu) {
        diffMenu.addEventListener("click", (e) => e.stopPropagation());
    }

    let categories = [];
    let docs = [];
    if (bankId) {
        try {
            categories = await listQuestionCategories(bankId);
        } catch (_) {}
        try {
            docs = await listDocuments(bankId);
        } catch (_) {}
    }
    currentQuestionCategoryOptions = Array.isArray(categories)
        ? categories.map((c) => String(c || "").trim()).filter(Boolean)
        : [];
    currentKnowledgeFileOptionMap = new Map();
    currentOutlineCacheByFileId = new Map();
    const docOptions = (docs || [])
        .map((d) => {
            const id = d?.id != null ? String(d.id) : "";
            const fileName = String(d?.fileName || "").trim();
            const baseName = stripFileExtension(fileName);
            return { id, fileName, baseName };
        })
        .filter((d) => d.id && d.baseName);
    docOptions.forEach((d) => currentKnowledgeFileOptionMap.set(d.id, d));
    const docBaseNames = docOptions.map((d) => d.baseName);
    buildSourceFilterMaps(currentQuestionCategoryOptions, docBaseNames);
    fileEl.innerHTML = docOptions.length
        ? docOptions.map((d, i) => `
            <label class="form-check filter-option-row mb-0">
                <input class="form-check-input filter-file-cb filter-option-cb-hidden" type="checkbox" value="${escapeHtml(d.id)}" id="ff${i}">
                <span class="small">${escapeHtml(d.baseName)}</span>
            </label>`).join("")
        : '<span class="small text-muted">暂无知识文件</span>';
    fileEl.querySelectorAll(".filter-file-cb").forEach((cb) => {
        cb.addEventListener("change", () => {
            renderFilterKnowledgeFileTags();
            void renderOutlineFilterBySelectedKnowledgeFiles().then(() => {
                triggerMobileFilterRefresh({ immediate: true });
            });
        });
    });
    const fileMenu = document.getElementById("filterKnowledgeFileMenu");
    if (fileMenu) {
        fileMenu.addEventListener("click", (e) => e.stopPropagation());
    }

    typeEl.innerHTML = QUESTION_TYPE_OPTIONS.map((opt, i) => `
        <label class="form-check filter-option-row mb-0">
            <input class="form-check-input filter-qtype-cb filter-option-cb-hidden" type="checkbox" value="${escapeHtml(opt.value)}" id="fqt${i}">
            <span class="small">${escapeHtml(opt.label)}</span>
        </label>`).join("");
    typeEl.querySelectorAll(".filter-qtype-cb").forEach((cb) => {
        cb.addEventListener("change", () => {
            renderFilterQuestionTypeTags();
            triggerMobileFilterRefresh();
        });
    });
    const typeMenu = document.getElementById("filterQuestionTypeMenu");
    if (typeMenu) {
        typeMenu.addEventListener("click", (e) => e.stopPropagation());
    }

    renderFilterDifficultyTags();
    renderFilterKnowledgeFileTags();
    await renderOutlineFilterBySelectedKnowledgeFiles();
    renderFilterQuestionTypeTags();
}

async function refreshQuestions(page = currentQuestionPage) {
    const bankId = bankSelect.value;
    const difficulties = getSelectedDifficultyFilter();
    const selectedFiles = getSelectedKnowledgeFileFilter();
    const selectedOutlines = getSelectedOutlineFilter();
    let categories = [];
    if (selectedFiles.length) {
        if (selectedOutlines.length) {
            selectedOutlines.forEach((outlineTitle) => {
                (currentOutlineCategoryMap.get(outlineTitle) || []).forEach((full) => categories.push(full));
            });
        } else {
            selectedFiles.forEach((fileId) => {
                const fileMeta = currentKnowledgeFileOptionMap.get(String(fileId));
                const fileName = fileMeta?.baseName || "";
                (currentFileCategoryMap.get(fileName) || []).forEach((full) => categories.push(full));
            });
        }
    }
    categories = Array.from(new Set(categories));
    const types = getSelectedQuestionTypeFilter();
    const mobile = isMobileLike();
    const append = mobile && page > 1;
    const data = await listQuestionsPaged(bankId, page, questionPageSize, difficulties, categories, types);
    const items = Array.isArray(data.items) ? data.items : [];
    if (mobile) {
        if (!append) mobileQuestionItems = [];
        mobileQuestionItems = mobileQuestionItems.concat(items);
        renderQuestionPool(items, { append });
    } else {
        renderQuestionPool(items, { append: false });
    }
    updateQuestionPager(data.page || page, data.totalPages || 1);
}

async function refreshPapers({ page = currentPaperPage, append = false } = {}) {
    const data = await listPapersPaged(bankSelect.value, page, paperPageSize);
    const list = Array.isArray(data.items) ? data.items : [];
    currentPaperPage = data.page || page;
    currentPaperTotalPages = data.totalPages || 1;
    const mobile = isMobileLike();
    if (mobile) {
        if (!append) mobilePaperItems = [];
        mobilePaperItems = mobilePaperItems.concat(list);
    }
    if (paperPageInfo) {
        paperPageInfo.textContent = mobile ? "" : `第 ${currentPaperPage} / ${currentPaperTotalPages} 页`;
    }
    if (paperPrevBtn) {
        paperPrevBtn.disabled = mobile ? true : (currentPaperPage <= 1);
        paperPrevBtn.classList.toggle("d-none", mobile);
    }
    if (paperNextBtn) {
        paperNextBtn.disabled = mobile ? true : (currentPaperPage >= currentPaperTotalPages);
        paperNextBtn.classList.toggle("d-none", mobile);
    }
    if (!append) paperList.innerHTML = "";
    const currentUserId = ApiClient.getUser()?.id ?? null;
    list.forEach((p) => {
        const div = document.createElement("div");
        div.className = "question-row p-3 d-flex justify-content-between align-items-center flex-wrap gap-2";
        const isMine = currentUserId != null && p.ownerUserId === currentUserId;
        const isPublic = p.isPublic === true;
        const shareBtnHtml = isMine
            ? (isPublic
                ? `<button class="btn btn-sm btn-outline-secondary" data-stats data-paper-id="${p.id}">统计</button><button class="btn btn-sm btn-outline-warning" data-unshare data-paper-id="${p.id}">取消分享</button>`
                : `<button class="btn btn-sm btn-outline-success" data-share data-paper-id="${p.id}">分享到公共区</button>`)
            : "";
        div.innerHTML = `
            <div class="paper-list-item-content flex-grow-1">
                <div class="fw-semibold">${p.title}</div>
                <div class="text-secondary small">模式：${p.mode}</div>
            </div>
            <div class="d-flex gap-1 align-items-center">
                ${shareBtnHtml}
            </div>
        `;
        const contentArea = div.querySelector(".paper-list-item-content");
        const openPaperDetail = async () => {
            const detail = await paperDetail(p.id, false);
            const TYPE_ORDER = { SINGLE_CHOICE: 1, MULTIPLE_CHOICE: 2, TRUE_FALSE: 3, SHORT_ANSWER: 4 };
            const typeGroups = (detail.questions || []).slice().sort((a, b) => {
                const oa = TYPE_ORDER[a.type] ?? 99;
                const ob = TYPE_ORDER[b.type] ?? 99;
                if (oa !== ob) return oa - ob;
                return (a.id ?? 0) - (b.id ?? 0);
            });
            paperDetailView.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="fw-semibold">${detail.paper?.title || "未命名试卷"}</div>
                    <button class="btn btn-sm btn-success" type="button" data-start-by-paper>按此试卷开始考试</button>
                </div>
                ${(() => {
                    let html = "";
                    let seq = 0;
                    let lastType = "";
                    typeGroups.forEach((q) => {
                        if (q.type !== lastType) {
                            lastType = q.type;
                            html += `<div class="mt-3 mb-2 fw-semibold text-secondary">${escapeHtml(typeLabel(q.type))}</div>`;
                        }
                        seq += 1;
                    const options = parseOptions(q.optionsJson);
                    const isChoice = q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE";
                    const optionsHtml = isChoice && options.length
                        ? `<ul class="small mb-0 mt-1 list-unstyled text-secondary">${options.map((o, idx) => `<li>${escapeHtml(formatOptionDisplay(o, idx))}</li>`).join("")}</ul>`
                        : "";
                        html += `
                <div class="question-row p-3">
                    <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div class="question-row-content fw-medium">${seq}. ${escapeHtml(q.stem || "")}</div>
                        <span class="question-badge ${q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE" ? "choice" : q.type === "TRUE_FALSE" ? "tf" : "short"}">${typeLabel(q.type)}</span>
                    </div>
                    ${optionsHtml}
                </div>
                `;
                    });
                    return html;
                })()}
            `;
            const startBtn = paperDetailView.querySelector("[data-start-by-paper]");
            if (startBtn) {
                startBtn.addEventListener("click", async () => {
                    const started = await startExamByPaper(p.id, bankSelect?.value || null);
                    currentExamId = started.examRecordId;
                    renderExamQuestions(started.paper.questions);
                    try {
                        const draftMap = await loadExamDraft(currentExamId);
                        applyDraftToUI(draftMap);
                    } catch (e) {
                        console.warn("[draft] load failed", e?.message || e);
                    }
                    startAutoSaveDraft();
                    examResult.innerHTML = "";
                    const title = detail.paper?.title || p.title || "未命名试卷";
                    void loadExamSessionMeta(currentExamId, title).catch(() => {});
                    showExamSession(`考试来源：试卷《${title}》，记录ID：${currentExamId}`);
                    show(`已按试卷开始考试，记录ID：${currentExamId}`);
                });
            }
            paperListSection.classList.add("d-none");
            paperDetailSection.classList.remove("d-none");
            openModule("papers");
        };
        if (contentArea) contentArea.addEventListener("click", openPaperDetail);
        const shareBtn = div.querySelector("[data-share]");
        if (shareBtn) {
            shareBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                try {
                    await ApiClient.request(`/papers/${p.id}/share`, { method: "PUT" });
                    show("已分享到公共区");
                    await refreshPapers();
                } catch (err) {
                    show(err.message || "分享失败", "danger");
                }
            });
        }
        const statsBtn = div.querySelector("[data-stats]");
        if (statsBtn) statsBtn.addEventListener("click", (e) => { e.stopPropagation(); showPublicStatsModal(p.id); });
        const unshareBtn = div.querySelector("[data-unshare]");
        if (unshareBtn) {
            unshareBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!window.confirm("确定取消分享？取消后他人将无法再浏览或订阅该试卷。")) return;
                try {
                    await ApiClient.request(`/papers/${p.id}/unshare`, { method: "PUT" });
                    show("已取消分享");
                    await refreshPapers();
                } catch (err) {
                    show(err.message || "操作失败", "danger");
                }
            });
        }
        paperList.appendChild(div);
    });
    if (!list.length) {
        if (!append) paperList.innerHTML = '<div class="text-secondary small">暂无试卷</div>';
    }
}

function renderExamQuestions(questions) {
    examQuestions.innerHTML = "";
    const TYPE_ORDER = { SINGLE_CHOICE: 1, MULTIPLE_CHOICE: 2, TRUE_FALSE: 3, SHORT_ANSWER: 4 };
    const list = (questions || []).map((q, idx) => ({ q, idx })).sort((a, b) => {
        const oa = TYPE_ORDER[a.q.type] ?? 99;
        const ob = TYPE_ORDER[b.q.type] ?? 99;
        if (oa !== ob) return oa - ob;
        return a.idx - b.idx; // 组内保持原顺序
    });
    let lastType = "";
    let seq = 0;
    list.forEach(({ q }) => {
        seq += 1;
        const options = parseOptions(q.optionsJson);
        if (q.type && q.type !== lastType) {
            lastType = q.type;
            const header = document.createElement("div");
            header.className = "mt-3 mb-2 fw-semibold text-secondary";
            header.textContent = typeLabel(q.type);
            examQuestions.appendChild(header);
        }
        const block = document.createElement("div");
        block.className = "question-row exam-question-answer p-3";
        if (q.type === "SHORT_ANSWER") {
            block.innerHTML = `<div class="mb-2 fw-medium">${seq}. ${q.stem}</div><textarea class="form-control" data-aid="${q.id}" placeholder="请输入答案"></textarea>`;
        } else if (q.type === "TRUE_FALSE") {
            block.innerHTML = `
                <div class="mb-2 fw-medium">${seq}. ${q.stem}</div>
                <div class="exam-options-list">
                    <label class="exam-option-item"><input class="form-check-input" type="radio" name="q_${q.id}" value="正确"><span class="exam-option-text">正确</span></label>
                    <label class="exam-option-item"><input class="form-check-input" type="radio" name="q_${q.id}" value="错误"><span class="exam-option-text">错误</span></label>
                </div>
            `;
        } else if (q.type === "MULTIPLE_CHOICE") {
            block.innerHTML = `
                <div class="mb-2 fw-medium">${seq}. ${q.stem}</div>
                <div class="exam-options-list">${options.map((o, idx) => `<label class="exam-option-item"><input class="form-check-input" type="checkbox" name="qm_${q.id}" value="${getChoiceValue(o, idx)}"><span class="exam-option-text">${escapeHtml(formatOptionDisplay(o, idx))}</span></label>`).join("")}</div>
            `;
        } else {
            block.innerHTML = `
                <div class="mb-2 fw-medium">${seq}. ${q.stem}</div>
                <div class="exam-options-list">${options.map((o, idx) => `<label class="exam-option-item"><input class="form-check-input" type="radio" name="q_${q.id}" value="${getChoiceValue(o, idx)}"><span class="exam-option-text">${escapeHtml(formatOptionDisplay(o, idx))}</span></label>`).join("")}</div>
            `;
        }
        examQuestions.appendChild(block);
    });
}

function showExamSession(metaText) {
    // 兼容旧调用：传 string
    if (typeof metaText === "string") {
        examSessionMeta.textContent = metaText || "";
        openModule("examSession");
        return;
    }
    examSessionMeta.textContent = "";
    openModule("examSession");
}

let examDraftTimer = 0;
let savingDraft = false;
function clearExamDraftTimer() {
    if (examDraftTimer) {
        clearInterval(examDraftTimer);
        examDraftTimer = 0;
    }
    savingDraft = false;
}

let examSessionTimer = 0;
function clearExamSessionTimer() {
    if (examSessionTimer) {
        clearInterval(examSessionTimer);
        examSessionTimer = 0;
    }
}

function renderExamSessionHeader({ title, status, startedAt, endedAt }) {
    const st = statusLabel(status);
    examSessionMeta.innerHTML = `
        <div class="fw-semibold">${escapeHtml(title || "未命名试卷")}</div>
        <div class="text-secondary mt-1">状态：<strong>${escapeHtml(st)}</strong> · 耗时：<strong id="examSessionElapsed">00:00:00</strong></div>
    `;
    const el = document.getElementById("examSessionElapsed");
    const sMs = startedAt ? new Date(startedAt).getTime() : NaN;
    const eMs = endedAt ? new Date(endedAt).getTime() : NaN;
    if (!el || Number.isNaN(sMs)) return;
    const tick = () => {
        const end = !Number.isNaN(eMs) ? eMs : Date.now();
        el.textContent = formatDurationHms(end - sMs);
    };
    tick();
    clearExamSessionTimer();
    if (String(status || "").toUpperCase() === "STARTED" && !endedAt) {
        examSessionTimer = setInterval(tick, 1000);
    }
}

async function loadExamSessionMeta(examRecordId, fallbackTitle = "") {
    // 读取后端考试记录，确保状态/开始时间准确
    const record = await ApiClient.requestJson(`/exams/${examRecordId}`);
    const title = record?.paper?.title || fallbackTitle || "";
    const status = record?.status || "";
    const startedAt = record?.createdAt || record?.startedAt || "";
    const endedAt = record?.submittedAt || record?.endedAt || "";
    renderExamSessionHeader({ title, status, startedAt, endedAt });
}

async function saveExamDraftNow() {
    if (!currentExamId) return;
    if (savingDraft) return;
    savingDraft = true;
    try {
        // 每 5s 保存一次草稿（后端会过滤非本次考试的题目）
        await ApiClient.requestJson(`/exams/${currentExamId}/draft`, {
            method: "POST",
            body: JSON.stringify({ answers: collectExamAnswers() }),
        });
    } catch (e) {
        console.warn("[draft] save failed", e?.message || e);
    } finally {
        savingDraft = false;
    }
}

async function loadExamDraft(examRecordId) {
    const data = await ApiClient.requestJson(`/exams/${examRecordId}/draft`);
    const answers = Array.isArray(data?.answers) ? data.answers : [];
    const map = new Map();
    answers.forEach((a) => {
        if (a && a.questionId != null) {
            map.set(Number(a.questionId), String(a.userAnswer ?? ""));
        }
    });
    return map;
}

function applyDraftToUI(answerMap) {
    if (!answerMap || !(answerMap instanceof Map)) return;
    // 简答题 textarea
    examQuestions.querySelectorAll("[data-aid]").forEach((el) => {
        const qid = Number(el.getAttribute("data-aid"));
        if (!answerMap.has(qid)) return;
        el.value = answerMap.get(qid) || "";
    });
    // 单选/判断
    const radioNames = new Set(Array.from(examQuestions.querySelectorAll("input[type=radio]")).map((x) => x.name));
    radioNames.forEach((name) => {
        const qid = Number(name.replace("q_", ""));
        const val = answerMap.get(qid);
        if (val == null) return;
        const inp = examQuestions.querySelector(`input[name='${name}'][value='${CSS.escape(String(val))}']`);
        if (inp) inp.checked = true;
    });
    // 多选
    const multiNames = new Set(Array.from(examQuestions.querySelectorAll("input[type=checkbox]"))
        .map((x) => x.name)
        .filter((n) => n && n.startsWith("qm_")));
    multiNames.forEach((name) => {
        const qid = Number(name.replace("qm_", ""));
        const raw = answerMap.get(qid);
        if (raw == null) return;
        const selected = String(raw).split(",").map((x) => x.trim()).filter(Boolean);
        const set = new Set(selected);
        examQuestions.querySelectorAll(`input[name='${name}']`).forEach((cb) => {
            cb.checked = set.has(String(cb.value));
        });
    });
}

function startAutoSaveDraft() {
    clearExamDraftTimer();
    if (!currentExamId) return;
    // 立刻保存一次，避免用户刚进入就关闭导致丢失
    void saveExamDraftNow();
    examDraftTimer = setInterval(() => void saveExamDraftNow(), 5000);
}

function collectExamAnswers() {
    const answers = [];
    examQuestions.querySelectorAll("[data-aid]").forEach((el) => {
        answers.push({ questionId: Number(el.getAttribute("data-aid")), userAnswer: el.value || "" });
    });
    const radioNames = new Set(Array.from(examQuestions.querySelectorAll("input[type=radio]")).map((x) => x.name));
    radioNames.forEach((name) => {
        const checked = examQuestions.querySelector(`input[name='${name}']:checked`);
        const qid = Number(name.replace("q_", ""));
        answers.push({ questionId: qid, userAnswer: checked ? checked.value : "" });
    });
    const multiNames = new Set(Array.from(examQuestions.querySelectorAll("input[type=checkbox]"))
        .map((x) => x.name)
        .filter((n) => n && n.startsWith("qm_")));
    multiNames.forEach((name) => {
        const qid = Number(name.replace("qm_", ""));
        const checkedValues = Array.from(examQuestions.querySelectorAll(`input[name='${name}']:checked`))
            .map((x) => x.value)
            .sort();
        answers.push({ questionId: qid, userAnswer: checkedValues.join(",") });
    });
    return answers;
}

function resultClassByQuestion(q) {
    if (q.type === "SHORT_ANSWER") return "result-neutral";
    return q.correct ? "result-correct" : "result-wrong";
}

function fullScoreByType(type) {
    return type === "SHORT_ANSWER" ? 10 : 5;
}

function renderOptionsInResult(optionsJson, type) {
    const options = parseOptions(optionsJson);
    if (!options.length) return "";
    if (type !== "SINGLE_CHOICE" && type !== "MULTIPLE_CHOICE") return "";
    return `
        <div class="small mb-1 text-secondary">
            选项：
            <ul class="mb-0 mt-1 list-unstyled">
                ${options.map((opt, idx) => `<li>${escapeHtml(formatOptionDisplay(opt, idx))}</li>`).join("")}
            </ul>
        </div>
    `;
}

let examDetailTimer = 0;
function clearExamDetailTimer() {
    if (examDetailTimer) {
        clearInterval(examDetailTimer);
        examDetailTimer = 0;
    }
}

function statusLabel(status) {
    const s = String(status || "").toUpperCase();
    if (s === "SUBMITTED" || s === "COMPLETED" || s === "FINISHED") return "已结束";
    if (s === "STARTED" || s === "RUNNING" || s === "IN_PROGRESS") return "进行中";
    if (!s) return "-";
    return s;
}

function formatDurationHms(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderExamRecordDetail(detail) {
    clearExamDetailTimer();
    const paperTotal = Number(detail.paperTotalScore ?? 0);
    const userScore = Number(detail.userScore ?? detail.totalScore ?? 0);
    const statusText = statusLabel(detail.status);
    const isRunning = String(detail.status || "").toUpperCase() === "STARTED" && !detail.endedAt;
    const TYPE_ORDER = { SINGLE_CHOICE: 1, MULTIPLE_CHOICE: 2, TRUE_FALSE: 3, SHORT_ANSWER: 4 };
    const grouped = (detail.questions || []).slice().sort((a, b) => {
        const oa = TYPE_ORDER[a.type] ?? 99;
        const ob = TYPE_ORDER[b.type] ?? 99;
        if (oa !== ob) return oa - ob;
        return 0; // 组内保持原顺序（稳定排序依赖 JS 引擎；此处不强行二次排序）
    });
    examRecordDetailView.innerHTML = `
        <div class="question-row p-3 result-summary">
            <div class="fw-semibold fs-5">${escapeHtml(detail.paperTitle || "未命名试卷")}</div>
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 text-secondary mt-1">
                <div>状态：<strong>${escapeHtml(statusText)}</strong> · 耗时：<strong id="examElapsed">00:00:00</strong></div>
                ${isRunning ? `<button class="btn btn-sm btn-outline-success" type="button" id="resumeExamBtn"><i class="bi bi-play-circle me-1"></i>继续考试</button>` : ""}
            </div>
            <div class="result-total-score mt-2">${userScore} / ${paperTotal} 分</div>
            <div class="text-secondary mt-1">开始：${formatDateTime(detail.startedAt)}，结束：${formatDateTime(detail.endedAt)}</div>
            <div class="text-secondary mt-1">客观题：${detail.objectiveScore ?? 0} 分，主观题：${detail.subjectiveScore ?? 0} 分</div>
        </div>
        ${(() => {
            let html = "";
            let lastType = "";
            grouped.forEach((x, idx) => {
                if (x.type !== lastType) {
                    lastType = x.type;
                    html += `<div class="mt-3 mb-2 fw-semibold text-secondary">${escapeHtml(typeLabel(x.type))}</div>`;
                }
                html += `
                    <div class="question-row p-3 ${resultClassByQuestion(x)}">
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div class="question-row-content fw-medium">${idx + 1}. ${escapeHtml(x.stem || "")}</div>
                            <span class="question-badge ${x.type === "SINGLE_CHOICE" || x.type === "MULTIPLE_CHOICE" ? "choice" : x.type === "TRUE_FALSE" ? "tf" : "short"}">${typeLabel(x.type)}</span>
                        </div>
                        <div class="d-flex justify-content-end mb-2"><span class="score-pill">${x.score ?? 0} / ${fullScoreByType(x.type)} 分</span></div>
                        ${renderOptionsInResult(x.optionsJson, x.type)}
                        <div class="small mb-1">你的答案：${escapeHtml(x.userAnswer || "-")}</div>
                        <div class="small mb-1">标准答案：${escapeHtml(x.answer || "-")}</div>
                        <div class="small">${escapeHtml(x.analysis || "")}</div>
                    </div>
                `;
            });
            return html;
        })()}
    `;

    // 耗时展示：进行中=当前-开始；已结束=结束-开始
    const startedAtMs = detail.startedAt ? new Date(detail.startedAt).getTime() : NaN;
    const endedAtMs = detail.endedAt ? new Date(detail.endedAt).getTime() : NaN;
    const el = document.getElementById("examElapsed");
    if (el && !Number.isNaN(startedAtMs)) {
        const tick = () => {
            const end = !Number.isNaN(endedAtMs) ? endedAtMs : Date.now();
            el.textContent = formatDurationHms(end - startedAtMs);
        };
        tick();
        if (isRunning) {
            examDetailTimer = setInterval(tick, 1000);
        }
    }

    if (isRunning) {
        const resumeBtn = document.getElementById("resumeExamBtn");
        if (resumeBtn) {
            resumeBtn.addEventListener("click", async () => {
                try {
                    const started = await resumeExam(detail.examRecordId);
                    currentExamId = started.examRecordId;
                    renderExamQuestions(started.paper.questions);
                    try {
                        const draftMap = await loadExamDraft(currentExamId);
                        applyDraftToUI(draftMap);
                    } catch (e2) {
                        console.warn("[draft] load failed", e2?.message || e2);
                    }
                    startAutoSaveDraft();
                    examResult.innerHTML = "";
                    void loadExamSessionMeta(currentExamId, detail.paperTitle || "").catch(() => {});
                    showExamSession(`继续考试：${detail.paperTitle || ""}，记录ID：${currentExamId}`);
                    show("已进入继续考试", "info");
                } catch (e) {
                    show(e.message || "继续考试失败", "danger");
                }
            });
        }
    }
}

function formatDateTime(text) {
    if (!text) return "-";
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function firstFiniteNumber(...vals) {
    for (const v of vals) {
        if (v == null || v === "") continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

function parseRecordScoreSlash(item) {
    if (!item) return null;
    const candidates = [item.scoreText, item.scoreDisplay, item.scoreLabel, item.scoreStr];
    for (const c of candidates) {
        if (typeof c !== "string") continue;
        const m = String(c).trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
        if (!m) continue;
        const u = Number(m[1]);
        const t = Number(m[2]);
        if (Number.isFinite(u) && Number.isFinite(t)) return { userScore: u, totalScore: t };
    }
    return null;
}

function getRecordTotalScore(item) {
    if (!item) return null;
    const paper = item.paper || item.paperInfo || item.paperVo || {};
    return firstFiniteNumber(
        item.paperTotalScore,
        item.totalMaxScore,
        item.fullScore,
        item.maxScore,
        item.paperTotal,
        item.paperScore,
        item.paper_total_score,
        item.total_max_score,
        paper.paperTotalScore,
        paper.totalMaxScore,
        paper.totalScore,
        paper.fullScore,
        paper.maxScore,
    );
}

function getRecordUserScore(item) {
    if (!item) return null;
    const paper = item.paper || item.paperInfo || item.paperVo || {};
    return firstFiniteNumber(
        item.userScore,
        item.user_score,
        item.obtainedScore,
        item.finalScore,
        item.totalScore,
        item.score,
        item.user_total_score,
        paper.userScore,
        paper.obtainedScore,
        paper.totalScore,
    );
}

async function refreshExamHistory() {
    return refreshExamHistoryPaged({ page: currentRecordPage, append: false });
}

async function refreshExamHistoryPaged({ page = currentRecordPage, append = false } = {}) {
    const data = await listExamRecordsPaged(bankSelect.value, page, recordPageSize);
    const list = Array.isArray(data.items) ? data.items : [];
    currentRecordPage = data.page || page;
    currentRecordTotalPages = data.totalPages || 1;
    const mobile = isMobileLike();
    if (mobile) {
        if (!append) mobileRecordItems = [];
        mobileRecordItems = mobileRecordItems.concat(list);
    }
    if (recordPageInfo) {
        recordPageInfo.textContent = mobile ? "" : `第 ${currentRecordPage} / ${currentRecordTotalPages} 页`;
    }
    if (recordPrevBtn) {
        recordPrevBtn.disabled = mobile ? true : (currentRecordPage <= 1);
        recordPrevBtn.classList.toggle("d-none", mobile);
    }
    if (recordNextBtn) {
        recordNextBtn.disabled = mobile ? true : (currentRecordPage >= currentRecordTotalPages);
        recordNextBtn.classList.toggle("d-none", mobile);
    }
    if (!append) examHistoryList.innerHTML = "";
    if (!list.length) {
        if (!append) examHistoryList.innerHTML = '<div class="text-secondary small">暂无考试记录</div>';
        return;
    }
    list.forEach((item) => {
        const row = document.createElement("div");
        row.className = "question-row p-3 exam-record-row-clickable exam-record-row";
        const st = statusLabel(item.status);
        const stClass = st === "进行中" ? "text-warning" : "text-success";
        const slash = parseRecordScoreSlash(item);
        const userScore = slash?.userScore ?? getRecordUserScore(item);
        const totalScore = slash?.totalScore ?? getRecordTotalScore(item);
        const scoreText = totalScore != null && userScore != null ? `${userScore}/${totalScore}` : (userScore != null ? `${userScore}/-` : "-/-");
        const ratio = totalScore != null && totalScore > 0 && userScore != null ? userScore / totalScore : null;
        let scoreClass = "exam-record-score";
        if (ratio != null) {
            if (ratio < 0.6) scoreClass += " exam-record-score--low";
            else if (ratio < 0.8) scoreClass += " exam-record-score--mid";
            else scoreClass += " exam-record-score--high";
        }
        row.innerHTML = `
            <div class="d-flex justify-content-between align-items-center gap-3 mb-1 exam-record-row-head">
                <div class="fw-semibold flex-grow-1">${item.paperTitle || "未命名试卷"}</div>
                <span class="${scoreClass}">${scoreText}</span>
            </div>
            <div class="small text-secondary">状态：<span class="${stClass} fw-semibold">${escapeHtml(st)}</span></div>
            <div class="small text-secondary">开始：${formatDateTime(item.startedAt)}</div>
            <div class="small text-secondary">结束：${formatDateTime(item.endedAt)}</div>
        `;
        row.addEventListener("click", async () => {
            const detail = await examRecordDetail(item.examRecordId);
            renderExamRecordDetail(detail);
            recordListSection.classList.add("d-none");
            recordDetailSection.classList.remove("d-none");
            openModule("records");
        });
        examHistoryList.appendChild(row);
    });
}

function bindMobileInfiniteScroll() {
    if (mobileInfiniteBound) return;
    mobileInfiniteBound = true;

    function ensureSentinel(id, afterEl) {
        let el = document.getElementById(id);
        if (el) return el;
        el = document.createElement("div");
        el.id = id;
        el.style.height = "1px";
        el.style.width = "100%";
        afterEl.insertAdjacentElement("afterend", el);
        return el;
    }

    async function loadNextQuestionsIfNeeded() {
        if (!isMobileLike()) return;
        if (pagingLoading.questions) return;
        if (activeModule !== "operation") return;
        if (currentQuestionPage >= currentQuestionTotalPages) return;
        pagingLoading.questions = true;
        setMobileInfiniteLoadingVisible("questions", true);
        try {
            await refreshQuestions(currentQuestionPage + 1);
        } finally {
            pagingLoading.questions = false;
            setMobileInfiniteLoadingVisible("questions", false);
        }
    }

    async function loadNextPapersIfNeeded() {
        if (!isMobileLike()) return;
        if (pagingLoading.papers) return;
        if (activeModule !== "papers") return;
        if (paperDetailSection && !paperDetailSection.classList.contains("d-none")) return;
        if (currentPaperPage >= currentPaperTotalPages) return;
        pagingLoading.papers = true;
        setMobileInfiniteLoadingVisible("papers", true);
        try {
            await refreshPapers({ page: currentPaperPage + 1, append: true });
        } finally {
            pagingLoading.papers = false;
            setMobileInfiniteLoadingVisible("papers", false);
        }
    }

    async function loadNextRecordsIfNeeded() {
        if (!isMobileLike()) return;
        if (pagingLoading.records) return;
        if (activeModule !== "records") return;
        if (recordDetailSection && !recordDetailSection.classList.contains("d-none")) return;
        if (currentRecordPage >= currentRecordTotalPages) return;
        pagingLoading.records = true;
        setMobileInfiniteLoadingVisible("records", true);
        try {
            await refreshExamHistoryPaged({ page: currentRecordPage + 1, append: true });
        } finally {
            pagingLoading.records = false;
            setMobileInfiniteLoadingVisible("records", false);
        }
    }

    const qSentinel = questionPool ? ensureSentinel("questionPoolInfiniteSentinel", questionPool) : null;
    const pSentinel = paperList ? ensureSentinel("paperListInfiniteSentinel", paperList) : null;
    const rSentinel = examHistoryList ? ensureSentinel("recordListInfiniteSentinel", examHistoryList) : null;
    ensureMobileLoadingEl("questions", questionPool);
    ensureMobileLoadingEl("papers", paperList);
    ensureMobileLoadingEl("records", examHistoryList);

    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                if (e.target === qSentinel) void loadNextQuestionsIfNeeded();
                if (e.target === pSentinel) void loadNextPapersIfNeeded();
                if (e.target === rSentinel) void loadNextRecordsIfNeeded();
            });
        }, { root: null, rootMargin: "120px 0px 240px 0px", threshold: 0 });
        if (qSentinel) io.observe(qSentinel);
        if (pSentinel) io.observe(pSentinel);
        if (rSentinel) io.observe(rSentinel);
        return;
    }

    window.addEventListener("scroll", () => {
        const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 300);
        if (!nearBottom) return;
        void loadNextQuestionsIfNeeded();
        void loadNextPapersIfNeeded();
        void loadNextRecordsIfNeeded();
    }, { passive: true });
}

async function initBanks() {
    const banks = await fetchBanks();
    bankSelect.innerHTML = "";
    if (bankSelectMobile) bankSelectMobile.innerHTML = "";
    banks.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = b.name;
        bankSelect.appendChild(opt);
        if (bankSelectMobile) {
            const optMobile = document.createElement("option");
            optMobile.value = b.id;
            optMobile.textContent = b.name;
            bankSelectMobile.appendChild(optMobile);
        }
    });
    if (bankSelectMobile && bankSelect.value) {
        bankSelectMobile.value = bankSelect.value;
    }
}

const generateQuestionModalEl = document.getElementById("generateQuestionModal");
const dialogGenCountEl = document.getElementById("dialogGenCount");
const dialogGenOutlineWrap = document.getElementById("dialogGenOutlineWrap");
const dialogGenOutlineHint = document.getElementById("dialogGenOutlineHint");
let dialogGenOutlineGuideMap = new Map(); // guideKey -> { title, content }
let dialogGenOutlineInitPromise = null;
if (generateQuestionModalEl && window.bootstrap) {
    generateQuestionModalEl.addEventListener("shown.bs.modal", () => {
        if (dialogGenCountEl) dialogGenCountEl.value = "8";
        initDialogGenTypes();
        dialogGenOutlineInitPromise = initDialogGenOutlines(bankSelect?.value);
    });
}

function isImageFileName(name = "") {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(name || ""));
}

async function fetchDocumentOutline(bankId, documentId) {
    const res = await ApiClient.request(`/banks/${bankId}/documents/${documentId}/outline?page=1&size=200`);
    if (!res.ok) {
        const msg = await readErrorMessage(res, "获取大纲失败");
        throw new Error(msg);
    }
    return res.json();
}

function getSelectedDialogGenOutlineGuides() {
    if (!dialogGenOutlineWrap) return [];
    const checked = Array.from(dialogGenOutlineWrap.querySelectorAll("input[data-outline-block-cb]:checked"));
    const out = [];
    checked.forEach((cb) => {
        const key = cb.getAttribute("data-guide-key");
        const guide = dialogGenOutlineGuideMap.get(key);
        if (!guide) return;
        const t = String(guide.title || "").trim();
        const c = String(guide.content || "").trim();
        const sourceLabel = sanitizeGuideLabel(String(guide.sourceLabel || ""));
        if (!t && !c && !sourceLabel) return;
        const titleLine = sourceLabel || t;
        out.push(c ? (titleLine ? `${titleLine}\n${c}` : c) : titleLine);
    });
    return out;
}

let dialogGenOutlineChangeBound = false;
function bindDialogGenOutlineSelectionEvents() {
    if (!dialogGenOutlineWrap || dialogGenOutlineChangeBound) return;
    dialogGenOutlineChangeBound = true;
    dialogGenOutlineWrap.addEventListener("change", (ev) => {
        const target = ev.target;
        if (!target || !target.matches) return;
        if (target.matches('input[data-outline-doc-cb]')) {
            const docId = target.getAttribute("data-outline-doc-id");
            const checked = !!target.checked;
            dialogGenOutlineWrap
                .querySelectorAll(`input[data-outline-doc-id="${docId}"][data-outline-block-cb]`)
                .forEach((cb) => {
                    cb.checked = checked;
                });
            return;
        }
        if (target.matches('input[data-outline-block-cb]')) {
            const docId = target.getAttribute("data-outline-doc-id");
            const docCb = dialogGenOutlineWrap.querySelector(`input[data-outline-doc-id="${docId}"][data-outline-doc-cb]`);
            const blocks = Array.from(
                dialogGenOutlineWrap.querySelectorAll(`input[data-outline-doc-id="${docId}"][data-outline-block-cb]`)
            );
            if (docCb) docCb.checked = blocks.some((b) => b.checked);
        }
    });
}

async function initDialogGenOutlines(bankId) {
    if (!dialogGenOutlineWrap || !dialogGenOutlineHint) return;
    dialogGenOutlineGuideMap = new Map();
    bindDialogGenOutlineSelectionEvents();

    dialogGenOutlineWrap.innerHTML = "";
    dialogGenOutlineHint.textContent = "加载知识文件与大纲中…";

    if (!bankId) {
        dialogGenOutlineHint.textContent = "未选择题库";
        return;
    }

    let docs = [];
    try {
        docs = await listDocuments(bankId);
    } catch (e) {
        dialogGenOutlineHint.textContent = e?.message || "加载知识文件失败";
        dialogGenOutlineWrap.innerHTML = "";
        return;
    }

    const candidateDocs = (docs || [])
        .filter((d) => !isImageFileName(d?.fileName));

    if (!candidateDocs.length) {
        dialogGenOutlineHint.textContent = "当前题库暂无可用的非图片知识文件";
        dialogGenOutlineWrap.innerHTML = "";
        return;
    }

    const docCards = [];
    for (const doc of candidateDocs) {
        const docId = Number(doc.id);
        if (!docId) continue;

        const fileName = doc.fileName || `文档 ${docId}`;
        const fileBaseName = stripFileExtension(fileName);
        let outline;
        try {
            outline = await fetchDocumentOutline(bankId, docId);
        } catch (_) {
            outline = { blocks: [] };
        }
        const blocks = Array.isArray(outline?.blocks) ? outline.blocks : [];
        const blocksHtml = blocks.length
            ? blocks
                .map((b) => {
                    const idx = b.index ?? 0;
                    const key = `${docId}:${idx}`;
                    dialogGenOutlineGuideMap.set(key, {
                        title: b.title || "",
                        content: b.content || "",
                        sourceLabel: `${fileBaseName}-${(b.title ? String(b.title) : `块 ${idx}`)}`,
                    });
                    const label = b.title ? String(b.title) : `块 ${idx}`;
                    const tooltip = b.content ? String(b.content) : "";
                    return `
                        <label class="form-check form-check-inline me-0 mb-1" style="min-width: 180px;">
                            <input
                                class="form-check-input me-1"
                                type="checkbox"
                                data-outline-doc-id="${docId}"
                                data-outline-block-cb
                                data-guide-key="${key}"
                                value="${key}"
                            />
                            <span class="small text-truncate" title="${escapeHtml(tooltip)}">${escapeHtml(label)}</span>
                        </label>
                    `;
                })
                .join("")
            : (() => {
                const key = `${docId}:__full__`;
                dialogGenOutlineGuideMap.set(key, {
                    title: fileBaseName,
                    content: "",
                    sourceLabel: fileBaseName,
                });
                return `
                    <label class="form-check form-check-inline me-0 mb-1">
                        <input
                            class="form-check-input me-1"
                            type="checkbox"
                            data-outline-doc-id="${docId}"
                            data-outline-block-cb
                            data-guide-key="${key}"
                            value="${key}"
                        />
                        <span class="small">整份知识文件</span>
                    </label>
                `;
            })();

        docCards.push(`
            <div class="border rounded-3 p-3 bg-light">
                <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <label class="form-check mb-0">
                        <input
                            class="form-check-input"
                            type="checkbox"
                            data-outline-doc-id="${docId}"
                            data-outline-doc-cb
                        />
                        <span class="small fw-semibold">${escapeHtml(fileName)}</span>
                    </label>
                    <span class="small text-secondary">${blocks.length ? `${blocks.length} 个大纲块` : "无大纲（可按整份文件生成）"}</span>
                </div>
                <div class="d-flex flex-wrap gap-2">${blocksHtml}</div>
            </div>
        `);
    }

    if (!docCards.length) {
        dialogGenOutlineHint.textContent = "当前题库暂无可用的知识文件或大纲";
        dialogGenOutlineWrap.innerHTML = "";
        return;
    }

    dialogGenOutlineHint.textContent = "已加载，可按需勾选知识文件或大纲块";
    dialogGenOutlineWrap.innerHTML = docCards.join("");
}

function stripFileExtension(fileName) {
    const raw = String(fileName || "").trim();
    if (!raw) return "未命名知识文件";
    const idx = raw.lastIndexOf(".");
    if (idx <= 0) return raw;
    return raw.slice(0, idx).trim() || raw;
}

function sanitizeGuideLabel(label) {
    const raw = String(label || "").trim();
    if (!raw) return "";
    return raw
        .replace(/[\r\n\t]+/g, " ")
        .replace(/["'`]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function runGenerateQuestionTask(bankId, count, types, outlineGuides) {
    const localId = `gen-${Date.now()}-${genTaskSeed++}`;
    const task = {
        localId,
        taskId: "",
        bankId,
        count,
        status: "PENDING",
        statusText: "已提交，等待生成...",
        questionsGenerated: null,
        message: null,
        createdAt: Date.now(),
    };
    genTaskMap.set(localId, task);
    renderGenTasksUI();
    saveGenTasksToStorage();
    startGenerateTaskAsync(bankId, count, types, outlineGuides)
        .then((taskId) => {
            const t = genTaskMap.get(localId);
            if (t) {
                t.taskId = taskId;
                t.status = "RUNNING";
                t.statusText = "正在生成...";
                renderGenTasksUI();
                saveGenTasksToStorage();
            }
            show("已提交生成任务，可点击右下角查看进度");
            void monitorGenTask(localId);
        })
        .catch((e) => {
            const t = genTaskMap.get(localId);
            if (t) {
                t.status = "FAILED";
                t.message = e.message || "提交生成任务失败";
                t.statusText = t.message;
            }
            saveGenTasksToStorage();
            renderGenTasksUI();
            show(e.message || "提交生成任务失败", "danger");
        });
}

genBtn.addEventListener("click", async () => {
    const bankId = bankSelect.value;
    if (!bankId) {
        show("请先选择题库", "danger");
        return;
    }
    if (hasActiveGenerateTaskForBank(bankId)) {
        show("该题库已有进行中的题目生成任务，请等待完成后再试", "danger");
        return;
    }
    try {
        const docs = await listDocuments(bankId);
        if (isAnyDocumentParsing(docs)) {
            bootstrap.Modal.getOrCreateInstance(document.getElementById("parsingBlockModal")).show();
            return;
        }
    } catch (e) {
        show(e.message, "danger");
        return;
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("generateQuestionModal")).show();
});

document.getElementById("generateQuestionModalConfirm")?.addEventListener("click", async () => {
    const bankId = bankSelect.value;
    const count = Number(dialogGenCountEl?.value || 8);
    const types = getDialogGenTypes();
    if (dialogGenOutlineInitPromise) {
        try {
            await dialogGenOutlineInitPromise;
        } catch (_) {
            // outline loading fails shouldn't block question generation
        }
    }
    const outlineGuides = getSelectedDialogGenOutlineGuides();
    if (!types.length) {
        show("请至少选择一种题型", "danger");
        return;
    }
    if (count < 1 || count > 50) {
        show("生成数量须在 1～50 之间", "danger");
        return;
    }
    bootstrap.Modal.getInstance(document.getElementById("generateQuestionModal"))?.hide();
    await runWithButtonLoading(genBtn, async () => {
        runGenerateQuestionTask(bankId, count, types, outlineGuides);
    }, "提交中...");
});

if (genTaskFab) {
    let genTaskFabDragMoved = false;
    let genTaskFabStartX = 0;
    let genTaskFabStartY = 0;
    let genTaskFabStartLeft = 0;
    let genTaskFabStartTop = 0;
    const genTaskFabTouchMoveOptions = { passive: false };
    const onGenTaskFabPointerMove = (e) => {
        if (e.touches && e.cancelable) {
            e.preventDefault();
        }
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        genTaskFabDragMoved = true;
        genTaskFab.style.right = "auto";
        genTaskFab.style.bottom = "auto";
        genTaskFab.style.left = `${genTaskFabStartLeft + (x - genTaskFabStartX)}px`;
        genTaskFab.style.top = `${genTaskFabStartTop + (y - genTaskFabStartY)}px`;
    };
    const onGenTaskFabPointerUp = () => {
        document.removeEventListener("mousemove", onGenTaskFabPointerMove);
        document.removeEventListener("mouseup", onGenTaskFabPointerUp);
        document.removeEventListener("touchmove", onGenTaskFabPointerMove, genTaskFabTouchMoveOptions);
        document.removeEventListener("touchend", onGenTaskFabPointerUp);
    };
    genTaskFab.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const rect = genTaskFab.getBoundingClientRect();
        genTaskFabDragMoved = false;
        genTaskFabStartX = e.clientX;
        genTaskFabStartY = e.clientY;
        genTaskFabStartLeft = rect.left;
        genTaskFabStartTop = rect.top;
        document.addEventListener("mousemove", onGenTaskFabPointerMove);
        document.addEventListener("mouseup", onGenTaskFabPointerUp);
    });
    genTaskFab.addEventListener("touchstart", (e) => {
        if (!e.touches.length) return;
        const rect = genTaskFab.getBoundingClientRect();
        genTaskFabDragMoved = false;
        genTaskFabStartX = e.touches[0].clientX;
        genTaskFabStartY = e.touches[0].clientY;
        genTaskFabStartLeft = rect.left;
        genTaskFabStartTop = rect.top;
        document.addEventListener("touchmove", onGenTaskFabPointerMove, genTaskFabTouchMoveOptions);
        document.addEventListener("touchend", onGenTaskFabPointerUp);
    });
    genTaskFab.addEventListener("click", () => {
        if (genTaskFabDragMoved) {
            genTaskFabDragMoved = false;
            return;
        }
        openGenTaskModal();
    });
}
if (closeGenTaskModalBtn) closeGenTaskModalBtn.addEventListener("click", closeGenTaskModal);
if (genTaskModalBackdrop) {
    genTaskModalBackdrop.addEventListener("click", (ev) => {
        if (ev.target === genTaskModalBackdrop) closeGenTaskModal();
    });
}
if (genTaskList) {
    genTaskList.addEventListener("click", async (ev) => {
        const cancelBtn = ev.target && ev.target.closest ? ev.target.closest(".gen-task-cancel-btn") : null;
        const delBtn = ev.target && ev.target.closest ? ev.target.closest(".gen-task-delete-btn") : null;
        const actionBtn = cancelBtn || delBtn;
        if (!actionBtn) return;
        const localId = actionBtn.getAttribute("data-local-id");
        if (!localId) return;
        const task = genTaskMap.get(localId);
        if (!task) return;
        if (delBtn) {
            if (task.taskId) {
                try {
                    await deleteGenerateTask(task.bankId, task.taskId);
                } catch (e) {
                    show(e?.message || "删除任务失败", "danger");
                    return;
                }
            }
            genTaskMap.delete(localId);
            saveGenTasksToStorage();
            renderGenTasksUI();
            return;
        }
        if (!task.taskId) return;
        try {
            task.cancelling = true;
            renderGenTasksUI();
            const data = await cancelGenerateTask(task.bankId, task.taskId);
            task.status = data?.status || "CANCELLED";
            task.message = data?.message || "任务已中止";
            task.statusText = task.message;
            task.cancelling = false;
            saveGenTasksToStorage();
            renderGenTasksUI();
        } catch (e) {
            task.cancelling = false;
            renderGenTasksUI();
            show(e?.message || "中止任务失败", "danger");
        }
    });
}

deleteSelectedBtn.addEventListener("click", async () => {
    const ids = Array.from(selectedQuestionIds);
    if (!ids.length) return show("请先勾选要删除的题目", "danger");
    if (!window.confirm(`确认多选删除已勾选的 ${ids.length} 道题目吗？`)) return;
    await runWithButtonLoading(deleteSelectedBtn, async () => {
        try {
            await deleteQuestions(bankSelect.value, ids);
            ids.forEach((id) => selectedQuestionIds.delete(id));
            await refreshQuestions(1);
            await refreshPapers();
            show(`已删除 ${ids.length} 道题目`);
        } catch (e) {
            show(e.message, "danger");
        }
    }, "删除中...");
});

selectAllQuestions.addEventListener("change", () => {
    const checked = selectAllQuestions.checked;
    questionPool.querySelectorAll("input[data-qid]").forEach((checkbox) => {
        checkbox.checked = checked;
        const id = Number(checkbox.getAttribute("data-qid"));
        if (checked) {
            selectedQuestionIds.add(id);
        } else {
            selectedQuestionIds.delete(id);
        }
    });
});

prevPageBtn.addEventListener("click", async () => {
    if (currentQuestionPage <= 1) return;
    try {
        await refreshQuestions(currentQuestionPage - 1);
    } catch (e) {
        show(e.message, "danger");
    }
});

nextPageBtn.addEventListener("click", async () => {
    if (currentQuestionPage >= currentQuestionTotalPages) return;
    try {
        await refreshQuestions(currentQuestionPage + 1);
    } catch (e) {
        show(e.message, "danger");
    }
});

paperPrevBtn.addEventListener("click", async () => {
    if (currentPaperPage <= 1) return;
    try {
        currentPaperPage -= 1;
        await refreshPapers();
    } catch (e) {
        show(e.message, "danger");
    }
});

paperNextBtn.addEventListener("click", async () => {
    if (currentPaperPage >= currentPaperTotalPages) return;
    try {
        currentPaperPage += 1;
        await refreshPapers();
    } catch (e) {
        show(e.message, "danger");
    }
});

recordPrevBtn.addEventListener("click", async () => {
    if (currentRecordPage <= 1) return;
    try {
        currentRecordPage -= 1;
        await refreshExamHistory();
    } catch (e) {
        show(e.message, "danger");
    }
});

recordNextBtn.addEventListener("click", async () => {
    if (currentRecordPage >= currentRecordTotalPages) return;
    try {
        currentRecordPage += 1;
        await refreshExamHistory();
    } catch (e) {
        show(e.message, "danger");
    }
});

backPaperListBtn.addEventListener("click", () => {
    paperDetailSection.classList.add("d-none");
    paperListSection.classList.remove("d-none");
});

backRecordListBtn.addEventListener("click", () => {
    clearExamDetailTimer();
    recordDetailSection.classList.add("d-none");
    recordListSection.classList.remove("d-none");
});

backToOperationBtn.addEventListener("click", () => {
    openModule("operation");
});

manualPaperBtn.addEventListener("click", async () => {
    const ids = Array.from(selectedQuestionIds);
    if (!ids.length) return show("请先勾选题目");
    const formValues = await openActionConfirmDialog({
        title: "手动组卷确认",
        description: `已勾选题目 ${ids.length} 道，请输入试卷名称后确认执行。`,
        fields: [
            {
                name: "title",
                label: "试卷名称",
                type: "text",
                defaultValue: "手动组卷",
                required: true,
            },
        ],
    });
    if (!formValues) return;
    await runWithButtonLoading(manualPaperBtn, async () => {
        try {
            await createManualPaper({ bankId: Number(bankSelect.value), title: formValues.title, questionIds: ids });
            await refreshPapers();
            openModule("papers");
            show("手动组卷成功");
        } catch (e) {
            show(e.message, "danger");
        }
    }, "组卷中...");
});

const FALLBACK_CATEGORY_OPTIONS = [
    "索引优化", "底层原理", "事务与锁", "SQL调优", "存储引擎", "复制与高可用", "安全与权限", "其他",
];

function getCategoryOptionsForDialog() {
    const opts = (currentQuestionCategoryOptions || []).map((c) => String(c).trim()).filter(Boolean);
    return opts.length ? opts : FALLBACK_CATEGORY_OPTIONS;
}

autoPaperBtn.addEventListener("click", async () => {
    const formValues = await openActionConfirmDialog({
        title: "自动组卷确认",
        description: "请填写自动组卷参数后确认执行。不选难度/类型表示不限制。",
        fields: [
            {
                name: "title",
                label: "试卷名称",
                type: "text",
                defaultValue: "自动组卷",
                required: true,
            },
            {
                name: "difficultyLevels",
                label: "包含难度（可多选，不选为不限制）",
                type: "multicheckbox",
                options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: n + "星" })),
                optionNumber: true,
            },
            {
                name: "categoryTypes",
                label: "包含类型（可多选，不选为不限制）",
                type: "multicheckbox",
                options: getCategoryOptionsForDialog().map((c) => ({ value: c, label: c })),
            },
            {
                name: "singleChoiceCount",
                label: "单选题数量（0-100）",
                type: "number",
                defaultValue: 5,
                min: 0,
                max: 100,
                required: true,
            },
            {
                name: "multipleChoiceCount",
                label: "多选题数量（0-100）",
                type: "number",
                defaultValue: 2,
                min: 0,
                max: 100,
                required: true,
            },
            {
                name: "shortAnswerCount",
                label: "简答题数量（0-100）",
                type: "number",
                defaultValue: 2,
                min: 0,
                max: 100,
                required: true,
            },
            {
                name: "trueFalseCount",
                label: "判断题数量（0-100）",
                type: "number",
                defaultValue: 3,
                min: 0,
                max: 100,
                required: true,
            },
        ],
    });
    if (!formValues) return;
    await runWithButtonLoading(autoPaperBtn, async () => {
        try {
            const payload = { bankId: Number(bankSelect.value), ...formValues };
            if (payload.difficultyLevels && !payload.difficultyLevels.length) delete payload.difficultyLevels;
            if (payload.categoryTypes && !payload.categoryTypes.length) delete payload.categoryTypes;
            await createAutoPaper(payload);
            currentPaperPage = 1;
            await refreshPapers();
            openModule("papers");
            show("自动组卷成功");
        } catch (e) {
            show(e.message, "danger");
        }
    }, "组卷中...");
});

startExamBtn.addEventListener("click", async () => {
    const formValues = await openActionConfirmDialog({
        title: "自动考试确认",
        description: "请输入随机抽题数量。不选难度/类型表示不限制。",
        fields: [
            {
                name: "questionCount",
                label: "抽题数量（1-50）",
                type: "number",
                defaultValue: 5,
                min: 1,
                max: 50,
                required: true,
            },
            {
                name: "difficultyLevels",
                label: "包含难度（可多选）",
                type: "multiselect-dropdown",
                options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: n + "星" })),
                optionNumber: true,
                defaultAllSelected: true,
            },
            {
                name: "categoryTypes",
                label: "包含类型（可多选）",
                type: "multiselect-dropdown",
                options: getCategoryOptionsForDialog().map((c) => ({ value: c, label: c })),
                defaultAllSelected: true,
            },
        ],
    });
    if (!formValues) return;
    await runWithButtonLoading(startExamBtn, async () => {
        try {
            const payload = {
                bankId: Number(bankSelect.value),
                questionCount: formValues.questionCount,
            };
            if (formValues.difficultyLevels?.length) payload.difficultyLevels = formValues.difficultyLevels;
            if (formValues.categoryTypes?.length) payload.categoryTypes = formValues.categoryTypes;
            const started = await startRandomExam(payload);
            currentExamId = started.examRecordId;
            renderExamQuestions(started.paper.questions);
            try {
                const draftMap = await loadExamDraft(currentExamId);
                applyDraftToUI(draftMap);
            } catch (e2) {
                console.warn("[draft] load failed", e2?.message || e2);
            }
            startAutoSaveDraft();
            void loadExamSessionMeta(currentExamId, started?.paper?.paper?.title || "").catch(() => {});
            examResult.innerHTML = "";
            showExamSession(`考试来源：自动抽题（${formValues.questionCount} 题），记录ID：${currentExamId}`);
            show(`考试已开始，记录ID：${currentExamId}`);
        } catch (e) {
            show(e.message, "danger");
        }
    }, "启动中...");
});

examForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentExamId) return show("请先开始考试");
    const submitExamBtn = document.getElementById("submitExamBtn");
    await runWithButtonLoading(submitExamBtn, async () => {
        try {
            const res = await submitExam(currentExamId, { answers: collectExamAnswers() });
            clearExamDraftTimer();
            currentRecordPage = 1;
            await refreshExamHistory();
            const detail = await examRecordDetail(res.examRecordId);
            renderExamRecordDetail(detail);
            recordListSection.classList.add("d-none");
            recordDetailSection.classList.remove("d-none");
            openModule("records");
            show("考试已提交并完成评分，已跳转到本次结果");
        } catch (e2) {
            show(e2.message, "danger");
        }
    }, "提交中...");
});

bankSelect.addEventListener("change", async () => {
    try {
        selectedQuestionIds.clear();
        currentPaperPage = 1;
        currentRecordPage = 1;
        paperDetailSection.classList.add("d-none");
        paperListSection.classList.remove("d-none");
        recordDetailSection.classList.add("d-none");
        recordListSection.classList.remove("d-none");
        examQuestions.innerHTML = "";
        examResult.innerHTML = "";
        examSessionMeta.textContent = "尚未开始考试";
        currentExamId = null;
        const bankId = bankSelect.value;
        if (bankSelectMobile && bankSelectMobile.value !== bankId) {
            bankSelectMobile.value = bankId;
        }
        await loadQuestionFilters(bankId);
        syncGenerateButtonDisabledState();
        await refreshQuestions(1);
        await refreshPapers();
        await refreshExamHistory();
    } catch (e) {
        show(e.message, "danger");
    }
});

if (bankSelectMobile) {
    bankSelectMobile.addEventListener("change", () => {
        if (!bankSelect) return;
        if (bankSelect.value !== bankSelectMobile.value) {
            bankSelect.value = bankSelectMobile.value;
            bankSelect.dispatchEvent(new Event("change"));
        }
        if (isSidebarDrawerMode()) closeExamSidebar();
    });
}

function openExamSidebar() {
    if (!examSidebar || !document.getElementById("examSidebarBackdrop")) return;
    examSidebar.classList.add("exam-sidebar-open");
    // 抽屉模式下显式展开，避免某些环境里 class 样式未生效
    if (isSidebarDrawerMode()) {
        examSidebar.style.transform = "translateX(0)";
    } else {
        examSidebar.style.transform = "";
    }
    document.getElementById("examSidebarBackdrop").classList.add("exam-sidebar-backdrop-visible");
    document.getElementById("examSidebarBackdrop").setAttribute("aria-hidden", "false");
}
function closeExamSidebar() {
    closeExamSidebarNow();
}
function toggleExamSidebar() {
    if (!examSidebar) return;
    if (!isSidebarDrawerMode()) {
        // 桌面端：只有在“收起”后才会显示该按钮
        if (isDesktopSidebarCollapsed()) setDesktopSidebarCollapsed(false);
        else setDesktopSidebarCollapsed(true);
        return;
    }
    if (examSidebar.classList.contains("exam-sidebar-open")) closeExamSidebar();
    else openExamSidebar();
}
if (examSidebarToggle && examSidebar) {
    examSidebarToggle.addEventListener("click", () => toggleExamSidebar());
}
var examSidebarBackdrop = document.getElementById("examSidebarBackdrop");
if (examSidebarBackdrop) {
    examSidebarBackdrop.addEventListener("click", () => closeExamSidebar());
}

const applyQuestionFilter = document.getElementById("applyQuestionFilter");
if (applyQuestionFilter) {
    applyQuestionFilter.addEventListener("click", async () => {
        try {
            await refreshQuestions(1);
        } catch (e) {
            show(e.message, "danger");
        }
    });
}

if (genBtnMobile && genBtn) {
    genBtnMobile.addEventListener("click", () => genBtn.click());
}
if (deleteSelectedBtnMobile && deleteSelectedBtn) {
    deleteSelectedBtnMobile.addEventListener("click", () => deleteSelectedBtn.click());
}
if (manualPaperBtnMobile && manualPaperBtn) {
    manualPaperBtnMobile.addEventListener("click", () => manualPaperBtn.click());
}
if (autoPaperBtnMobile && autoPaperBtn) {
    autoPaperBtnMobile.addEventListener("click", () => autoPaperBtn.click());
}
if (startExamBtnMobile && startExamBtn) {
    startExamBtnMobile.addEventListener("click", () => startExamBtn.click());
}

statsBankSelect?.addEventListener("change", async () => {
    const bankId = getCurrentStatsBankId();
    await refreshStatsPaperOptionsByBank(bankId);
    await loadStatsAndCharts();
});
statsPaperSelect?.addEventListener("change", () => loadStatsAndCharts());
statsQueryBtn?.addEventListener("click", () => loadStatsAndCharts());

function syncStatsPanelByCurrentBankSelection() {
    if (!moduleStats || moduleStats.classList.contains("d-none")) return;
    const bankId = getCurrentStatsBankId();
    void refreshStatsPaperOptionsByBank(bankId).then(() => loadStatsAndCharts());
}

bankSelect?.addEventListener("change", () => {
    syncStatsPanelByCurrentBankSelection();
});
bankSelectMobile?.addEventListener("change", () => {
    syncStatsPanelByCurrentBankSelection();
});

document.addEventListener("click", (e) => {
    const btn = e.target.closest(".module-menu-btn");
    if (!btn) return;
    if (isSidebarDrawerMode()) {
        closeExamSidebarNow();
    }
}, true);
document.addEventListener("click", (e) => {
    if (!questionFiltersDrawer || !isMobileLike()) return;
    if (!questionFiltersDrawer.hasAttribute("open")) return;
    if (questionFiltersDrawer.contains(e.target)) return;
    collapseMobileQuestionFiltersDrawer();
});
window.addEventListener("resize", () => {
    syncQuestionFiltersDrawerForViewport();
});
moduleMenuBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-module");
        const drawerMode = isSidebarDrawerMode();
        if (!drawerMode) {
            // 桌面端切换模块时保持组卷二级菜单展开，避免误收起
            setExamSubmenuOpen(true);
        }
        console.log("[sidebar] module-menu-btn click", {
            key,
            drawerMode,
        });
        openModule(key);
        if (drawerMode) {
            closeExamSidebarNow();
        }
    });
});

moduleTags.addEventListener("click", (e) => {
    const closeKey = e.target?.getAttribute?.("data-close");
    if (closeKey) {
        closeModule(closeKey);
        return;
    }
    const tag = e.target.closest?.(".module-tag");
    if (!tag) return;
    const key = tag.getAttribute("data-module");
    if (key) activateModule(key);
});

(async function initUserArea() {
    const profile = await ApiClient.validateMe();
    const displayName = ApiClient.getDisplayName?.(profile?.user);
    if (displayName && userArea && userAreaText) {
        userAreaText.textContent = displayName;
        userArea.href = "./center.html";
    } else if (userArea && userAreaText) {
        userAreaText.textContent = "登录/注册";
        userArea.href = "./login.html";
    }
})();

(async function bootExam() {
    if (!ApiClient.requireAuth()) return;
    if (window.PhoneBindModal) await PhoneBindModal.ensureBound();
    updateQuestionUsageHint();
    // 移动端：初始化阶段即隐藏“全选/分页”相关 UI，避免后端未返回时闪现
    setMobilePagerUiHidden(isMobileLike());
    try {
        syncQuestionFiltersDrawerForViewport();
        await initBanks();
        renderModuleTabs();
        refreshModulePanels();
        try {
            await loadActiveGenTasksFromServer();
        } catch {
            // 兼容旧后端：仍可从浏览器本地恢复角标
            loadPersistedGenTasks();
        }
        syncGenerateButtonDisabledState();
        updateQuestionUsageHint();
        if (bankSelect.value) {
            await loadQuestionFilters(bankSelect.value);
            await Promise.all([
                refreshQuestions(1),
                refreshPapers(),
                refreshExamHistory(),
            ]);
            if (isMobileLike()) {
                setMobilePagerUiHidden(true);
                bindMobileInfiniteScroll();
            } else {
                setMobilePagerUiHidden(false);
            }
        }
    } catch {
        show("初始化失败，请先启动后端", "danger");
    }
})();
