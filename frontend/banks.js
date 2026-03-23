const createForm = document.getElementById("createForm");
const createName = document.getElementById("createName");
const createDesc = document.getElementById("createDesc");
const createFile = document.getElementById("createFile");
const bankList = document.getElementById("bankList");
const bankCount = document.getElementById("bankCount");
const msg = document.getElementById("msg");
const uploadTaskFab = document.getElementById("uploadTaskFab");
const uploadTaskFabCount = document.getElementById("uploadTaskFabCount");
const uploadTaskModalBackdrop = document.getElementById("uploadTaskModalBackdrop");
const closeUploadTaskModalBtn = document.getElementById("closeUploadTaskModalBtn");
const uploadTaskList = document.getElementById("uploadTaskList");
const addBankModalBackdrop = document.getElementById("addBankModalBackdrop");
const addBankFab = document.getElementById("addBankFab");
const userArea = document.getElementById("userArea");
const userAreaText = document.getElementById("userAreaText");

const UPLOAD_TASKS_STORAGE_KEY = "exam-center-upload-tasks";
const uploadTaskMap = new Map();
const bankNameMap = new Map();
let uploadTaskSeed = 0;
let loadingMaskCount = 0;

const OUTLINE_TASK_STORAGE_KEY_PREFIX = "exam-center-outline-tasks-v1";

function getOutlineTaskKey(bankId, documentId) {
    return `${bankId}:${documentId}`;
}

function getOutlineTaskStorageKey(bankId, documentId) {
    return `${OUTLINE_TASK_STORAGE_KEY_PREFIX}:${getOutlineTaskKey(bankId, documentId)}`;
}

function loadPersistedOutlineTaskId(bankId, documentId) {
    try {
        const raw = sessionStorage.getItem(getOutlineTaskStorageKey(bankId, documentId));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data?.taskId) return null;
        return String(data.taskId);
    } catch {
        return null;
    }
}

function persistOutlineTaskId(bankId, documentId, taskId) {
    try {
        sessionStorage.setItem(
            getOutlineTaskStorageKey(bankId, documentId),
            JSON.stringify({ taskId: String(taskId), updatedAt: Date.now() }),
        );
    } catch {
        // ignore storage failures
    }
}

function clearPersistedOutlineTaskId(bankId, documentId) {
    try {
        sessionStorage.removeItem(getOutlineTaskStorageKey(bankId, documentId));
    } catch {
        // ignore
    }
}

/** 清除某题库下所有大纲任务缓存（session + 内存），用于「重新解析」 */
function clearOutlineTasksForBank(bankId) {
    const bid = String(bankId);
    const prefix = `${OUTLINE_TASK_STORAGE_KEY_PREFIX}:${bid}:`;
    try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i);
            if (k && k.startsWith(prefix)) {
                sessionStorage.removeItem(k);
            }
        }
    } catch {
        // ignore
    }
    for (const key of outlineState.outlineTaskIdByDocId.keys()) {
        if (key.startsWith(`${bid}:`)) {
            outlineState.outlineTaskIdByDocId.delete(key);
        }
    }
    for (const key of outlineState.outlineTaskPromiseByDocId.keys()) {
        if (key.startsWith(`${bid}:`)) {
            outlineState.outlineTaskPromiseByDocId.delete(key);
        }
    }
    for (const key of outlineState.useTaskForDocPage.keys()) {
        if (key.startsWith(`${bid}:`)) {
            outlineState.useTaskForDocPage.delete(key);
        }
    }
}

function saveUploadTasksToStorage() {
    const running = Array.from(uploadTaskMap.values())
        .filter((t) => t.taskId && (t.status === "PENDING" || t.status === "RUNNING"))
        .map((t) => ({ taskId: t.taskId, bankId: t.bankId, fileNames: t.fileNames || [], createdAt: t.createdAt }));
    try {
        sessionStorage.setItem(UPLOAD_TASKS_STORAGE_KEY, JSON.stringify(running));
    } catch (_) {}
}

function loadPersistedUploadTasks() {
    try {
        const raw = sessionStorage.getItem(UPLOAD_TASKS_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list) || !list.length) return;
        list.forEach((item) => {
            const taskId = item.taskId;
            const bankId = item.bankId;
            if (!taskId || !bankId) return;
            const localId = `local-restored-${taskId}`;
            if (uploadTaskMap.has(localId)) return;
            const task = {
                localId,
                taskId,
                bankId,
                fileNames: item.fileNames || [],
                totalFiles: (item.fileNames || []).length || 1,
                processedFiles: 0,
                transferPercent: 100,
                progressPercent: 0,
                statusText: "恢复中，正在查询进度...",
                status: "RUNNING",
                createdAt: item.createdAt || Date.now(),
            };
            uploadTaskMap.set(localId, task);
            void monitorUploadTask(localId);
        });
        renderUploadTasksUI();
    } catch (_) {}
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
    if (mask) mask.classList.add("d-none");
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

async function fetchBanks() {
    const res = await ApiClient.request("/banks");
    if (!res.ok) throw new Error("获取题库失败");
    return res.json();
}

