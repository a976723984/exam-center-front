(() => {
    const MOBILE_MEDIA = "(max-width: 992px)";

    function pickModuleTitle() {
        const activeSide = document.querySelector(".web-side-link.active");
        if (activeSide) {
            const text = (activeSide.textContent || "").trim();
            if (text) return text;
        }

        const activeBottom = document.querySelector(".mobile-bottom-nav-link.active span");
        if (activeBottom) {
            const text = (activeBottom.textContent || "").trim();
            if (text) return text;
        }

        const rawTitle = (document.title || "").trim();
        if (!rawTitle) return "模块";
        return rawTitle.replace(/\s*-\s*小白塔云题库\s*$/u, "").trim() || "模块";
    }

    function setupMobileTopbar() {
        const topbar = document.querySelector(".web-topbar");
        if (!topbar) return;
        if (!topbar.dataset.originalHtml) {
            topbar.dataset.originalHtml = topbar.innerHTML;
        }

        const isMobile = window.matchMedia(MOBILE_MEDIA).matches;
        if (!isMobile) {
            topbar.innerHTML = topbar.dataset.originalHtml || topbar.innerHTML;
            return;
        }

        const title = pickModuleTitle();
        topbar.innerHTML = `
            <button type="button" class="web-topbar-back-btn" aria-label="返回上一页" title="返回">
                <i class="bi bi-chevron-left"></i>
            </button>
            <div class="web-topbar-module-title">${title}</div>
        `;
        topbar.setAttribute("aria-label", title);
        const backBtn = topbar.querySelector(".web-topbar-back-btn");
        backBtn?.addEventListener("click", () => {
            try {
                if (typeof window.__mobileTopbarBackHandler === "function") {
                    const handled = window.__mobileTopbarBackHandler();
                    if (handled) return;
                }
            } catch (_) {}
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
            window.location.href = "./index.html";
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupMobileTopbar);
    } else {
        setupMobileTopbar();
    }
    window.addEventListener("resize", setupMobileTopbar);
})();
