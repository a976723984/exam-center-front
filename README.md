# 考试题库系统（前后端分离）

## 技术栈
- 前端：原生 H5（`frontend`），支持 PC 与移动端自适应
- 后端：Java 17 + Spring Boot 3 + Spring Data JPA（`backend`）
- 数据库：MySQL 8+（见 `backend/src/main/resources/db/schema.sql` 建表）
- 第三方：阿里云百炼平台（知识库文件上传、题目生成）

## 已实现功能
1. 用户自定义创建题库
2. 上传文件到后端，并调用百炼知识库上传接口（支持 mock 模式）
3. 根据题库调用百炼接口生成题目并持久化
4. 支持三类题型：选择题、简答题、判断题
5. 前端针对三类题型提供不同样式展示，并完成移动端适配

## 目录结构
```text
exam-center/
  backend/        # Spring Boot + JPA API
  frontend/       # 用户端 H5
  admin-console/  # 运维监控台（用户套餐、登录/活跃、客户端版本）
```

## 后端启动
1. 安装 MySQL，创建数据库：`CREATE DATABASE exam_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`（库名可与环境变量一致）
2. 可选：执行 `backend/src/main/resources/db/schema.sql` 初始化表结构；若省略，可依赖 JPA `ddl-auto: update` 自动建表
3. 环境变量（可选，不设则连接本机 `root`、库名 `exam_center`）：
   - `DATABASE_URL`：如 `jdbc:mysql://主机:3306/exam_center?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true`
   - `DATABASE_USERNAME` / `DATABASE_PASSWORD`
4. 进入目录并启动：
   ```bash
   cd backend
   mvn spring-boot:run
   ```
5. 默认端口：`8081`（见 `application.yml`）

> 当前 `application.yml` 中 `aliyun.bailian.mock-enabled: true`，会走本地 mock 数据，方便联调。

## 对接阿里云百炼（真实环境）
在启动前设置环境变量：
- `BAILIAN_API_KEY`
- `BAILIAN_WORKSPACE_ID`
- `BAILIAN_ACCESS_KEY_ID`
- `BAILIAN_ACCESS_KEY_SECRET`

并在 `backend/src/main/resources/application.yml` 中将：
```yml
aliyun:
  bailian:
    mock-enabled: false
```

### 说明
- 创建题库时，后端会通过阿里云百炼官方 SDK 调用 `CreateIndex` 创建知识库并绑定到题库。
- `BailianClientImpl` 中，创建知识库、上传文件入库、删除文件均走百炼 SDK（RAG链路：申请上传租约 -> 注册文件 -> 提交索引任务）。
- 题目生成接口保持现有 HTTP 对接方式。

### 为什么能创建知识库但上传文件报 401？
百炼把权限拆成两类：**业务空间/管控面**（建知识库、建类目）和 **OpenAPI 数据接口**（文件上传、入库等）。  
创建知识库（CreateIndex、AddCategory）用的是前者；申请上传租约（ApplyFileUploadLease）、AddFile 等属于 **数据类 OpenAPI**。  
**RAM 子账号默认没有数据类 OpenAPI 权限**，需主账号在 RAM 里单独授予 **AliyunBailianDataFullAccess** 后，才能上传文件。所以会出现「能建库不能上传」的情况。

### 上传文件报 401 / NOT AUTHORIZED 时
错误信息类似：`申请文件上传租约失败：code=NOT AUTHORIZED, message=Access denied...`

**若使用 RAM 子账号（AK/SK）：** 主账号需在 [RAM 控制台](https://ram.console.aliyun.com/users) 为该用户添加 **AliyunBailianDataFullAccess** 策略（包含 sfm:ApplyFileUploadLease 等数据接口权限）。详见 [为 RAM 用户授予数据访问权限](https://help.aliyun.com/zh/model-studio/grant-data-access-permission-to-ram-user)。  
然后确认该 RAM 用户已 [加入对应业务空间](https://help.aliyun.com/zh/model-studio/grant-the-business-space-permission-to-ram-users)。

其他核对项：
1. **BAILIAN_WORKSPACE_ID**：在 [百炼控制台](https://bailian.console.aliyun.com/) 左下角「业务空间」中查看并复制，与当前使用的空间一致。
2. **BAILIAN_ENDPOINT**：与工作空间地域一致（如北京：`bailian.cn-beijing.aliyuncs.com`）。
3. 主账号可直接调用数据接口，无须该策略；若主账号也 401，再检查工作空间 ID 与 endpoint。

## 前端使用
1. 直接打开 `frontend/index.html`（或用任意静态服务器托管）
2. 页面默认请求后端地址：`http://localhost:8081/api`（见 `frontend/api-client.js` 中 `API_BASE`）
3. 已登录用户会定期调用 `POST /api/telemetry/ping` 上报客户端版本与活跃时间（用于运维统计）

## 运维监控台（admin-console）
1. 后端设置环境变量 **`ADMIN_API_TOKEN`**（与 `application.yml` 中 `app.admin.api-token` 一致）
2. 用浏览器打开 `admin-console/index.html`（建议静态托管，以便跨域访问后端）
3. 在页面中填写与后端一致的 **管理令牌**，请求将携带请求头 **`X-Admin-Token`**
4. 能力概览：
   - `GET /api/admin/stats`：总用户、近 7 日活跃、按套餐（plan）人数
   - `GET /api/admin/users`：分页列表（可筛选套餐、搜索用户名/手机），展示最近登录、最近活跃、客户端版本
   - `PATCH /api/admin/users/{id}/plan`：修改用户套餐（`planId`：`trial` / `personal` / `advanced`）

> 未配置 `ADMIN_API_TOKEN` 时，访问 `/api/admin/**` 会返回「未配置运维管理令牌」提示。

## 核心 API
- `POST /api/banks`：创建题库
- `GET /api/banks`：查询题库列表
- `POST /api/banks/{bankId}/documents`：上传题库文件
- `POST /api/banks/{bankId}/documents/batch`：批量上传题库文件
- `GET /api/banks/{bankId}/documents`：查询题库文件
- `DELETE /api/banks/{bankId}/documents/{documentId}`：删除题库文件
- `POST /api/banks/{bankId}/questions/generate`：生成题目
- `GET /api/banks/{bankId}/questions`：查询题目