async function createBank(payload) {
    const res = await ApiClient.request("/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("创建题库失败");
    return res.json();
}

async function updateBank(id, payload) {
    const res = await ApiClient.request(`/banks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("更新题库失败");
    return res.json();
}

async function deleteBank(id) {
    const res = await ApiClient.request(`/banks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("删除题库失败");
}

function getBankName(bankId) {
    return bankNameMap.get(bankId) || `题库 ${bankId}`;
}

function getUploadTaskPercent(task) {
    const processPercent = Number(task.progressPercent ?? 0);
    const transferPercent = Number(task.transferPercent ?? 0);
    return Math.max(0, Math.min(100, Math.round(transferPercent * 0.4 + processPercent * 0.6)));
}

function renderUploadTasksUI() {
    const allTasks = Array.from(uploadTaskMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    const activeTasks = allTasks.filter((t) => t.status === "PENDING" || t.status === "RUNNING");
    const failedTasks = allTasks.filter((t) => t.status === "FAILED" || t.status === "PARTIAL_FAILED");
    const count = allTasks.length;
    uploadTaskFab.classList.toggle("d-none", count === 0);
    uploadTaskFabCount.textContent = String(count);

    const parts = [];

    if (activeTasks.length) {
        parts.push(activeTasks.map((task) => {
            const percent = getUploadTaskPercent(task);
            const fileNames = task.fileNames?.length ? task.fileNames.join("、") : "未知文件";
            const safeFileNames = escapeHtml(fileNames);
            const summary = task.statusText || `处理中：${task.processedFiles || 0}/${task.totalFiles || task.fileNames.length || 0}`;
            return `
            <div class="upload-task-item">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                    <div class="fw-semibold">${escapeHtml(getBankName(task.bankId))}</div>
                    <span class="small text-secondary">${percent}%</span>
                </div>
                <div class="small text-secondary mb-2" title="${safeFileNames}">${safeFileNames}</div>
                <div class="progress" role="progressbar" aria-label="任务进度">
                    <div class="progress-bar progress-bar-striped progress-bar-animated" style="width:${percent}%">${percent}%</div>
                </div>
                <div class="small text-secondary mt-1">${escapeHtml(summary)}</div>
            </div>
        `;
        }).join(""));
    }

    if (failedTasks.length) {
        parts.push(`
            <div class="small fw-semibold text-danger mt-2 mb-1">失败记录</div>
            ${failedTasks.map((task) => {
                const fileNames = task.fileNames?.length ? task.fileNames.join("、") : "未知文件";
                const safeFileNames = escapeHtml(fileNames);
                const errors = Array.isArray(task.errors) ? task.errors : [];
                const summary = task.status === "PARTIAL_FAILED"
                    ? `部分失败：成功 ${task.successFiles ?? 0}，失败 ${task.failedFiles ?? 0}`
                    : (task.statusText || "上传失败");
                const localId = escapeHtml(task.localId);
                const errorsId = `upload-errors-${task.localId}`;
                const errorsList = errors.length ? errors : [task.statusText || "未知错误"];
                const errorsHtml = `<div id="${errorsId}" class="upload-task-errors collapse mt-2"><ul class="small text-danger mb-0 ps-3">${errorsList.map((e) => `<li>${escapeHtml(String(e))}</li>`).join("")}</ul></div>`;
                return `
            <div class="upload-task-item upload-task-item-failed border border-danger rounded p-2">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                    <div class="fw-semibold text-danger">${escapeHtml(getBankName(task.bankId))}</div>
                    <div class="d-flex align-items-center gap-1">
                        <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1 upload-task-view-errors" data-local-id="${localId}" data-errors-id="${errorsId}" title="查看全部失败原因">查看原因</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1 upload-task-remove" data-local-id="${localId}" title="移除此记录">移除</button>
                    </div>
                </div>
                <div class="small text-secondary mb-1" title="${safeFileNames}">${safeFileNames}</div>
                <div class="small text-secondary">${escapeHtml(summary)}</div>
                ${errorsHtml}
            </div>
        `;
            }).join("")}
        `);
    }

    if (parts.length === 0) {
        uploadTaskList.innerHTML = '<div class="text-secondary small">当前无上传任务</div>';
        return;
    }
    uploadTaskList.innerHTML = parts.join("");

    uploadTaskList.querySelectorAll(".upload-task-view-errors").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-errors-id");
            const el = document.getElementById(id);
            if (!el) return;
            const bsCollapse = window.bootstrap?.Collapse ? new bootstrap.Collapse(el, { toggle: true }) : null;
            if (!bsCollapse) el.classList.toggle("collapse");
        });
    });
    uploadTaskList.querySelectorAll(".upload-task-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
            const localId = btn.getAttribute("data-local-id");
            if (localId) {
                uploadTaskMap.delete(localId);
                saveUploadTasksToStorage();
                renderUploadTasksUI();
            }
        });
    });
}

function openUploadTaskModal() {
    renderUploadTasksUI();
    uploadTaskModalBackdrop.classList.remove("d-none");
}

function closeUploadTaskModal() {
    uploadTaskModalBackdrop.classList.add("d-none");
}

