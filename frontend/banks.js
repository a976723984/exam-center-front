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
const userArea = document.getElementById("userArea");
const userAreaText = document.getElementById("userAreaText");

const UPLOAD_TASKS_STORAGE_KEY = "exam-center-upload-tasks";
const uploadTaskMap = new Map();
const bankNameMap = new Map();
let uploadTaskSeed = 0;
let loadingMaskCount = 0;

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
                return `
                    <div class="doc-card">
                        ${cover}
                        <div class="doc-name" title="${escapeHtml(doc.fileName)}">${escapeHtml(doc.fileName)}</div>
                        <div class="doc-meta d-flex justify-content-between align-items-center gap-2">
                            <span>${escapeHtml(formatDocStatus(doc.status, doc.parseStatus))}</span>
                            <button class="btn btn-sm btn-outline-danger py-0 px-2" data-doc-del="${bankId}-${doc.id}">删 除</button>
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
            <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                    <div class="fw-semibold">${bank.name}</div>
                    <div class="text-secondary small mt-1">${bank.description || "暂无描述"}</div>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-secondary" data-add-file>上传文件</button>
                    <button class="btn btn-sm btn-outline-primary" data-edit>编辑</button>
                    <button class="btn btn-sm btn-outline-danger" data-del>删除</button>
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
        docs.forEach((doc) => {
            const delBtn = div.querySelector(`[data-doc-del="${bank.id}-${doc.id}"]`);
            if (!delBtn) return;
            delBtn.addEventListener("click", async () => {
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