function createUploadTask(bankId, files) {
    const localId = `local-${Date.now()}-${uploadTaskSeed++}`;
    const task = {
        localId,
        taskId: "",
        bankId,
        fileNames: files.map((x) => x.name || "unknown"),
        totalFiles: files.length,
        processedFiles: 0,
        transferPercent: 0,
        progressPercent: 0,
        statusText: "准备上传...",
        status: "PENDING",
        createdAt: Date.now(),
    };
    uploadTaskMap.set(localId, task);
    renderUploadTasksUI();
    return task;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseJsonSafe(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

function startUploadTask(bankId, files, onProgress) {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        files.forEach((file) => fd.append("files", file));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${ApiClient.API_BASE}/banks/${bankId}/documents/batch/async`);
        const token = ApiClient.getToken();
        if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) {
                onProgress?.(10, "正在上传到服务端...");
                return;
            }
            const transferPercent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
            onProgress?.(transferPercent, `文件传输中：${transferPercent}%`);
        };
        xhr.onerror = () => reject(new Error("上传请求失败，请检查网络或后端服务"));
        xhr.onload = async () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                let message = "创建异步上传任务失败";
                try {
                    const data = JSON.parse(xhr.responseText || "{}");
                    if (data?.message) message = data.message;
                } catch {
                    // ignore parse errors
                }
                reject(new Error(message));
                return;
            }
            try {
                const data = JSON.parse(xhr.responseText || "{}");
                if (!data?.taskId) {
                    reject(new Error("服务端未返回上传任务 ID"));
                    return;
                }
                resolve(data.taskId);
            } catch {
                reject(new Error("解析上传任务结果失败"));
            }
        };
        xhr.send(fd);
    });
}

async function pollUploadTask(bankId, taskId, onUpdate) {
    for (let i = 0; i < 1800; i++) {
        const res = await ApiClient.request(`/banks/${bankId}/documents/upload-tasks/${taskId}`);
        if (!res.ok) {
            const message = await readErrorMessage(res, "查询上传进度失败");
            throw new Error(message);
        }
        const task = await readResponseJsonSafe(res);
        const processPercent = task?.progressPercent ?? 0;
        const status = task?.status || "RUNNING";
        const currentFile = task?.currentFileName || "";
        const processedFiles = task?.processedFiles ?? 0;
        const totalFiles = task?.totalFiles ?? 0;
        const statusText = currentFile
            ? `服务端处理中：${processedFiles}/${totalFiles}（${currentFile}）`
            : `服务端处理中：${processedFiles}/${totalFiles}`;
        onUpdate?.({
            progressPercent: processPercent,
            processedFiles,
            totalFiles,
            statusText,
            status,
        });

        if (status === "COMPLETED") {
            onUpdate?.({
                progressPercent: 100,
                processedFiles,
                totalFiles,
                statusText: `上传完成：${task.successFiles || 0}/${task.totalFiles || 0}`,
                status,
            });
            return { task, status: "COMPLETED" };
        }
        if (status === "PARTIAL_FAILED") {
            return { task, status: "PARTIAL_FAILED" };
        }
        await sleep(1000);
    }
    throw new Error("上传任务处理超时，请稍后刷新查看结果");
}

async function uploadFiles(bankId, files) {
    if (!files?.length) return null;
    const localTask = createUploadTask(bankId, files);
    try {
        const taskId = await startUploadTask(bankId, files, (transferPercent, text) => {
            const task = uploadTaskMap.get(localTask.localId);
            if (!task) return;
            task.transferPercent = transferPercent;
            task.statusText = text;
            task.status = "RUNNING";
            renderUploadTasksUI();
        });
        const task = uploadTaskMap.get(localTask.localId);
        if (!task) return localTask;
        task.taskId = taskId;
        task.status = "RUNNING";
        task.statusText = "任务已创建，开始服务端入库...";
        renderUploadTasksUI();
        saveUploadTasksToStorage();
        void monitorUploadTask(task.localId);
        return localTask;
    } catch (err) {
        const task = uploadTaskMap.get(localTask.localId);
        if (task) {
            task.status = "FAILED";
            task.statusText = err?.message || "创建上传任务失败";
            task.errors = [err?.message || "创建上传任务失败"];
            renderUploadTasksUI();
        }
        throw err;
    }
}

async function monitorUploadTask(localTaskId) {
    const task = uploadTaskMap.get(localTaskId);
    if (!task || !task.taskId) return;
    try {
        const result = await pollUploadTask(task.bankId, task.taskId, (update) => {
            const current = uploadTaskMap.get(localTaskId);
            if (!current) return;
            if (typeof update.progressPercent === "number") current.progressPercent = update.progressPercent;
            if (typeof update.processedFiles === "number") current.processedFiles = update.processedFiles;
            if (typeof update.totalFiles === "number") current.totalFiles = update.totalFiles;
            if (typeof update.statusText === "string") current.statusText = update.statusText;
            if (typeof update.status === "string") current.status = update.status;
            renderUploadTasksUI();
        });
        const current = uploadTaskMap.get(localTaskId);
        if (!current) return;
        if (result?.status === "PARTIAL_FAILED" && result.task) {
            current.status = "PARTIAL_FAILED";
            current.statusText = `部分失败：成功 ${result.task.successFiles ?? 0}，失败 ${result.task.failedFiles ?? 0}`;
            current.successFiles = result.task.successFiles;
            current.failedFiles = result.task.failedFiles;
            current.errors = Array.isArray(result.task.errors) ? result.task.errors : [];
            renderUploadTasksUI();
            show(`部分文件上传失败：成功 ${result.task.successFiles ?? 0}，失败 ${result.task.failedFiles ?? 0}`, "danger");
        } else {
            current.status = "COMPLETED";
            current.statusText = "上传完成";
            renderUploadTasksUI();
            setTimeout(() => {
                uploadTaskMap.delete(localTaskId);
                saveUploadTasksToStorage();
                renderUploadTasksUI();
            }, 1200);
        }
        await refresh();
    } catch (error) {
        const current = uploadTaskMap.get(localTaskId);
        if (current) {
            current.status = "FAILED";
            current.statusText = error?.message || "上传失败";
            current.errors = [error?.message || "上传失败"];
            renderUploadTasksUI();
        }
        show(error?.message || "上传失败", "danger");
        await refresh();
    }
}

async function fetchBankDocuments(bankId) {
    const res = await ApiClient.request(`/banks/${bankId}/documents`);
    if (!res.ok) throw new Error("获取知识文件失败");
    return res.json();
}

async function deleteDocument(bankId, documentId) {
    const res = await ApiClient.request(`/banks/${bankId}/documents/${documentId}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const message = await readErrorMessage(res, "删除知识文件失败");
        throw new Error(message);
    }
}

function escapeHtml(text = "") {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatDocStatus(status = "", parseStatus = "") {
    const normalized = String(parseStatus || status || "").toUpperCase();
    switch (normalized) {
        case "PARSING":
        case "INIT":
        case "IN_PARSE_QUEUE":
            return "解析中";
        case "PARSE_SUCCESS":
        case "UPLOADED":
            return "解析成功";
        case "PARSE_FAILED":
        case "FAILED":
            return "解析失败";
        default:
            return normalized || "UNKNOWN";
    }
}

function isImageFile(name = "") {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function isDocumentOutlineReady(doc) {
    if (!doc || isImageFile(doc.fileName)) return false;
    const ps = String(doc.parseStatus || "").toUpperCase();
    return ps === "PARSE_SUCCESS"
        || ps === "FILE_IS_READY"
        || ps === "INDEX_BUILD_SUCCESS";
}

const outlineModalBackdrop = document.getElementById("outlineModalBackdrop");
const closeOutlineModalBtn = document.getElementById("closeOutlineModalBtn");
const outlineDocList = document.getElementById("outlineDocList");
const outlineMeta = document.getElementById("outlineMeta");
const outlineParseProgressWrap = document.getElementById("outlineParseProgressWrap");
const outlineParseProgressText = document.getElementById("outlineParseProgressText");
const outlineParseProgressBar = document.getElementById("outlineParseProgressBar");
const outlineContent = document.getElementById("outlineContent");
const outlinePrevBtn = document.getElementById("outlinePrevBtn");
const outlineNextBtn = document.getElementById("outlineNextBtn");
const outlinePageLabel = document.getElementById("outlinePageLabel");

const outlineState = {
    bankId: null,
    documents: [],
    selectedDocId: null,
    page: 1,
    size: 1,
    totalBlocks: 0,
    extractMode: "",
    loadSeq: 0,
    /** 从知识文件卡片进入：只读已保存大纲，不发起异步解析 */
    docClickOnly: false,
    /** view：仅展示已有/进行中；restart：本次打开由「大纲解析」触发，首屏可强制重新排队 */
    openMode: "view",
    /** taskKey -> 分页是否走异步任务结果接口（否则走同步 GET） */
    useTaskForDocPage: new Map(),
    outlineTaskIdByDocId: new Map(),
    outlineTaskPromiseByDocId: new Map(),
};

async function fetchDocumentOutline(bankId, documentId, page, size) {
    const res = await ApiClient.request(
        `/banks/${bankId}/documents/${documentId}/outline?page=${page}&size=${size}`,
    );
    if (!res.ok) {
        const raw = await res.clone().text().catch(() => "");
        console.error("[outline] request failed", {
            bankId,
            documentId,
            page,
            size,
            status: res.status,
            statusText: res.statusText,
            body: raw,
        });
        const message = await readErrorMessage(res, "获取大纲失败");
        throw new Error(message);
    }
    const data = await res.json();
    console.info("[outline] request ok", {
        bankId,
        documentId,
        page,
        size,
        extractMode: data?.extractMode,
        totalBlocks: data?.totalBlocks,
    });
    return data;
}

async function startOutlineGenerateTaskAsync(bankId, documentId, restart = false) {
    const q = restart ? "?restart=true" : "";
    const res = await ApiClient.request(
        `/banks/${bankId}/documents/${documentId}/outline/generate/async${q}`,
        { method: "POST" },
    );
    if (!res.ok) {
        const message = await readErrorMessage(res, "启动大纲解析任务失败");
        throw new Error(message);
    }
    const data = await res.json().catch(() => null);
    const taskId = data?.taskId;
    if (!taskId) throw new Error("服务端未返回任务 ID");
    return taskId;
}

async function pollOutlineGenerateTaskStatus(bankId, taskId, { onUpdate, shouldContinue } = {}) {
    for (let i = 0; i < 360; i++) { // 360 * 2s ~= 12 min
        if (typeof shouldContinue === "function" && !shouldContinue()) return null;
        const res = await ApiClient.request(`/banks/${bankId}/documents/outline-generate-tasks/${taskId}`);
        if (!res.ok) {
            const message = await readErrorMessage(res, "查询大纲任务进度失败");
            throw new Error(message);
        }
        const data = await res.json();
        onUpdate?.(data);
        if (data?.status === "SUCCESS") return data;
        if (data?.status === "FAILED") throw new Error(data?.message || "大纲解析失败");
        await sleep(2000);
    }
    throw new Error("大纲解析任务轮询超时，请稍后重试");
}

async function fetchOutlineGenerateTaskPage(bankId, taskId, page, size) {
    const res = await ApiClient.request(
        `/banks/${bankId}/documents/outline-generate-tasks/${taskId}/page?page=${page}&size=${size}`,
    );
    if (!res.ok) {
        const message = await readErrorMessage(res, "获取大纲解析结果失败");
        throw new Error(message);
    }
    return res.json();
}

function renderOutlineDocList() {
    if (!outlineDocList) return;
    outlineDocList.innerHTML = outlineState.documents.map((doc) => {
        const active = Number(doc.id) === Number(outlineState.selectedDocId);
        const safeName = escapeHtml(doc.fileName || "");
        const status = escapeHtml(formatDocStatus(doc.status, doc.parseStatus));
        return `
            <button type="button" class="outline-doc-pick w-100${active ? " is-active" : ""}"
                data-outline-pick="${doc.id}"
                >
                <span class="d-block fw-semibold text-truncate" title="${safeName}">${safeName}</span>
                <span class="small text-secondary">${status}</span>
            </button>
        `;
    }).join("");
}

if (outlineDocList && !outlineDocList.dataset.delegationBound) {
    outlineDocList.dataset.delegationBound = "1";
    outlineDocList.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("[data-outline-pick]");
        if (!btn) return;
        const id = Number(btn.getAttribute("data-outline-pick"));
        if (!id) return;
        outlineState.selectedDocId = id;
        outlineState.page = 1;
        // 弹窗内切换文件：只查看，不再触发重新解析
        outlineState.openMode = "view";
        renderOutlineDocList();
        await loadOutlinePageIntoModal();
    });
}

function showOutlineParseProgress(percent = 0, text = "") {
    if (!outlineParseProgressWrap || !outlineParseProgressBar || !outlineParseProgressText) return;
    const p = Number.isFinite(Number(percent)) ? Number(percent) : 0;
    const safe = Math.max(0, Math.min(100, Math.round(p)));
    outlineParseProgressBar.style.width = safe + "%";
    outlineParseProgressBar.textContent = safe + "%";
    outlineParseProgressText.textContent = text ? String(text) : "解析中…";
    outlineParseProgressWrap.classList.remove("d-none");
}

function hideOutlineParseProgress() {
    if (!outlineParseProgressWrap) return;
    outlineParseProgressWrap.classList.add("d-none");
}

function setOutlineNavDisabled(disabled) {
    if (outlinePrevBtn) outlinePrevBtn.disabled = !!disabled;
    if (outlineNextBtn) outlineNextBtn.disabled = !!disabled;
}

function openOutlineModal(bankId, documents, preferredDocId, options = {}) {
    const restart = !!options.restart;
    outlineState.docClickOnly = !!options.docClickOnly;
    outlineState.bankId = bankId;
    outlineState.documents = documents || [];
    outlineState.size = 1;
    outlineState.page = 1;
    outlineState.totalBlocks = 0;
    outlineState.extractMode = "";
    outlineState.openMode = restart ? "restart" : "view";

    // 用于避免旧的异步轮询结果覆盖新选择
    outlineState.loadSeq += 1;
    if (restart) {
        clearOutlineTasksForBank(bankId);
    }

    let pick = preferredDocId;
    if (!pick) {
        const first = outlineState.documents.find((d) => d && !isImageFile(d.fileName));
        pick = first ? first.id : null;
    }
    outlineState.selectedDocId = pick;

    const navRow = document.getElementById("outlineNavRow");
    if (navRow) navRow.classList.toggle("d-none", outlineState.docClickOnly);

    if (outlineDocList) {
        outlineDocList.classList.toggle("d-none", outlineState.documents.length <= 1);
    }

    if (outlineModalBackdrop) {
        outlineModalBackdrop.classList.remove("d-none");
        outlineModalBackdrop.setAttribute("aria-hidden", "false");
    }
    renderOutlineDocList();
    if (outlineContent) outlineContent.textContent = pick ? "加载中…" : "当前题库没有可解析的知识文件，或文件仍在解析中。请先上传文档并等待「解析成功」。";
    if (outlineMeta) outlineMeta.textContent = "";
    if (outlinePageLabel) outlinePageLabel.textContent = "";
    hideOutlineParseProgress();
    setOutlineNavDisabled(true);
    if (pick) {
        void loadOutlinePageIntoModal();
    }
}

function closeOutlineModal() {
    if (outlineModalBackdrop) {
        outlineModalBackdrop.classList.add("d-none");
        outlineModalBackdrop.setAttribute("aria-hidden", "true");
    }
    hideOutlineParseProgress();
}

async function loadOutlinePageIntoModal() {
    const bankId = outlineState.bankId;
    const docId = outlineState.selectedDocId;
    if (!bankId || !docId) return;
    if (!outlineContent || !outlineMeta || !outlinePageLabel) return;

    const mySeq = ++outlineState.loadSeq;
    setOutlineNavDisabled(true);
    hideOutlineParseProgress();

    outlineContent.classList.remove("outline-content-box--grid");
    outlineContent.textContent = "加载中…";
    outlineMeta.textContent = "";
    outlinePageLabel.textContent = "";
    const taskKey = getOutlineTaskKey(bankId, docId);

    function renderOutlinePageResponse(data) {
        if (outlineState.loadSeq !== mySeq) return;
        outlineState.totalBlocks = Number(data.totalBlocks) || 0;
        outlineState.extractMode = data.extractMode || "";
        const modeUpper = String(outlineState.extractMode).toUpperCase();
        const blocks = data.blocks || [];

        const modeLabel =
            modeUpper === "EMPTY"
                ? "暂无"
                : modeUpper === "TOC"
                  ? "按目录切分"
                  : modeUpper === "PENDING"
                    ? "解析中"
                    : modeUpper === "SEQUENTIAL"
                      ? "按正文顺序切分"
                      : "已保存";

        outlineMeta.textContent =
            modeUpper === "EMPTY"
                ? "尚未生成大纲（仅展示已保存结果）"
                : `提取方式：${modeLabel} · 共 ${outlineState.totalBlocks} 个内容块`;

        if (modeUpper === "EMPTY" || (outlineState.totalBlocks === 0 && !blocks.length)) {
            outlineContent.classList.add("outline-content-box--grid");
            outlineContent.innerHTML =
                '<div class="outline-empty-hint text-secondary small text-center py-4">暂无大纲内容</div>';
        } else if (!blocks.length) {
            outlineContent.classList.add("outline-content-box--grid");
            outlineContent.innerHTML =
                '<div class="outline-empty-hint text-secondary small text-center py-4">当前页无内容</div>';
        } else {
            outlineContent.classList.add("outline-content-box--grid");
            const cards = blocks
                .map(
                    (b) => `
            <div class="outline-block-card">
                <div class="outline-block-card__title">${escapeHtml(b.title || "（未命名）")}</div>
                <div class="outline-block-card__body">${escapeHtml(b.content || "")}</div>
            </div>`,
                )
                .join("");
            outlineContent.innerHTML = `<div class="outline-block-grid">${cards}</div>`;
        }

        const total = outlineState.totalBlocks;
        const page = outlineState.page;
        const totalPages = Math.max(1, Math.ceil(total / outlineState.size));
        outlinePageLabel.textContent = total
            ? `第 ${page} / ${totalPages} 页（每页 ${outlineState.size} 块）`
            : "";

        if (outlinePrevBtn) outlinePrevBtn.disabled = page <= 1;
        if (outlineNextBtn) outlineNextBtn.disabled = total === 0 || page >= totalPages;
    }

    if (outlineState.docClickOnly) {
        try {
            const data = await fetchDocumentOutline(bankId, docId, 1, 200);
            if (outlineState.loadSeq !== mySeq) return;
            renderOutlinePageResponse(data);
        } catch (err) {
            if (outlineState.loadSeq !== mySeq) return;
            outlineContent.classList.add("outline-content-box--grid");
            outlineContent.innerHTML =
                '<div class="outline-empty-hint text-secondary small text-center py-4">暂无大纲内容</div>';
            outlineMeta.textContent = "尚未生成大纲（仅展示已保存结果）";
            outlinePageLabel.textContent = "";
        }
        return;
    }

    try {
        const viewOnly = outlineState.openMode !== "restart";

        // 查看模式：本文件已确认用异步任务分页时，直接拉页（翻页）
        if (viewOnly && outlineState.useTaskForDocPage.get(taskKey) === true) {
            const tid =
                outlineState.outlineTaskIdByDocId.get(taskKey) || loadPersistedOutlineTaskId(bankId, docId);
            if (tid) {
                try {
                    const pageData = await fetchOutlineGenerateTaskPage(
                        bankId,
                        tid,
                        outlineState.page,
                        outlineState.size,
                    );
                    if (outlineState.loadSeq !== mySeq) return;
                    renderOutlinePageResponse(pageData);
                    hideOutlineParseProgress();
                    setOutlineNavDisabled(false);
                    return;
                } catch (e) {
                    console.warn("[outline] task page failed, fallback to sync", e);
                    outlineState.useTaskForDocPage.delete(taskKey);
                }
            } else {
                outlineState.useTaskForDocPage.delete(taskKey);
            }
        }

        // 查看模式：优先同步 GET（已有完整大纲时不再 POST）
        if (viewOnly) {
            try {
                const syncData = await fetchDocumentOutline(
                    bankId,
                    docId,
                    outlineState.page,
                    outlineState.size,
                );
                if (outlineState.loadSeq !== mySeq) return;
                const mode = String(syncData.extractMode || "").toUpperCase();
                const isPending = mode === "PENDING";
                if (!isPending) {
                    renderOutlinePageResponse(syncData);
                    outlineState.useTaskForDocPage.set(taskKey, false);
                    hideOutlineParseProgress();
                    setOutlineNavDisabled(false);
                    return;
                }
            } catch (syncErr) {
                console.warn("[outline] sync GET failed", syncErr);
            }
        }

        // 查看模式：仅复用已有 taskId（不发起新的异步任务）
        if (viewOnly) {
            let taskId = outlineState.outlineTaskIdByDocId.get(taskKey);
            if (!taskId) {
                taskId = loadPersistedOutlineTaskId(bankId, docId);
                if (taskId) outlineState.outlineTaskIdByDocId.set(taskKey, taskId);
            }
            if (!taskId) {
                if (outlineState.loadSeq !== mySeq) return;
                hideOutlineParseProgress();
                setOutlineNavDisabled(true);
                outlineContent.textContent =
                    "暂无可用大纲，或大纲仍在生成中。可点击该知识文件上的「解析」按钮进行异步解析。";
                outlineMeta.textContent = "";
                outlinePageLabel.textContent = "";
                return;
            }
            showOutlineParseProgress(0, "继续显示大纲解析任务…");
            let taskPromise = outlineState.outlineTaskPromiseByDocId.get(taskKey);
            if (!taskPromise) {
                taskPromise = Promise.resolve(taskId);
            }
            const resolvedTaskId = await taskPromise;
            if (outlineState.loadSeq !== mySeq) return;

            const result = await pollOutlineGenerateTaskStatus(
                bankId,
                resolvedTaskId,
                {
                    shouldContinue: () => outlineState.loadSeq === mySeq,
                    onUpdate: (t) => {
                        if (outlineState.loadSeq !== mySeq) return;
                        const pct = t?.progressPercent;
                        const stage = t?.currentStage || "解析中…";
                        showOutlineParseProgress(pct ?? 0, stage);
                    },
                },
            );

            if (!result) return;

            if (outlineState.loadSeq !== mySeq) return;
            hideOutlineParseProgress();
            outlineContent.textContent = "生成大纲中…";

            const pageData = await fetchOutlineGenerateTaskPage(
                bankId,
                resolvedTaskId,
                outlineState.page,
                outlineState.size,
            );
            if (outlineState.loadSeq !== mySeq) return;
            renderOutlinePageResponse(pageData);
            outlineState.useTaskForDocPage.set(taskKey, true);
            outlineState.outlineTaskIdByDocId.set(taskKey, resolvedTaskId);
            persistOutlineTaskId(bankId, docId, resolvedTaskId);
            outlineState.openMode = "view";
            setOutlineNavDisabled(false);
            return;
        }

        // 重新解析：POST ?restart=true 并排程轮询
        showOutlineParseProgress(0, "重新解析大纲…");
        let taskPromise = outlineState.outlineTaskPromiseByDocId.get(taskKey);
        if (!taskPromise) {
            taskPromise = startOutlineGenerateTaskAsync(bankId, docId, true)
                .then((newTaskId) => {
                    outlineState.outlineTaskIdByDocId.set(taskKey, newTaskId);
                    persistOutlineTaskId(bankId, docId, newTaskId);
                    return newTaskId;
                })
                .finally(() => {
                    outlineState.outlineTaskPromiseByDocId.delete(taskKey);
                });
            outlineState.outlineTaskPromiseByDocId.set(taskKey, taskPromise);
        }

        const resolvedTaskId = await taskPromise;
        if (outlineState.loadSeq !== mySeq) return;

        const result = await pollOutlineGenerateTaskStatus(
            bankId,
            resolvedTaskId,
            {
                shouldContinue: () => outlineState.loadSeq === mySeq,
                onUpdate: (t) => {
                    if (outlineState.loadSeq !== mySeq) return;
                    const pct = t?.progressPercent;
                    const stage = t?.currentStage || "解析中…";
                    showOutlineParseProgress(pct ?? 0, stage);
                },
            },
        );

        if (!result) return;

        if (outlineState.loadSeq !== mySeq) return;
        hideOutlineParseProgress();
        outlineContent.textContent = "生成大纲中…";

        const pageData = await fetchOutlineGenerateTaskPage(
            bankId,
            resolvedTaskId,
            outlineState.page,
            outlineState.size,
        );
        if (outlineState.loadSeq !== mySeq) return;
        renderOutlinePageResponse(pageData);
        outlineState.useTaskForDocPage.set(taskKey, true);
        outlineState.openMode = "view";
        setOutlineNavDisabled(false);
    } catch (err) {
        console.error("[outline] render failed", {
            bankId,
            docId,
            page: outlineState.page,
            size: outlineState.size,
            error: err,
        });
        // 如果复用的 taskId 已不存在（例如后端重启导致内存任务丢失），清理前端缓存以便下次重新启动
        const msg = err?.message ? String(err.message) : "";
        if (msg.includes("大纲解析任务不存在") || msg.includes("任务不存在")) {
            clearPersistedOutlineTaskId(bankId, docId);
            outlineState.outlineTaskIdByDocId.delete(taskKey);
            outlineState.outlineTaskPromiseByDocId.delete(taskKey);
            outlineState.useTaskForDocPage.delete(taskKey);
        }
        hideOutlineParseProgress();
        setOutlineNavDisabled(true);
        outlineContent.classList.remove("outline-content-box--grid");
        outlineContent.textContent = err?.message || "加载大纲失败";
        outlineMeta.textContent = "";
        if (outlinePageLabel) outlinePageLabel.textContent = "";
    }
}

if (closeOutlineModalBtn) {
    closeOutlineModalBtn.addEventListener("click", () => closeOutlineModal());
}
if (outlineModalBackdrop) {
    outlineModalBackdrop.addEventListener("click", (e) => {
        if (e.target === outlineModalBackdrop) closeOutlineModal();
    });
}
if (outlinePrevBtn) {
    outlinePrevBtn.addEventListener("click", async () => {
        if (outlineState.page <= 1) return;
        outlineState.page -= 1;
        await loadOutlinePageIntoModal();
    });
}
if (outlineNextBtn) {
    outlineNextBtn.addEventListener("click", async () => {
        const totalPages = Math.max(1, Math.ceil(outlineState.totalBlocks / outlineState.size));
        if (outlineState.page >= totalPages) return;
        outlineState.page += 1;
        await loadOutlinePageIntoModal();
    });
}

function getCoverUrlForBank(bank, docs) {
    const imageDoc = docs.find((doc) => isImageFile(doc.fileName));
    if (imageDoc) {
        const cache = localStorage.getItem(`bank-cover-${bank.id}-${imageDoc.fileName}`);
        if (cache) return cache;
    }
    return "";
}

function saveCoverCache(bankId, files) {
    const firstImage = files.find((file) => file && file.type.startsWith("image/"));
    if (!firstImage) return;
    const reader = new FileReader();
    reader.onload = () => {
        localStorage.setItem(`bank-cover-${bankId}-${firstImage.name}`, String(reader.result || ""));
    };
    reader.readAsDataURL(firstImage);
}

function renderDocumentsGrid(bankId, docs, coverUrl) {
    if (!docs.length) {
        return '<div class="text-secondary small">暂无知识文件</div>';
    }
    return `
        <div class="doc-grid mt-3">
            ${docs.map((doc) => {
                const cover = coverUrl
                    ? `<div class="doc-cover"><img src="${coverUrl}" alt="cover"></div>`
                    : `<div class="doc-cover doc-cover-fallback">FILE</div>`;
                const cardClass = "doc-card doc-card--outlineable";
                return `
                    <div class="${cardClass}" data-outline-bank="${bankId}" data-outline-doc="${doc.id}">
                        ${cover}
                        <div class="doc-name" title="${escapeHtml(doc.fileName)}">${escapeHtml(doc.fileName)}</div>
                        <div class="doc-status">${escapeHtml(formatDocStatus(doc.status, doc.parseStatus))}</div>
                        <div class="doc-meta d-flex justify-content-end align-items-center gap-2">
                            <div class="d-flex gap-1">
                                <button type="button" class="btn btn-sm btn-outline-info py-0 px-2" data-doc-outline-parse="${bankId}-${doc.id}">大纲解析</button>
                                <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" data-doc-del="${bankId}-${doc.id}">删 除</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function render(banks, docsMap) {
    const count = banks.length;
    bankCount.textContent = count + " 个题库";
    const usageEl = document.getElementById("bankUsage");
    if (usageEl && window.PlanConfig && typeof PlanConfig.renderUsageBar === "function") {
        const plan = PlanConfig.getCurrentPlan();
        const max = plan.maxBanks;
        usageEl.innerHTML = "<span class=\"small text-secondary mb-1 d-block\">当前用量</span>" + PlanConfig.renderUsageBar(count, max, "个");
        usageEl.classList.remove("d-none");
    } else if (usageEl) {
        usageEl.innerHTML = "<span class=\"usage-progress__text\">当前用量：" + count + " 个</span>";
    }
    bankList.innerHTML = "";
    if (!banks.length) {
        bankList.innerHTML = '<div class="text-secondary small">暂无题库</div>';
        return;
    }
    banks.forEach((bank) => {
        const docs = docsMap.get(bank.id) || [];
        const coverUrl = getCoverUrlForBank(bank, docs);
        const div = document.createElement("div");
        div.className = "bank-row p-3";
        div.innerHTML = `
            <div class="bank-header d-flex justify-content-between align-items-start gap-2">
                <div>
                    <div class="fw-semibold">${bank.name}</div>
                    <div class="text-secondary small mt-1">${bank.description || "暂无描述"}</div>
                </div>
                <div class="bank-actions d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-add-file>上传文件</button>
                    <button type="button" class="btn btn-sm btn-outline-primary" data-edit>编辑</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-del>删除</button>
                </div>
            </div>
            ${renderDocumentsGrid(bank.id, docs, coverUrl)}
        `;
        const deleteBankBtn = div.querySelector("[data-del]");
        deleteBankBtn.addEventListener("click", async () => {
            if (!window.confirm(`确认删除题库“${bank.name}”？`)) return;
            await runWithButtonLoading(deleteBankBtn, async () => {
                try {
                    await deleteBank(bank.id);
                    await refresh();
                    show("题库删除成功");
                } catch (e) {
                    show(e.message, "danger");
                }
            }, "删除中...");
        });
        const editBankBtn = div.querySelector("[data-edit]");
        editBankBtn.addEventListener("click", async () => {
            const name = window.prompt("修改题库名称", bank.name);
            if (!name) return;
            const desc = window.prompt("修改题库描述", bank.description || "") || "";
            await runWithButtonLoading(editBankBtn, async () => {
                try {
                    await updateBank(bank.id, { name, description: desc });
                    const fileInput = document.createElement("input");
                    fileInput.type = "file";
                    fileInput.multiple = true;
                    fileInput.accept = ".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif";
                    fileInput.onchange = async () => {
                        try {
                            const files = Array.from(fileInput.files || []);
                            if (files.length) {
                                await uploadFiles(bank.id, files);
                                saveCoverCache(bank.id, files);
                            }
                            await refresh();
                            show("题库编辑成功，知识文件已加入上传任务");
                        } catch (err) {
                            await refresh();
                            show(err.message, "danger");
                        }
                    };
                    fileInput.click();
                    await refresh();
                    show("题库编辑成功");
                } catch (e) {
                    show(e.message, "danger");
                }
            }, "保存中...");
        });
        const addFileBtn = div.querySelector("[data-add-file]");
        addFileBtn.addEventListener("click", async () => {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.multiple = true;
            fileInput.accept = ".txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.gif";
            fileInput.onchange = async () => {
                await runWithButtonLoading(addFileBtn, async () => {
                    try {
                        const files = Array.from(fileInput.files || []);
                        if (files.length) {
                            await uploadFiles(bank.id, files);
                            saveCoverCache(bank.id, files);
                            await refresh();
                            show("已加入上传任务，可点击右下角查看进度");
                        }
                    } catch (err) {
                        await refresh();
                        show(err.message, "danger");
                    }
                }, "提交中...");
            };
            fileInput.click();
        });
        div.querySelectorAll(".doc-card--outlineable").forEach((card) => {
            card.addEventListener("click", async (ev) => {
                if (ev.target.closest("button")) return;
                const bid = Number(card.getAttribute("data-outline-bank"));
                const did = Number(card.getAttribute("data-outline-doc"));
                if (!bid || !did) return;
                const doc = docs.find((d) => Number(d.id) === did);
                if (!doc) return;
                openOutlineModal(bid, [doc], did, { docClickOnly: true });
            });
        });

        docs.forEach((doc) => {
            const parseBtn = div.querySelector(`[data-doc-outline-parse="${bank.id}-${doc.id}"]`);
            if (parseBtn) {
                parseBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    openOutlineModal(bank.id, [doc], doc.id, { restart: true });
                });
            }
            const delBtn = div.querySelector(`[data-doc-del="${bank.id}-${doc.id}"]`);
            if (!delBtn) return;
            delBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!window.confirm(`确认删除文件“${doc.fileName}”？`)) return;
                await runWithButtonLoading(delBtn, async () => {
                    try {
                        await deleteDocument(bank.id, doc.id);
                        await refresh();
                        show("知识文件已删除");
                    } catch (err) {
                        show(err.message, "danger");
                    }
                }, "删除中...");
            });
        });
        bankList.appendChild(div);
    });
}

async function refresh() {
    const banks = await fetchBanks();
    bankNameMap.clear();
    banks.forEach((bank) => bankNameMap.set(bank.id, bank.name || `题库 ${bank.id}`));
    const docsList = await Promise.all(
        banks.map(async (bank) => {
            try {
                const docs = await fetchBankDocuments(bank.id);
                return [bank.id, docs];
            } catch {
                return [bank.id, []];
            }
        }),
    );
    render(banks, new Map(docsList));
}

uploadTaskFab.addEventListener("click", () => {
    openUploadTaskModal();
});

closeUploadTaskModalBtn.addEventListener("click", () => {
    closeUploadTaskModal();
});

uploadTaskModalBackdrop.addEventListener("click", (event) => {
    if (event.target === uploadTaskModalBackdrop) {
        closeUploadTaskModal();
    }
});

function openAddBankModal() {
    if (addBankModalBackdrop) {
        addBankModalBackdrop.classList.remove("d-none");
        addBankModalBackdrop.setAttribute("aria-hidden", "false");
    }
}
function closeAddBankModal() {
    if (addBankModalBackdrop) {
        addBankModalBackdrop.classList.add("d-none");
        addBankModalBackdrop.setAttribute("aria-hidden", "true");
    }
}
if (addBankFab) {
    let addBankFabDragMoved = false;
    let addBankFabStartX = 0, addBankFabStartY = 0, addBankFabStartLeft = 0, addBankFabStartTop = 0;
    const onAddBankFabPointerMove = (e) => {
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        addBankFabDragMoved = true;
        addBankFab.style.right = "auto";
        addBankFab.style.bottom = "auto";
        addBankFab.style.left = (addBankFabStartLeft + (x - addBankFabStartX)) + "px";
        addBankFab.style.top = (addBankFabStartTop + (y - addBankFabStartY)) + "px";
    };
    const onAddBankFabPointerUp = () => {
        document.removeEventListener("mousemove", onAddBankFabPointerMove);
        document.removeEventListener("mouseup", onAddBankFabPointerUp);
        document.removeEventListener("touchmove", onAddBankFabPointerMove, { passive: true });
        document.removeEventListener("touchend", onAddBankFabPointerUp);
    };
    addBankFab.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        const r = addBankFab.getBoundingClientRect();
        addBankFabDragMoved = false;
        addBankFabStartX = e.clientX;
        addBankFabStartY = e.clientY;
        addBankFabStartLeft = r.left;
        addBankFabStartTop = r.top;
        document.addEventListener("mousemove", onAddBankFabPointerMove);
        document.addEventListener("mouseup", onAddBankFabPointerUp);
    });
    addBankFab.addEventListener("touchstart", (e) => {
        if (!e.touches.length) return;
        const r = addBankFab.getBoundingClientRect();
        addBankFabDragMoved = false;
        addBankFabStartX = e.touches[0].clientX;
        addBankFabStartY = e.touches[0].clientY;
        addBankFabStartLeft = r.left;
        addBankFabStartTop = r.top;
        document.addEventListener("touchmove", onAddBankFabPointerMove, { passive: true });
        document.addEventListener("touchend", onAddBankFabPointerUp);
    });
    addBankFab.addEventListener("click", (e) => {
        if (addBankFabDragMoved) {
            addBankFabDragMoved = false;
            return;
        }
        openAddBankModal();
    });
}
if (addBankModalBackdrop) {
    addBankModalBackdrop.addEventListener("click", (event) => {
        if (event.target === addBankModalBackdrop) closeAddBankModal();
    });
}

createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = createForm.querySelector("button[type='submit']");
    await runWithButtonLoading(submitBtn, async () => {
        try {
            const plan = window.PlanConfig?.getCurrentPlan?.();
            if (plan && plan.maxBanks != null) {
                const banks = await fetchBanks();
                if (banks.length >= plan.maxBanks) {
                    show(`当前版本（${plan.name}）最多支持 ${plan.maxBanks} 个题库，请升级后再创建。`, "danger");
                    return;
                }
            }
            const bank = await createBank({
                name: createName.value.trim(),
                description: createDesc.value.trim(),
            });
            const files = Array.from(createFile.files || []);
            if (files.length) {
                await uploadFiles(bank.id, files);
                saveCoverCache(bank.id, files);
            }
            createName.value = "";
            createDesc.value = "";
            createFile.value = "";
            closeAddBankModal();
            await refresh();
            show(files.length ? "题库创建成功，文件已加入上传任务" : "题库创建成功");
        } catch (err) {
            await refresh();
            show(err.message || "创建失败", "danger");
        }
    }, "创建中...");
});

(async function initUserArea() {
    const profile = await ApiClient.validateMe();
    if (profile?.user?.username && userArea && userAreaText) {
        userAreaText.textContent = profile.user.username;
        userArea.href = "./center.html";
    } else if (userArea && userAreaText) {
        userAreaText.textContent = "登录/注册";
        userArea.href = "./login.html";
    }
})();

(async function bootBanks() {
    if (!ApiClient.requireAuth()) return;
    if (window.PhoneBindModal) await PhoneBindModal.ensureBound();
    try {
        await refresh();
        loadPersistedUploadTasks();
    } catch {
        show("初始化失败，请先启动后端", "danger");
    }
})();
